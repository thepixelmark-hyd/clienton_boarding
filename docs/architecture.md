# ClientOS — Architecture

## Monorepo layout

```
clienton_boarding/
├── apps/
│   ├── web/              Next.js 14 (App Router), TypeScript, Tailwind
│   │   └── Dockerfile
│   └── api/              NestJS, TypeScript
│       └── Dockerfile
├── packages/
│   ├── database/         Prisma schema, migrations, seed, generated client
│   └── shared/           Zod schemas + TS types shared between web and api
├── mobile/                Android app — separate Gradle project, not a pnpm workspace member
│   ├── core-network/     Pure Kotlin/JVM: networking, auth, DTOs — zero Android dependency
│   └── app/              Compose UI, Hilt DI, DataStore, biometric gating
├── .github/workflows/    CI (lint/typecheck/build/test for web+api+mobile)
├── docs/                 This documentation set
├── docker-compose.yml    Local production-like run (api + web + postgres)
└── pnpm-workspace.yaml
```

pnpm workspaces (not a monolithic app) so `apps/web` and `apps/api` can be
deployed, scaled, and versioned independently, while `packages/database` and
`packages/shared` guarantee the two never drift on data shape. `mobile/` is
intentionally its own Gradle project rather than shoehorned into the pnpm
workspace — Kotlin/Gradle and TypeScript/pnpm are different toolchains with
nothing to gain from forcing them into one dependency graph.

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
| Mobile     | Kotlin, Jetpack Compose, Hilt, Retrofit + kotlinx.serialization | Foundation built this phase (auth, session, navigation, theme — see below); consumes the same REST API and session auth as web via `Authorization: Bearer`, no separate backend. |

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

The **client portal API surface is a separate NestJS module**
(`apps/api/src/portal`) with its own controllers — not the internal API with
a UI-side filter. `PortalAuthGuard` verifies the authenticated principal is
a `ClientPortalUser`, not an internal `User`, and every portal query is
scoped to that user's own `clientId` (not just `organizationId` — see
`security.md` "Client portal tenant isolation"). This means a bug in the web
client can never expose another client's data, because the portal API
literally cannot query for it regardless of what the frontend sends.

This phase's portal exposes onboarding (read-only) and requirement forms
(view/fill/submit, gated by the portal's own `clientPortalPermissionMatrix`
role check). The broader `Task`/`Comment`/`Asset`/`Meeting` `visibility:
INTERNAL | CLIENT_VISIBLE` design the original architecture draft described
is still the intended model for the Phase 4 full client portal (project
status, deliverable review, approvals) — those models already carry a
`visibility` enum, but the portal module doesn't query them yet, since
project/deliverable/approval UI wasn't this phase's scope either internally
or for the portal.

## API design

REST, versioned under `/api/v1`. OpenAPI is generated from the NestJS
decorators (`@nestjs/swagger`) and served at `/api/docs` in non-production
environments. Every endpoint:

- declares its required role(s) via `@Roles()`,
- validates input via a Zod-backed `ZodValidationPipe` using the schemas in
  `packages/shared`,
- returns the consistent error envelope described in `api.md`,
- paginates list endpoints with `?page=&pageSize=` (default 20, max 100).

## Mobile (Android) architecture

`mobile/` is a two-module Gradle project, split specifically so the business
logic is testable without an Android emulator or the Android SDK:

- **`:core-network`** — plain Kotlin/JVM (`org.jetbrains.kotlin.jvm`, not
  `com.android.library`). Holds the DTOs (mirroring the API's actual response
  shapes, not a guessed contract), `AuthApi` (Retrofit + kotlinx.serialization
  — no Moshi/reflection), the `TokenStore` interface, `AuthRepository`, and
  the `ApiResult<T>` sealed-class result type that mirrors
  `apps/web/src/lib/api-client.ts`'s error handling so both clients treat the
  API's error envelope the same way. Because this module has zero Android
  dependency, its tests run on any JVM against a real `MockWebServer`
  instance — an actual HTTP round trip, not a mocked interface — which is
  what let this module be built and tested in a network-restricted
  environment that cannot reach Google's Maven repository (see
  `testing.md`'s Known limitations).
