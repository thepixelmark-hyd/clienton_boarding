# ClientOS — Architecture

## Monorepo layout

```
clienton_boarding/
├── apps/
│   ├── web/              Next.js 14 (App Router), TypeScript, Tailwind
│   └── api/              NestJS, TypeScript
├── packages/
│   ├── database/         Prisma schema, migrations, seed, generated client
│   └── shared/           Zod schemas + TS types shared between web and api
├── docs/                 This documentation set
└── pnpm-workspace.yaml
```

pnpm workspaces (not a monolithic app) so `apps/web` and `apps/api` can be
deployed, scaled, and versioned independently, while `packages/database` and
`packages/shared` guarantee the two never drift on data shape.

## Why this stack

| Layer      | Choice                          | Reason |
|------------|----------------------------------|--------|
| Web        | Next.js 14 App Router, React 18 | Server components for data-heavy screens, file-based routing, mature ecosystem. |
| Backend    | NestJS                          | Opinionated module/provider structure scales to dozens of domain modules without turning into a junk drawer; first-class guards/interceptors for auth & tenancy. |
| Database   | PostgreSQL 16                   | Relational integrity for a graph this interconnected (requirement→deliverable→task→approval); full-text search built in for Phase 1 search needs. |
| ORM        | Prisma                          | Strong typing end-to-end, explicit migrations, good transaction ergonomics. |
| Auth       | Argon2id + server sessions      | Session-based auth stored in Postgres (not JWT-in-localStorage) so sessions can be listed, revoked, and rotated server-side — required by §69 (session/device management, revocation). |
| Validation | Zod (`packages/shared`)         | One schema defines both the API's input validation and the web form's client-side validation — never validate in only one place (§77). |
| Cache/Queue| Redis + BullMQ (architected, not yet wired) | Needed once email/notification/automation background jobs are built (Phase 5+); the API is already structured with a `queue` module boundary so this drops in without refactoring. |
| Storage    | S3-compatible object storage (architected, not yet wired) | File uploads currently persist metadata only; see "Known gap" below. |
| Mobile     | Kotlin + Jetpack Compose (not yet started) | Consumes the same REST API and session auth as web — no separate backend. |

## Multi-tenancy model

```
Organization
 ├─ Membership (User × Role)
 ├─ Team ─ TeamMember
 ├─ Client ─ Contact
 │    └─ Project
 │         ├─ ProjectMember
 │         ├─ Phase ─ Milestone
 │         ├─ Task (self-referential Subtask, Dependency)
 │         ├─ Deliverable ── RequirementLink → Requirement
 │         ├─ Requirement (via Form/FormSubmission)
 │         ├─ Asset ─ AssetVersion
 │         ├─ Comment / Conversation / Message
 │         ├─ Approval
 │         ├─ ChangeRequest
 │         └─ TimeEntry
 ├─ Invitation
 ├─ Notification
 └─ AuditLog
```

Every tenant-scoped table carries a non-nullable `organizationId`. Enforcement
happens at three layers, never relying on any single one:

1. **Never trust the client.** No endpoint accepts `organizationId` as
   request input for a write. It is always derived server-side from the
   authenticated session's active membership.
2. **Guard layer.** `TenancyGuard` (NestJS `CanActivate`) resolves the
   session → user → membership → active organization on every request and
   attaches `request.tenant = { organizationId, userId, role }`. Route
   handlers read from `request.tenant`, never from params/body, for anything
   that scopes a query.
3. **Query layer.** All Prisma reads/writes for tenant-scoped models go
   through a `TenantScopedRepository` base that injects `where:
   { organizationId }` automatically, so a developer cannot accidentally
   write a query that omits the tenant filter. Cross-tenant object access
   (e.g. `/projects/:id` where the id belongs to another org) returns 404,
   not 403 — this avoids leaking existence of another tenant's records.
4. **Role/object authorization.** A `PermissionsGuard` checks the resolved
   role (and, where relevant, `ProjectMember` role) against the action being
   performed. See `security.md` for the full permission matrix.

This is tested directly — see "Testing" below — with integration tests that
assert a user from Org A gets 404 on Org B's resources even with a valid
session.

## Internal vs. client visibility

Any entity that clients can see (`Task`, `Comment`, `Asset`, `Requirement`,
`Meeting`, etc.) carries a `visibility` enum: `INTERNAL | CLIENT_VISIBLE`.
The **client portal API surface is a separate NestJS module** (`portal/`)
with its own controllers that hard-filter `visibility: CLIENT_VISIBLE` at the
query layer — it is not the internal API with a UI-side filter. A client
session's guard also verifies the authenticated principal is a
`ClientContact`, not an org `User`, and can only reach records belonging to
their own `Client`. This means a bug in the web client can never expose
internal data, because the client portal literally cannot query for it.

## API design

REST, versioned under `/api/v1`. OpenAPI is generated from the NestJS
decorators (`@nestjs/swagger`) and served at `/api/docs` in non-production
environments. Every endpoint:

- declares its required role(s) via `@Roles()`,
- validates input via a Zod-backed `ZodValidationPipe` using the schemas in
  `packages/shared`,
- returns the consistent error envelope described in `api.md`,
- paginates list endpoints with `?page=&pageSize=` (default 20, max 100).

## Background jobs (architected)

`apps/api/src/queue` defines the BullMQ queue names and job payload types
that Phase 5+ (email delivery, notification fan-out, document generation,
automation execution) will use, so those features are additive rather than
requiring a request/response → async refactor later. Redis is not yet
provisioned in this environment; jobs currently marked TODO in code comments
are the ones gated on that.

## Phased roadmap

This phase = **Phase 1 (complete)** + working slices of **Phase 2 and 3**.
Recommended next phases, in order, matching the original build strategy:

1. **Finish Phase 2/3**: deliverables↔requirement linking UI, dependencies,
   calendar/workload views, project templates (dynamic template generator).
2. **Phase 4**: client portal UI, file storage (S3 + signed URLs), creative
   proofing/annotation, approval engine UI, asset requests.
3. **Phase 5**: change requests UI, meetings, notifications (email via
   queue), WhatsApp channel.
4. **Phase 6**: resource management, time tracking UI, financials, retainers.
5. **Phase 7**: AI copilot (requirement analysis, risk detection, scope
   detection) — behind a feature flag, human-confirmation-gated per §57/§58.
6. **Phase 8**: Android app.
7. **Phase 9**: full security/performance audit pass, admin console, billing.

## Known gaps (do not treat as done)

- File **uploads** currently persist `Asset`/`AssetVersion` metadata rows,
  but the actual binary storage adapter (S3-compatible) is stubbed behind an
  interface (`StorageProvider`) with a local-disk implementation for
  development only. Do not use the local-disk provider in production.
- Redis/BullMQ are referenced in code structure but not provisioned in this
  environment; background jobs run inline (synchronously) for now, which is
  fine for seed/demo volume but must move to a real queue before production
  traffic.
