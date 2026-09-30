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
6. **Phase 8**: Android app — the client-facing screens (projects, tasks,
   requirements, client CRM) on top of the auth/navigation/theme foundation
   already built (see "Mobile (Android) architecture" above).
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