- **`:app`** — the actual Android application: Jetpack Compose UI, Hilt DI
  wiring (`di/NetworkModule.kt`), a DataStore-backed `TokenStore`
  implementation, and `BiometricAuthManager` gating app launch behind a
  biometric prompt when a session token already exists. This module depends
  on `:core-network` but never the reverse.

Session auth on mobile uses `Authorization: Bearer <token>` — the same
`Session` row and `SessionAuthGuard` as the web cookie, just a different
transport (see `security.md`). The design tokens (colors, in
`ui/theme/Color.kt`) are derived mathematically (HSL→RGB) from
`apps/web`'s CSS custom properties rather than eyeballed, so the two clients
stay visually consistent without hand-syncing hex values.

Screens shipped this phase: signup, login, a biometric unlock gate, and a
home screen that proves the whole chain (signup/login → persisted session →
authenticated `GET /auth/me` → logout) end to end. Project/task/client
screens are explicitly out of scope here — see Phase 8 below.

## Client portal

A deliberately separate NestJS module (`apps/api/src/portal`) and a
separate Next.js route group (`apps/web/src/app/(portal)/portal/...`) — not
the internal app with a role check layered on top. See `security.md`
"Client portal is a second, fully independent auth system" for the full
reasoning; the short version is that `ClientPortalUser`/`ClientPortalSession`
are their own tables, the session cookie has its own name, and
`PortalAuthGuard` is registered as a global `APP_GUARD` (not a module-local
one) specifically so CSRF protection still covers portal mutations — a
subtlety easy to get wrong by making it module-local, since then it would
run after, not before, the global `CsrfGuard` that depends on it having
already tagged the request.

The web side reuses as much as possible rather than duplicating it: the same
`FormFieldControl` component (`apps/web/src/components/forms/field-control.tsx`)
renders a requirement form for both the internal submission page and the
portal fill page, parameterized by a `basePath` prop (`""` vs `"/portal"`)
so file-upload URLs hit the right API prefix — conditional-logic evaluation,
validation display, and every field-type renderer stay in one place rather
than two copies that could drift.

`apps/web/src/middleware.ts` treats `/portal/*` as a second, independent
boundary: it checks for the portal cookie (not the staff one) and redirects
to `/portal/login` (not `/login`), entirely before the staff-cookie branch
runs.

## Form builder

Form templates existed only as hardcoded TypeScript
(`packages/shared/src/forms/templates/`) before this phase — real, but not
something a non-engineer could extend. `Form.isTemplate` (previously an
unused schema column) now has a real code path: `POST /forms` with neither
a `clientId` nor `projectId` creates a reusable org-level template as actual
database rows; `POST /forms/:formId/fields` etc. build it up field by field;
`POST /forms/:formId/submissions` instantiates either kind of form (hardcoded
catalog or builder-authored) onto a project, copying its fields into an
independent `Form` row the same way either path already worked. A
non-template form's fields lock (`400` on any mutation) once a submission
exists against it — editing the question list out from under an
already-answered form would silently change what those answers mean.

Conflict detection piggybacks on the same instantiation-time copy: a
template's `conflictRules` (declarative field-pair rules — "these two
MULTI_SELECT fields must not overlap," "these two fields must not be equal")
are copied onto the `Form` row at instantiation and evaluated at submit time
by `packages/shared/src/forms/conflict.ts`, merged with the readiness
calculation that already existed. This is deliberately narrow: it catches
*structural* contradictions, not semantic ones ("premium positioning" vs.
"mass-market low-cost" still needs a human or, eventually, AI — see
`readiness.ts`'s own comment on why that's out of scope here).

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:
`lint-typecheck`, `build`, and `test-unit` cover the pnpm workspace;
`test-api-e2e` runs the full integration suite against a real
`postgres:16-alpine` service container (migrations applied via
`prisma migrate deploy`, not a hand-rolled schema); `mobile-core` builds and
tests `:core-network` on a plain JVM; `mobile-app` builds the Android `:app`
module against a real Android SDK. `apps/api/Dockerfile` and
`apps/web/Dockerfile` (the latter using Next's `output: "standalone"`) build
from the repo root — both apps pull in workspace packages via the
`workspace:*` protocol, so the Docker build context has to be the monorepo
root, not the app's own directory. `docker-compose.yml` at the repo root
wires both images to a Postgres container for a local, production-like run.

## Background jobs — not yet started (correction)

An earlier version of this document claimed `apps/api/src/queue` already
defined BullMQ queue names/payload types ready for Phase 5+. That directory
does not exist — there is no queue scaffolding of any kind in this codebase
today. Email sending (`apps/api/src/email`) runs synchronously inline within
the request that triggers it, which is fine at this phase's volume but will
need to move to a real queue (BullMQ + Redis, as originally planned) before
notification fan-out, document generation, or automation execution are
built — those genuinely need async workers, not just "don't block the
response," the way a single email send doesn't yet.

## Phased roadmap

This phase = **Phase 1 (complete)** + working slices of **Phase 2 and 3**.
Recommended next phases, in order, matching the original build strategy:

1. **Finish Phase 2/3**: deliverables↔requirement linking (the traceability
   spine itself — see "Known gaps"), task dependencies, calendar/workload
   views, project templates (dynamic template generator).
2. **Phase 4**: the client portal now has its auth/onboarding/requirements
   foundation (this phase) — extend it with project status, deliverable
   review, creative proofing/annotation, approval engine UI, and asset
   requests; move file storage from local-disk to S3-compatible + signed
   URLs (the `StorageProvider` interface this phase built makes that a
   single new class, not a redesign).
3. **Phase 5**: change requests UI, meetings, a real job queue (BullMQ +
   Redis — email sending exists but runs inline; see "Background jobs"),
   WhatsApp channel.
4. **Phase 6**: resource management, time tracking UI, financials, retainers.
5. **Phase 7**: AI copilot (requirement analysis, risk detection, scope
   detection) — behind a feature flag, human-confirmation-gated per §57/§58.
6. **Phase 8**: Android app — the client-facing screens (projects, tasks,
   requirements, client CRM) on top of the auth/navigation/theme foundation
   already built (see "Mobile (Android) architecture" above).
7. **Phase 9**: full security/performance audit pass, admin console, billing.

## Known gaps (do not treat as done)

- File **uploads**: a real `StorageProvider` interface
  (`apps/api/src/storage`) with a working local-disk implementation now
  exists and is wired to two real features — form-field file uploads
  (`FILE_UPLOAD`/`IMAGE_UPLOAD`/`VIDEO_UPLOAD`) and client logos — with
  real MIME/magic-byte/size validation (see `security.md`). It is *not*
  wired to `Asset`/`AssetVersion`, which remain schema-only: no
  Asset controller or service exists yet (that's the Phase 4 creative
  proofing/review feature, still not built). An earlier version of this
  document claimed the opposite (uploads persisting through `Asset` with a
  storage adapter already stubbed in) — that was never true; this is the
  correction. Do not use the local-disk `StorageProvider` in a
  multi-instance or ephemeral-filesystem production deployment; an
  S3-compatible implementation behind the same interface is the upgrade.
- The requirement→deliverable traceability spine (`DeliverableRequirement`)
  is modeled but not populated by any application code — only by seed data.
  See `product.md` "Architected for, not built."
- Redis/BullMQ are referenced in code structure but not provisioned in this
  environment; background jobs run inline (synchronously) for now, which is
  fine for seed/demo volume but must move to a real queue before production
  traffic.
