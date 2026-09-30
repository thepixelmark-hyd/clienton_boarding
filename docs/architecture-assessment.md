# ClientOS — Full Platform Architecture Assessment

**Purpose of this document.** The repository is not greenfield: Phase 1
(foundation) and working slices of Phases 2–3 (Client CRM, Requirements
engine, Projects/Tasks) already exist, are tested, and are merged on
`claude/epic-maxwell-tonyw1`. This document is a full-scope architecture
plan for the *entire* product described in the master PRD, written against
the actual state of the code rather than a blank slate. Every section below
is marked:

- **AS-BUILT** — exists in the repo today; described as it actually works,
  including its real limitations.
- **TARGET** — does not exist yet; this is the recommended design.
- **AS-BUILT + TARGET** — a real foundation exists; this section describes
  it and what needs to be added on top.

No implementation happens in this document. Section 21 consolidates every
architectural risk found during the audit — several were only discoverable
by reading the running code, not by reading the earlier docs, and two of
them are corrections to claims the earlier docs got wrong.

---

## 1. Current repository analysis (AS-BUILT)

### 1.1 Stack and shape

pnpm monorepo, 4 workspaces:

| Workspace | Stack | LOC (approx.) |
|---|---|---|
| `apps/web` | Next.js 14 (App Router), React 18, TypeScript, Tailwind, TanStack Query, Radix UI | ~3,400 |
| `apps/api` | NestJS 10, TypeScript, Prisma client, argon2, Zod | ~2,700 |
| `packages/database` | Prisma 5.20, PostgreSQL 16 | ~1,250 (mostly schema) |
| `packages/shared` | Zod schemas + pure TS (roles, form-rule evaluator, readiness scorer, project-health calculator) | ~1,200 |

Schema: 34 Prisma models, 18 enums, 1 migration. 61 automated tests, all
passing (20 unit in `shared`, 7 unit in `api`, 24 integration in `api`
against a real Postgres database, 10 component in `web`). `pnpm -r
{lint,typecheck,build,test}` all pass cleanly.

### 1.2 What is functionally complete

Authentication (signup/login/logout/invite/accept-invite), tenant isolation
and RBAC enforced in guards, append-only audit logging, Client CRM (CRUD +
contacts + timeline), the Requirements engine (2 real templates — Logo
Design, Website Discovery — with live conditional/branching logic and
readiness scoring), Projects (CRUD, milestones, tasks with dependency-cycle
detection and optimistic concurrency, kanban board, evidence-based health
scoring), a Team page with invitations, a ~20-component design system, and
a seed script producing a realistic demo agency.

### 1.3 What exists in the schema but has no working feature behind it yet

This is the most important thing for planning: several models already
exist because they were designed as part of the full data graph, but have
**zero application code** touching them today. Building against these
tables is mostly schema-compatible, but treat "the table exists" and "the
feature exists" as unrelated facts:

- `ClientPortalUser`, `ClientPortalSession` — no portal auth, no portal API
  surface, no portal UI. 0% built despite being fully modeled.
- `Asset`, `AssetVersion` — no upload endpoint, no storage adapter wired,
  no UI.
- `Approval` — no endpoint creates or transitions one.
- `ChangeRequest` — same.
- `TimeEntry` — same.
- `CSAT` — same.
- `Notification` — the table exists; nothing ever inserts a row into it.
- `Comment` — modeled with full polymorphism (project/task/assetVersion)
  but no controller exposes it.

Automation, AI, billing, feature-flag, and admin-console concepts **have no
tables at all yet** — they are pure PRD text today, not partial schema.

### 1.4 Architectural findings from reading the running code

These were only visible by tracing actual request flow, not by reading the
earlier docs (two of them directly contradict what `docs/security.md`
currently claims — that doc is corrected alongside this assessment):

1. **The CSRF mitigation described in `docs/security.md` is not real.**
   The web client sends `X-Requested-With: XMLHttpRequest` on every
   request (`apps/web/src/lib/api-client.ts`), but no guard, middleware, or
   interceptor in `apps/api` ever reads or validates that header. As
   written today, the API would process a state-changing request that
   never sent it. This is a documentation defect as well as a security gap
   — see §17 and §21.
2. **Login rate limiting described in `docs/security.md` does not exist.**
   No throttling package is installed, no counter is kept anywhere. Brute
   force is currently unmitigated beyond password strength requirements.
3. **Every authenticated request does a live database round trip**
   (`SessionAuthGuard` queries `Session` joined to `User` and `Membership`
   on every single request, with no cache layer). Fine at demo scale;
   will not hold up past a few hundred req/s without a cache — see §9, §21.
4. **No Next.js `middleware.ts` exists.** Route protection is enforced
   entirely client-side (`AppShell` calls `useMe()` and redirects on 401).
   The HTML shell for a protected page still renders and ships to the
   browser before the redirect fires — no real data leaks (data fetching
   is 100% client-side React Query), but it's a UX flash and a pattern that
   won't extend cleanly to any future server-rendered/SEO-relevant page.
5. **`organizationId` is an unconstrained plain column on most
   tenant-scoped tables**, not a formal foreign key (this is a documented,
   deliberate simplification in `schema.prisma`'s header comment — see
   `docs/database.md`). It keeps the relation graph readable, but it means
   Postgres itself cannot catch a bug that writes a `Task.organizationId`
   that doesn't match `Task.project.organizationId`. Nothing in the
   current codebase can produce that today, but there is no structural
   guardrail against it either — see §6 and §21.
6. **The requirement→deliverable traceability link (the PRD's signature
   feature, §27) is hardcoded, not general.** `forms.service.ts` only
   creates a `DeliverableRequirement` row when `templateKey ===
   "logo-design"`, pointed at a specific seeded deliverable. There is no
   endpoint to link any other requirement to any deliverable, and no UI to
   view or create the link. The concept is modeled; the feature doesn't
   exist yet for the general case — see §15.
7. **Two empty scaffold directories** (`apps/web/src/hooks`,
   `apps/api/src/common/interceptors`) — harmless, but should be removed
   or populated so they don't imply unfinished work by their mere
   presence.
8. **No CI, no Dockerfile, no docker-compose.** Local development
   currently depends on a Postgres instance installed directly on the
   machine. This works in the current sandboxed environment but is not
   portable to a new engineer's laptop or to a CI runner without
   reproducing that setup by hand.

None of these are reasons to distrust what's built — the 61 tests are real
and pass against a real database, and the findings above are exactly the
kind of thing an architecture review is supposed to surface before more is
built on top. They're carried into §21 as ranked risks.

---

## 2. Recommended monorepo structure (AS-BUILT + TARGET)

The current 4-workspace shape is correct and should not be restructured.
What's missing is infrastructure scaffolding and a place for the Android
app:

```
clienton_boarding/
├── apps/
│   ├── web/            [AS-BUILT] Next.js
│   ├── api/            [AS-BUILT] NestJS
│   ├── worker/         [TARGET] dedicated BullMQ worker process (§12, §13)
│   └── mobile/         [TARGET] Android/Kotlin — Gradle project, NOT a pnpm workspace member
├── packages/
│   ├── database/       [AS-BUILT] Prisma
│   ├── shared/         [AS-BUILT] Zod schemas + pure logic
│   └── config/         [TARGET] shared eslint/tsconfig/tailwind presets
├── infra/              [TARGET] Dockerfiles, docker-compose, IaC (§19)
├── .github/workflows/  [TARGET] CI/CD (§19)
└── docs/               [AS-BUILT]
```

**Why keep Android inside the same repo (monorepo-inclusive) rather than a
separate repository:** the API contract is the single most important
thing keeping web and mobile in sync. Generating Kotlin data classes and a
Retrofit client from the NestJS OpenAPI spec (already emitted via
`@nestjs/swagger`, see §9) is only convenient when mobile can read that
spec from the same commit that changed the API. A separate repo would
require publishing and versioning the spec as an artifact, which is more
process for a small team and creates a window where mobile silently drifts
from a breaking API change. The cost — a slightly heavier `git clone` for
web-only engineers — is worth it.

**Why Android is not a pnpm workspace member:** pnpm workspaces resolve
Node package dependencies; Gradle has its own dependency and build graph
that doesn't intersect with npm's. Making `apps/mobile` a workspace entry
would gain nothing and would confuse `pnpm -r` commands (lint/build/test
across "all workspaces") into either skipping it silently or failing on
it. It sits in the repo, outside `pnpm-workspace.yaml`'s glob, and CI
treats it as a separate job (§19).

**Why a separate `apps/worker` rather than running BullMQ workers inside
the `apps/api` process:** background jobs (email delivery, automation
execution, AI invocations, report generation) have a different scaling
profile and failure mode than the request/response API — a slow AI call or
a burst of automation jobs should never compete with the API process for
CPU/memory and never risk taking down request handling. Splitting them
into a separate deployable (same NestJS application context, different
entrypoint, both importing from `packages/database` and `packages/shared`)
means they scale and restart independently. This should happen when the
first real background job is introduced (§12/§13), not before — running
BullMQ processors inside `apps/api` is a fine Phase 4 stopgap.

**Why `packages/config`:** today each of the four workspaces hand-rolls
its own `tsconfig.json`/`.eslintrc`. It's a small amount of duplication now
(4 packages); it will not stay small once `apps/worker` and any future
service is added. Centralizing the base configs is a mechanical,
low-risk cleanup — worth doing whenever the next new workspace is added,
not urgent on its own.

---

## 3. Web architecture (AS-BUILT + TARGET)

**AS-BUILT.** Next.js 14 App Router, 100% client components, no
server-rendered data fetching anywhere. Data access is centralized in
`apps/web/src/lib/*.ts` as TanStack Query hooks wrapping a typed `fetch`
wrapper (`api-client.ts`) that always sends `credentials: "include"` for
the session cookie. Route protection is a single `AppShell` client
component that calls `useMe()` and redirects on 401 — every page under the
`(app)` route group is implicitly protected by being rendered inside that
shell. The design system (`components/ui/*`) is Radix-primitives-based for
accessibility (focus trapping, ARIA roles) with Tailwind utility classes
driven by CSS-variable semantic tokens (`styles/tokens.css`) so light/dark
is a single `data-theme` attribute flip.

**Why 100% client components for this phase:** the alternative — React
Server Components fetching data directly from `packages/database` inside
`apps/web` — would require either (a) giving the web process direct
Postgres access (breaks the "API is the only thing that talks to the
database" boundary that makes tenant isolation auditable in one place,
§7), or (b) server components calling the API over HTTP, which loses most
of RSC's benefit (no waterfall elimination when you're still doing a
network hop) while adding complexity (forwarding cookies from the RSC
runtime, handling that fetch's own error cases). For an internal
authenticated tool where nothing needs to be indexed by search engines,
client-side data fetching with TanStack Query's caching is simpler to
reason about and was the right choice for getting a real, working product
built quickly. This should be revisited if any client-portal-facing page
(§4/§39 in the PRD) turns out to need first-paint performance or SEO.

**TARGET — what to add before this scales:**

1. **`middleware.ts` doing a cheap cookie-presence check** (not full
   session validation — that still happens in the API) that redirects to
   `/login` before any protected page's HTML is generated. This closes the
   "flash of shell" gap in §1.4 finding 4 for near-zero cost.
2. **An org-switcher affordance** once the API supports multiple active
   memberships per session (§7, §21) — the UI has nowhere to put this
   today because the backend always resolves to one org.
3. **The client portal is an entirely separate Next.js route tree** (e.g.
   `apps/web/src/app/(portal)/...` or, if its design diverges enough, a
   second Next.js app in `apps/portal`) — not a permission-gated view
   inside the same internal app. This mirrors the API-side decision in
   §7/§39: the portal must be structurally incapable of rendering internal
   data, not just conditionally hidden.

---

## 4. Android architecture (TARGET — nothing built yet)

**Recommended stack:** Kotlin, Jetpack Compose, Material 3 (as a
foundation for a custom design language, per the "no AI-slop, no generic
template" product requirement), Hilt for DI, Retrofit + OkHttp for
networking, Room for local cache/offline drafts, WorkManager for the
upload queue and background sync, DataStore (not SharedPreferences) for
auth token storage, Firebase Cloud Messaging for push.

**Why Retrofit + a generated client over hand-written networking:** the
API already emits an OpenAPI document (`@nestjs/swagger`, §9). Generating
Kotlin data classes and a Retrofit interface from that spec
(`openapi-generator`) as a build step keeps mobile’s request/response
shapes mechanically in sync with the API's Zod schemas — the same
contract-single-source-of-truth argument that justifies the monorepo
structure in §2. Hand-writing DTOs a second time in Kotlin is exactly the
kind of drift that causes silent breakage months later.

**The one real API change Android needs before work starts:** the current
session mechanism is cookie-only (`Set-Cookie` + browser cookie jar).
OkHttp *can* maintain a cookie jar, but a bearer-token pattern is both more
idiomatic for native clients and a better fit for biometric unlock (the
token is what you'd gate behind Android's `BiometricPrompt` +
`EncryptedSharedPreferences`/Keystore-backed `DataStore`, whereas a cookie
jar isn't a natural thing to "lock"). Recommend: the same `Session`
table/`tokenHash` mechanism already built (§1) gains a second issuance
path — `POST /auth/login` with an `Accept: application/vnd.clientos.mobile+json`
header (or a dedicated `/auth/mobile/login`) returns the raw token in the
JSON body instead of a cookie; the `SessionAuthGuard` already looks up by
token hash regardless of where the token came from, so this is additive,
not a rework. This should land as an API change *before* Android
development starts, not be discovered mid-build.

**Offline model:** Room mirrors a read-only subset of server state (today's
tasks, active projects, pending approvals) refreshed on foreground/pull-
to-refresh; writes made offline (quick capture, draft comments, uploaded
photos) are queued as WorkManager jobs with exponential backoff, each
carrying a client-generated idempotency key so a retried job can't create
a duplicate task/comment server-side (the API doesn't have idempotency-key
support yet — this is a required API addition, not just a mobile-side
concern; see §21).

**Push → deep link:** notification payloads carry an entity type + id
(`{"type": "task", "id": "..."}`); a single `MainActivity` intent filter
resolves that into a Compose Navigation destination. This only works once
push notifications exist server-side (§12) — Android and the notification
system need to be designed together, not sequentially.

---

## 5. Backend architecture (AS-BUILT + TARGET)

**AS-BUILT.** NestJS, modular by domain (`auth`, `clients`, `projects`,
`forms`, `audit`), a single Postgres database via one shared `PrismaService`
(global module). Cross-cutting concerns are guards/filters/pipes, not
inline checks: `SessionAuthGuard` (session→tenant resolution) and
`PermissionsGuard` (RBAC) run as global `APP_GUARD`s in that order;
`HttpExceptionFilter` normalizes every error response; `ZodValidationPipe`
wraps `packages/shared` schemas for per-parameter validation. Every
service method takes the resolved `organizationId` from `@CurrentTenant()`
and includes it directly in the Prisma `where` clause — there is no
generic "repository" abstraction; tenant scoping is applied by convention
at each call site rather than by a framework. This was a deliberate choice
for this phase: fewer moving parts than a full repository-pattern layer,
at the cost of relying on every future service author remembering to do
it. See §21 for the mitigation.

**Why NestJS over a lighter framework (Express/Fastify directly, Hono):**
the PRD implies dozens of domain modules over the product's life
(clients, projects, requirements, deliverables, approvals, change
requests, time tracking, financials, automations, notifications,
meetings...). Nest's module/provider/guard structure is exactly the
scaffolding that keeps that from collapsing into an unstructured pile of
Express routes as the module count grows — the cost (more ceremony per
module) is worth paying once, upfront, rather than retrofitted at module
#15.

**TARGET — what's missing before the next phases can be built cleanly:**

1. **A `PortalAuthGuard` + portal-scoped controllers**, structurally
   separate from the internal `SessionAuthGuard`/`PermissionsGuard` pair
   (§7).
2. **A queue module** (BullMQ + Redis) as a real dependency, not just a
   documented intention — needed by notifications (§12), automations
   (§13), and AI (§16) alike. This is the single highest-leverage
   infrastructure addition for the next three phases; provisioning it
   once now (even before the first job exists) means those three phases
   don't each independently decide how to do async work.
3. **A caching layer** (also Redis) for session/membership lookups (§21
   risk #3) — same infrastructure dependency as the queue, good sequencing
   opportunity to add both together.
4. **Idempotency-key support** on mutating endpoints that mobile/offline
   clients will retry (§4) — a small, generic addition (an
   `IdempotencyKey` table keyed on `(organizationId, key)` storing the
   first response, checked by a pipe/interceptor before the handler runs).

---

## 6. PostgreSQL schema design (AS-BUILT + TARGET)

**AS-BUILT.** 34 models covering identity/membership, client CRM, projects/
delivery, the requirements engine, assets/comments/approvals/change
requests, and notifications/audit/CSAT/time. Conventions used throughout
(documented in `docs/database.md`): `cuid()` primary keys (URL-safe,
non-enumerable, unlike sequential integers), soft delete (`deletedAt`) on
records with audit/compliance value, optimistic concurrency (`version`
int) on collaboratively-edited records (`Client`, `Project`, `Task`),
append-only `AuditLog`, and — the one genuinely debatable choice — the
mixed tenancy-FK pattern described in §1.4 finding 5.

**Why cuid over auto-increment integers:** sequential IDs leak record
counts (`/projects/1042` tells a competitor roughly how many projects
exist) and are guessable/enumerable in a way that matters for an API
that's reachable outside a single trusted frontend (mobile, third-party
integrations, the future client portal). cuid costs a few more bytes per
key; the trade is worth it for a multi-tenant B2B product.

**Why optimistic concurrency via a `version` column rather than
timestamp-based (`updatedAt`) checks:** `updatedAt` has millisecond
resolution and can theoretically collide under concurrent writes in a way
an integer that only ever increments cannot; it's also simpler to reason
about in a bug report ("client sent version 4, current version is 6" is
unambiguous). This is tested today (§1) — a stale-version update correctly
returns `409 CONFLICT`.

**The tenancy-FK trade-off, stated plainly for this review:** Every model
directly owned by `Organization` (`Membership`, `Invitation`, `Team`,
`Client`, `Project`, `Form`, `AuditLog`) has a real FK with
`onDelete: Cascade`. Everything nested deeper (`Task`, `Deliverable`,
`Asset`, `Comment`, `Requirement`, `TimeEntry`, `CSAT`, `ChangeRequest`,
`Approval`) carries `organizationId` as a plain indexed `String` with no
FK constraint, relying on cascading deletes through its actual parent
(e.g. `Task` cascades via `Project`, not via `Organization` directly).

- **Why this was chosen:** it avoids two independent cascade paths to the
  same table (Organization→...→Task *and* a redundant Organization→Task),
  which would work in Postgres but adds a second thing to keep in sync for
  no behavioral benefit, and it avoids ballooning `Organization`'s
  reverse-relation list to a dozen-plus arrays that nothing actually reads.
- **What it costs:** Postgres cannot itself guarantee `Task.organizationId
  == Task.project.organizationId`. Nothing in the current codebase can
  produce a mismatch, but there is no database-level guardrail if a future
  script, migration, or bug does. **Recommendation before this schema is
  extended much further:** add either (a) a `CHECK` constraint is not
  expressible across a join in Postgres, so the real options are (b) a
  trigger that re-validates `organizationId` against the parent on
  insert/update, or (c) a periodic consistency-audit job (cheap: a `SELECT
  COUNT(*)` per table comparing `t.organizationId` to
  `t.project.organizationId`, alertable, run in CI against seed/staging
  data and on a schedule in production). (c) is lower-effort and
  sufficient for this product's scale; recommend it as a Phase 4/9 item,
  not urgent today.

**TARGET — schema additions needed for unbuilt features** (do not build
these yet; listed so Phase 4+ planning knows the shape of work involved):
`NotificationPreference`, `Automation`/`AutomationTrigger`/
`AutomationAction`, `AiInvocationLog`, `FeatureFlag`/
`OrganizationFeatureFlag`, `Plan`/`Subscription` (billing), `Skill`/
`ResourceAllocation`, `KnowledgeArticle`/`SupportTicket`, and a
`Decision` log model. None of these are structurally hard — they follow
the same conventions as everything above — they're listed here so the
"development phases" section (§20) can sequence them correctly rather than
have each new phase improvise its own schema style.

**Full-text search:** `docs/database.md` documents a plan (Postgres
`tsvector`/GIN index on `Client.name`, `Project.name`, `Task.title`) that
has not been built — confirmed absent from the one existing migration.
This is accurately described as a plan in the existing docs, not a false
completion claim (unlike the two items corrected in §1.4/§17).

---

## 7. Multi-tenant strategy (AS-BUILT + TARGET)

**AS-BUILT.** Three-layer enforcement, verified by integration tests:

1. **Never trust the client** — no write endpoint accepts `organizationId`
   from the request; it is always read server-side from the resolved
   session.
2. **Guard layer** — `SessionAuthGuard` resolves cookie → `Session` →
   `User` → (first active) `Membership`, attaching `request.tenant`.
3. **Query layer** — every service method includes `organizationId` in its
   Prisma `where` clause directly (no ORM-level automatic scoping — see
   §5). Cross-tenant lookups return `404`, not `403`, so a cross-tenant
   caller can't even confirm a record exists (tested).

**The one-organization-per-session simplification, and why it's the
biggest open item in this section:** a `User` can have multiple
`Membership` rows (the schema supports it — an agency employee who is
also, separately, a client stakeholder at another org; or a consultant who
works across two agencies), but `SessionAuthGuard` always resolves to the
user's *first-created* active membership and there is no mechanism to
switch. This was a reasonable Phase-1 simplification (most demo users have
exactly one org) but is a real product gap the moment any user needs a
second one. **Fixing it is an API-and-web-both change**: the session needs
either (a) an explicit "active organization" selector persisted per
session (simplest — add `activeOrganizationId` to `Session`, an endpoint
to change it, and the guard reads that instead of "first membership"), or
(b) a per-request organization header validated against the user's
memberships (more RESTful, more moving parts). Recommend (a) — it matches
how the web app already has exactly one "current org" concept per browser
tab and requires the smallest guard change.

**Client-portal tenancy is structurally separate, not layered on top of
the same guard** (TARGET, not built): a `ClientPortalUser` is not a `User`
and must never be resolved by `SessionAuthGuard`. The portal needs its own
guard (`PortalAuthGuard`) resolving `ClientPortalSession` →
`ClientPortalUser` → `clientId`, and portal controllers query by `clientId`
the same disciplined way internal controllers query by `organizationId`.
The reason this must be a *different* guard and not an `if (isPortalUser)`
branch inside the existing one: a bug in a shared guard is a bug that can
leak internal data to a client; two independent code paths mean a portal
bug can only ever leak portal-scoped data, which is a much smaller blast
radius. This mirrors the "client portal is a separate API module + separate
Next.js route tree" decision already stated in `docs/architecture.md` and
reaffirmed in §3 above — worth restating here because it's the single most
important isolation boundary in the whole system once the portal exists.

---

## 8. RBAC and permission model (AS-BUILT + TARGET)

**AS-BUILT.** Two independent role vocabularies — `OrgRole` (10 values:
Owner…Viewer) and `ClientPortalRole` (6 values, for when the portal
exists) — each with a permission matrix expressed as **data**
(`packages/shared/src/roles.ts`: `Record<Role, Record<Resource, Action[]>>`)
rather than scattered `if (role === 'ADMIN')` checks. A route declares
`@RequirePermission(action, resource)`; `PermissionsGuard` looks up the
resolved role in the matrix. This is unit-tested directly (`roles.test.ts`)
independent of any HTTP plumbing.

**Why a data table instead of a rules engine or per-endpoint hard-coded
checks:** the PRD specifies 10 org roles × 10 client roles × 11 action
types across a growing list of resources — a matrix that needs to be
*auditable at a glance* ("can a Contractor delete a client? — read one
line") more than it needs to be dynamically configurable. A full rules
engine (e.g. CASL, OPA) buys flexibility this product doesn't currently
need (no per-organization custom roles in the PRD) at the cost of an extra
abstraction layer and a new DSL to learn. If custom/configurable roles per
organization become a real requirement later, the matrix's shape
(`Record<Role, Record<Resource, Action[]>>`) is exactly what you'd
serialize into a database table at that point — the migration path is
short.

**Object-level permission (beyond role):** `ProjectMember.role`
(`LEAD`/`CONTRIBUTOR`/`OBSERVER`) exists in the schema but is **not yet
enforced anywhere** — today, any org member with the right org-level role
can read any project regardless of `ProjectMember` membership. This is a
real gap relative to the PRD's stated model ("an Employee not assigned to
a project cannot read it") — flagged here because it's easy to miss (the
table exists, implying it's used) and should be closed before Phase 3 is
considered complete, not deferred to a later phase.

**TARGET:** an `ObjectPermissionGuard` (or an extension of
`PermissionsGuard`) that, for project-scoped resources, additionally
checks `ProjectMember` when the resolved org role is below
Admin/Owner/PM-tier — matching the design already described (but not yet
implemented) in `docs/security.md`.

---

## 9. API architecture (AS-BUILT + TARGET)

**AS-BUILT.** REST under `/api/v1`, OpenAPI/Swagger generated from
`@nestjs/swagger` decorators and served at `/api/docs` outside production,
a single consistent error envelope (`{code, message, details}`) via one
global exception filter, cursor-free offset pagination (`page`/`pageSize`,
capped at 100) on list endpoints. Validation is Zod-first
(`packages/shared` schemas reused by both API pipes and web forms), not
`class-validator` — deliberately, to get one schema instead of two
parallel definitions that drift.

**Why REST over GraphQL:** the PRD's data shape is deeply relational
(client→project→task→deliverable→requirement→approval) but the *access
patterns* are page-shaped, not query-shaped — a project detail page always
wants roughly the same nested shape, it's not an ad-hoc client-composed
query. GraphQL earns its complexity when different clients need
meaningfully different shapes of the same graph (a thin mobile view vs. a
rich desktop view) or when over-fetching is a measured problem. Neither is
true here yet, and REST + OpenAPI gives the Android client (§4) a
generated-client story that's simpler to operate than a GraphQL codegen
pipeline. Revisit only if a specific screen's data requirements start
forcing N+1 REST calls that a single GraphQL query would avoid.

**Why offset pagination over cursor-based:** simpler to implement and
reason about, and none of this product's lists (clients, projects, tasks
per project) are expected to reach page-position-drift-sensitive scale
(tens of thousands of rows with concurrent inserts during pagination) for
a single organization. Cursor pagination is the right call for the
activity/audit feed once that's built (append-only, high-volume, always
read newest-first) — recommend introducing it scoped to that one endpoint
rather than converting every list endpoint.

**TARGET — the versioning question:** `/api/v1` exists as a prefix but
there is no actual versioning *strategy* yet (no v2 has ever been needed).
Recommend deciding this before the mobile client ships, because mobile
clients can't be forced to upgrade instantly the way a web app can: a
breaking API change must either bump to `/api/v2` with both versions
served simultaneously for a deprecation window, or be additive-only
(new optional fields, new endpoints) for as long as possible. This is a
policy decision to write down (§22), not a code change to make now.

---

## 10. File storage architecture (TARGET — schema exists, nothing else does)

**Recommended design:** S3-compatible object storage (AWS S3, Cloudflare
R2, or a self-hosted MinIO for on-prem/dev), accessed only from `apps/api`
via a `StorageProvider` interface with two implementations: a local-disk
adapter for development (already referenced in code comments as the
intended dev fallback) and an S3 adapter for staging/production. Uploads
flow through the API (validated: MIME allow-list checked by magic bytes,
not just the `Content-Type` header; size limits) which writes an
`AssetVersion` row with an opaque `storageKey`, then either streams the
file through the API to storage or issues a pre-signed *upload* URL for
the client to PUT directly (recommended for anything above a few MB, to
avoid the API process buffering large uploads). Downloads never expose a
permanent public URL — every download request re-checks authorization for
that specific asset/version and then issues a short-lived pre-signed
*download* URL.

**Why a `StorageProvider` interface rather than calling the AWS SDK
directly from services:** the product needs to run in local development
without AWS credentials (already true today for every other module) and
potentially needs to support a self-hosted deployment (MinIO) for
enterprise/on-prem customers later. An interface with two concrete
implementations costs almost nothing to introduce now and avoids an AWS
SDK dependency leaking into business logic.

**Why pre-signed URLs over proxying file bytes through the API for large
files:** proxying keeps the API process's memory/connections tied up for
the duration of a large upload/download, which is exactly the kind of
resource contention §5 already flags as a reason to split background work
out of the request path. Pre-signed URLs let the browser/mobile client
talk to storage directly while the API only ever handles the
authorization decision (fast, cheap, stateless from the API's point of
view).

**Versioning:** `Asset`/`AssetVersion` already models this correctly
(`(assetId, versionNumber)` unique) — the PRD's "no `final2.png`" concern
is solved by the schema, not by a naming convention. Nothing to redesign
here; this is a clean case of "the schema was already built right, the
feature just needs the storage adapter and endpoints behind it."

---

## 11. Realtime architecture (TARGET — nothing built)

**Recommended design:** a WebSocket gateway (`@nestjs/websockets` +
`socket.io`) with the Redis adapter for horizontal scaling (pub/sub across
API instances, not just in-process). Used for: live task-board updates
when a teammate moves a card, comment threads, approval-status changes,
and notification badge counts. Every socket connection authenticates with
the same session token used by REST (no separate realtime auth system);
on connect, the server joins the socket to a room per
`organizationId:projectId` (and per-user for notifications) so broadcasts
are scoped without a fan-out query.

**Why Redis-backed Socket.IO over plain Postgres `LISTEN`/`NOTIFY`:**
`LISTEN`/`NOTIFY` is tempting because it needs no new infrastructure, but
it only reaches listeners connected to the *same* Postgres connection
pool process — it doesn't fan out across multiple API instances without
extra plumbing that ends up re-inventing a pub/sub layer anyway. Given
Redis is already the recommended choice for the queue (§5, §12, §13) and
session cache (§9, §21), reusing it for realtime pub/sub is one piece of
infrastructure serving three needs instead of three separate decisions —
the standard argument for consolidating on one well-understood dependency
rather than three narrow ones.

**Why not build this before the queue/cache:** realtime is the
lowest-priority of the three Redis use cases — the product is fully usable
with polling (TanStack Query's existing refetch-on-focus/interval
behavior) until multiple people are actively co-editing the same board at
the same time. Recommend provisioning Redis when the *queue* becomes
necessary (§12/§13, whichever ships first) and adding the WebSocket
gateway as a follow-on once Redis is already there, not as the reason to
introduce Redis in the first place.

---

## 12. Notification architecture (TARGET — model exists, nothing writes to it)

**Recommended design:** a `NotificationService` in `apps/api` is the only
thing that ever inserts a `Notification` row (never let controllers write
directly) — the service takes an event, computes the right recipients
from the event's context (assignee, project members, client contacts
depending on visibility), writes the DB row, and enqueues one BullMQ job
per delivery channel (email, push, WhatsApp — each a separate job type so
one channel's outage doesn't block another). In-app delivery is a
websocket push (§11) with a REST fallback (`GET /notifications`,
mark-read) for when the socket isn't connected.

**Idempotency is a real, named requirement (PRD §97) and needs a schema
addition, not just careful code:** BullMQ jobs can retry. Without a
uniqueness constraint, a retried "task assigned" job produces a second
identical notification. Recommend a `dedupeKey` column on `Notification`
(e.g. `${type}:${entityType}:${entityId}:${userId}`) with a unique index,
and the insert uses `upsert`/`ON CONFLICT DO NOTHING` — the job can retry
freely and the second attempt is a no-op by construction rather than by
job-level care.

**Preferences:** the PRD requires per-user notification preferences
(channel on/off per type). This needs a new `NotificationPreference`
model (not yet in the schema) — small, but worth having a named model
rather than a JSON blob on `User`, since preferences need to be queried
("everyone who wants email for task-overdue") not just displayed back to
their owner.

**Reminder scheduling** (client accountability nudges, PRD §25) is a
different shape of job — not "fire once when an event happens" but "check
periodically whether a condition is still true and hasn't been
reminded-about too recently." Recommend a BullMQ *repeatable* job (e.g.
hourly) that queries for stale "awaiting client" states and enqueues
individual reminder-notification jobs, rather than scheduling a bespoke
timer per record — simpler to reason about, trivially horizontally
scalable (repeatable jobs run on whichever worker picks them up), and easy
to pause organization-wide (PRD's "pause reminders" control is then just a
filter in that periodic query).

---

## 13. Automation architecture (TARGET — nothing built, no schema yet)

**Recommended design:** an internal domain-event bus
(`@nestjs/event-emitter`, in-process — not Redis pub/sub, that's for
cross-process realtime in §11) that every service emits to after a state
change commits (`project.created`, `task.completed`, `approval.requested`,
etc.). A new `AutomationRule` model (organization-scoped: trigger type +
JSON condition tree + ordered list of `AutomationAction` rows) is matched
against each emitted event by an `AutomationEngine` service; matching
rules enqueue a BullMQ job per action (never execute actions synchronously
inside the event handler — an automation with 5 actions, one of which is a
slow webhook call, must not block the request that triggered it).

**Why an internal event bus + queue, rather than automations polling the
database or being embedded as `if` statements inside each service:** the
PRD lists ~19 triggers and ~13 action types (§46/§47) — that's a
combinatorial surface that becomes unmaintainable as inline conditionals
scattered across a dozen services. An event bus decouples "the thing that
happened" from "what should happen as a result," which is exactly the
separation that lets automations be user-configurable later (PRD's visual
automation builder, §45) without touching the services that emit the
underlying events at all — the automation engine is the only thing that
needs to know the full trigger/action matrix.

**Why the condition tree reuses the same shape as the form engine's
conditional-rule evaluator (§14):** both are "evaluate a small boolean
expression tree against a bag of key/value facts." Reusing
`packages/shared`'s existing `ConditionalRule` evaluator (already written,
tested, and used by the requirements engine) for automation conditions
means one evaluator to trust instead of two, and the visual automation
builder UI can share form-builder-adjacent UI patterns.

**Safety rule carried over from the PRD and worth stating explicitly
here:** automations create/update records (tasks, notifications, change
requests) — they must never be granted a path to *delete* data or bypass
the RBAC/tenancy checks a human action would go through. The cleanest way
to guarantee this: automation actions call the exact same service methods
a controller would call (same authorization-relevant inputs, just with a
system actor instead of a human `userId` for audit purposes), never a
separate "automation-privileged" code path.

---

## 14. Requirement/Form engine architecture (AS-BUILT + TARGET)

**AS-BUILT.** `Form`/`FormField`/`FormSubmission`/`FormResponse`/
`Requirement`, with two real templates (Logo Design — 19 fields, Website
Discovery — 12 fields) defined as data
(`packages/shared/src/forms/templates/*.ts`) and instantiated by copying
their field definitions onto a new `Form` + draft `FormSubmission` per
project. Conditional visibility is one recursive evaluator
(`evaluateConditionalRule`) run identically client-side (to decide what to
render, live, as the user types — verified working in the earlier
session's screenshots) and server-side (to decide what's required before
computing readiness) — this "one evaluator, two call sites" design is the
single most important property of the engine, because it's what guarantees
the UI and the readiness score can never disagree about which fields
matter.

**Readiness scoring is deliberately rule-based, not AI-based, and that's a
permanent property, not a placeholder:** `computeReadiness` flags
`MISSING` from unanswered required-and-visible fields; `CONFLICTING` only
ever comes from a `manualConflicts` list a human reviewer supplies — the
function has no semantic understanding of an answer's content and
correctly does not pretend to. Detecting that "premium positioning"
contradicts "mass-market pricing" requires actual language understanding
and belongs in §16 (AI) as a human-confirmed *suggestion* that populates
`manualConflicts`, never as something this scorer tries to infer itself.

**Real gaps to close before calling the engine "done":**

1. **File-upload field types don't work.** `FILE_UPLOAD`/`IMAGE_UPLOAD`/
   `VIDEO_UPLOAD` exist in the `FormFieldType` enum and the web renderer
   correctly falls back to an honest "not yet supported" disabled input
   rather than pretending — but this blocks any template needing asset
   collection (Brand Identity, Packaging Design, Video Production all need
   this) until §10 (file storage) exists.
2. **Only internal staff can fill a form today.** The client-portal
   submission flow (a `ClientPortalUser` filling their own project's form)
   doesn't exist — it's the same engine, called from portal-scoped
   endpoints once §7's portal guard exists, not a redesign.
3. **No template versioning/authoring UI.** Templates are TypeScript data
   today (2 exist; the PRD lists ~20). Adding the other ~18 is "author a
   field list," not new engine code, *for as long as they only need the 6
   field types the current UI renderer implements* — RATING, RANKING,
   ADDRESS, CONSENT, SIGNATURE, and CALCULATED all need their own renderer
   before any template using them can actually be used. Recommend adding
   renderer support driven by which upcoming template needs it first,
   rather than building all six speculatively.
4. **Long forms don't paginate.** 19 fields on one scrolling page is fine;
   a 40+ field custom form (PRD explicitly wants a "Custom Requirement
   Form" builder) needs sectioning/multi-step, which the current
   single-page renderer doesn't support.

---

## 15. Project/Task/Deliverable relationship model (AS-BUILT + TARGET)

**AS-BUILT.** The core graph — `Project` → `Milestone`/`ProjectPhase`,
`Project` → `Task` (self-referential for subtasks, plus `TaskDependency`
for blocking relationships, cycle-checked on write), `Project` →
`Deliverable` → `Task`/`Asset`/`Approval`, and the traceability join table
`DeliverableRequirement` connecting a `Deliverable` to one or more
`Requirement`s. Project health is computed from evidence (overdue tasks,
overdue milestones, blocked tasks specifically blocked by an
still-pending approval) rather than stored as a status flag — `WATCH` /
`AT_RISK` / `BLOCKED` / `CRITICAL` are derived, always paired with a
human-readable reason string, and unit-tested independent of any
controller.

**The traceability spine is the PRD's signature idea and is currently the
least-finished part of this section, not the most:** as noted in §1.4
finding 6, `DeliverableRequirement` rows are only ever created for one
hardcoded template key today. The three questions the PRD says the system
must be able to answer — "what requirement does this task satisfy," "what
deliverables depend on this requirement," "what approved requirement
caused this scope" — are all *answerable by the schema* (a `Task` has a
`deliverableId`; a `Deliverable` has `requirementLinks`) but there is no
general-purpose endpoint or UI that lets a PM create that link for an
arbitrary requirement/deliverable pair, and no query endpoint that walks
the chain to answer those three questions directly. **Recommend this as
the very next piece of work in this area**, ahead of anything else in
§20's phase plan for this subsystem: it's a moderate amount of new
controller/UI work on top of a schema that's already correct, and it's the
concept the whole product is positioned around.

**Why health is computed rather than stored:** a stored status field
inevitably goes stale the moment the underlying tasks change without
someone remembering to update it. Computing it on read (cached briefly if
it ever becomes a performance concern — it isn't yet, given current
query patterns) guarantees it's always consistent with reality and,
critically, always has a "why" derivable from the same computation that
produced the status — a stored enum can't explain itself after the fact.

---

## 16. AI architecture (TARGET — intentionally not built)

**Why nothing exists yet, restated for this document:** every AI feature
in the PRD (§55–59) requires an LLM API key and a real cost/abuse posture
that this environment doesn't have configured, and building a copilot
against no real data model would produce something that looks like a
feature but can't be verified. The recommendation below is the design to
build *when* that's ready — not a suggestion to build it now.

**Recommended design:**

1. **A feature-flagged `AiModule`**, gated per-organization (via the
   `OrganizationFeatureFlag` model from §6/§20), using the Anthropic API
   (Claude) — consistent with this environment's own guidance to default
   to the latest capable Claude models for any AI feature built.
2. **Two structurally different code paths, never merged:**
   - **Read-only copilot queries** ("what's blocking this project,"
     "summarize the last three meetings"): an `AiQueryService` assembles a
     *structured context object* from Postgres (the specific project's
     tasks/health/recent activity — not a raw table dump) and constructs a
     prompt that requires the model to cite the specific record IDs it's
     referencing. If the assembled context doesn't contain the answer, the
     prompt instructs the model to say so rather than fabricate — matching
     the PRD's explicit "AI must never fabricate project facts" rule.
   - **Suggestion-producing calls** (AI project plan, scope-change
     detection): output is always written as a `DRAFT`/`PROPOSED` record a
     human must explicitly confirm before it affects real state (a
     proposed task list, a proposed change request) — never a direct
     mutation. This is the same "AI recommendations must not automatically
     become production commitments" rule from the PRD, enforced
     structurally (the AI code path literally cannot call the same
     "confirm and apply" service method a human approval calls) rather
     than by convention.
3. **An `AiInvocationLog` table** (org id, prompt template id, redacted
   context summary, model, token counts, latency, cost) — required for
   cost tracking and abuse detection from day one, not added after the
   first surprise bill.
4. **Streaming via Server-Sent Events (or the WebSocket gateway from
   §11 if it already exists by then)** for the copilot chat UI, so a
   multi-second generation doesn't read as a hung request.

**Cross-tenant leakage is the specific risk to design against from the
start:** an `AiQueryService` that assembles context by naively
interpolating a user's free-text question into a prompt alongside "here's
some project data" is one bad prompt-injection away from a cross-tenant
data leak if the context-assembly step ever queries broader than the
resolved `organizationId`. The mitigation is architectural, not
prompt-engineering: the context-assembly step must use the exact same
tenant-scoped service methods (§5, §7) every other feature uses to read
data — the AI module should have **no direct Prisma access of its own**,
only the same tenant-checked service layer everything else calls through.

---

## 17. Security architecture (AS-BUILT + TARGET, with two corrections)

**AS-BUILT and verified by tests:** argon2id password hashing, hashed
(not plaintext) session tokens, tenant isolation returning 404 on
cross-tenant access, RBAC returning 403 on same-tenant insufficient role,
no endpoint accepting client-supplied `organizationId`, no password hash
ever returned in an API response (asserted by shape in tests), `helmet`
security headers, sanitized rich-text input paths documented (though see
below — worth re-verifying `sanitize-html` is actually wired, not just
documented; flagged for the same reason as the two corrections below).

**Two corrections to `docs/security.md`, made alongside this assessment:**

1. **CSRF is not actually enforced.** The web client sends
   `X-Requested-With`; the API never checks it. `docs/security.md` is
   corrected to describe this as a planned-but-unimplemented control
   rather than a completed one. **Recommended fix (small, should land
   before any public-facing form or the client portal exists):** a global
   guard rejecting cookie-authenticated state-changing requests that lack
   the header — a few lines, high value, and it makes the client's
   already-sent header actually mean something.
2. **No rate limiting exists anywhere**, despite `docs/security.md`
   previously describing login as rate-limited. Corrected to describe this
   as unimplemented. **Recommended fix:** `@nestjs/throttler` on
   `/auth/login` and `/auth/signup` at minimum (IP-based to start; the
   Redis infrastructure from §9/§11 makes a distributed limiter
   straightforward once it exists, an in-memory limiter is an acceptable
   single-instance stopgap before then).

**TARGET, sequenced roughly by when it becomes necessary rather than by
raw importance:** MFA/2FA and OAuth login (before the client portal opens
the product to less security-savvy external users), a real secrets
manager for any non-local environment (the current `.env`-file model is
correct for local dev and must not be how production secrets are held),
dependency/SAST scanning in CI (§19 — trivially added once CI exists),
signed-URL file access (§10), and the object-level `ProjectMember` check
called out as missing in §8.

**Security review checklist for every future PR touching auth/tenancy**
(restating and keeping current the checklist already in
`docs/security.md`): can another tenant reach this? Can an unauthorized
role reach this? Can a client-portal identity reach internal data? Can a
soft-deleted record still be read? Can an expired/revoked session or
invitation token be reused? This assessment found real answers of "not
applicable yet" (portal doesn't exist) or "yes, gap" (CSRF, rate limiting,
object-level project permission) for several of these — the checklist
itself is sound and should be re-run at every future phase boundary, not
just once.

---

## 18. Testing architecture (AS-BUILT + TARGET)

**AS-BUILT.** 61 tests, all passing, in four layers: pure-logic unit tests
in `packages/shared` (permission matrix, conditional-rule evaluator,
readiness scorer, project-health calculator — all independent of any
framework, fast, and the layer most worth growing as new domain logic is
added), Jest unit tests in `apps/api` (guards/pipes in isolation), Jest +
Supertest integration tests in `apps/api` running against a real
`clientos_test` Postgres database (full HTTP → guard → controller →
service → Prisma round trip — this is the layer that actually caught the
tenant-isolation and RBAC behavior working correctly, and is the layer
most worth growing as new endpoints are added), and Vitest + Testing
Library component tests in `apps/web`.

**Why integration tests against a real database rather than mocking
Prisma:** the single most important property this product needs to prove
is "a cross-tenant request cannot reach another tenant's data" — that
claim is only actually tested if the query really executes against a real
schema with real foreign keys and real indexes. A mocked Prisma client
would let a test assert "the where clause contains organizationId" without
ever proving the where clause is correct against the actual relational
constraints. The cost (slower tests, a real Postgres dependency in CI) is
worth it for exactly the claims this product most needs to keep being
true as it grows.

**TARGET — gaps to close, roughly in priority order:**

1. **No Playwright E2E suite yet** (scaffolding was never added). The 22
   critical flows enumerated in the PRD (§83) mostly depend on features
   that don't exist yet (file upload, approvals, the client portal) — E2E
   coverage should be added *alongside* each of those features as they're
   built, not written speculatively against screens that don't exist.
2. **No load/performance testing** — nothing has been validated above demo
   data volume. Becomes relevant once real user-count targets exist (§22).
3. **No automated security testing beyond the authz/tenancy integration
   tests** — no IDOR sweep, no malicious-upload testing (irrelevant until
   §10 exists), no dependency scanning (trivial once CI exists, §19).
4. **No CI enforcement of any of the above** — see §19; a test suite that
   only runs when a human remembers to run it locally is a materially
   weaker guarantee than one that gates every merge.
5. **No Android tests**, obviously, since no Android code exists yet —
   flagged here only so the Android phase's Definition of Done includes
   its own test pyramid (instrumented Compose UI tests, Room/WorkManager
   unit tests) rather than assuming web's testing culture transfers
   automatically.

---

## 19. CI/CD architecture (TARGET — nothing exists yet)

**Current state:** no `.github/workflows`, no Dockerfile, no
docker-compose, no containerization anywhere. Every check
(`lint`/`typecheck`/`build`/`test`) that currently passes has only ever
been run by a human (or an agent) locally — there is no automated gate
preventing a regression from being pushed.

**Recommended design:**

1. **PR pipeline (GitHub Actions):** a Postgres service container,
   `pnpm install` with the lockfile, then `pnpm -r lint`, `pnpm -r
   typecheck`, `pnpm -r build`, `pnpm -r test`, and `apps/api`'s
   `test:e2e` against the service-container database — i.e. exactly the
   sequence this assessment ran by hand to verify the current state,
   turned into a required check. Cache the pnpm store and Next.js/Nest
   build outputs keyed on lockfile hash to keep this fast.
2. **Deploy pipeline:** build Docker images for `apps/web` and `apps/api`
   (and `apps/worker` once it exists, §2), push to a registry, run `prisma
   migrate deploy` (never `migrate dev`) as an explicit gated step before
   the new API image goes live, then deploy. The actual target platform
   (managed PaaS like Railway/Render/Fly vs. AWS ECS/Fargate vs.
   Kubernetes) is a business decision, not an architecture one — see §22 —
   but whichever is chosen, the pipeline shape above (build → migrate →
   deploy, migration as its own gated step) holds.
3. **Dockerfiles + docker-compose for local dev**, independent of the
   deploy pipeline: this is the fix for the "new engineer needs Postgres
   installed by hand" gap (§1.4 finding 8) and should land *before* CI
   does, since CI's Postgres service container and local dev's
   docker-compose Postgres should be the same image/version to avoid a
   third environment to keep in sync.
4. **Why this should move earlier in the phase plan than the original
   roadmap had it** (originally a Phase 9 "final polish" item): every
   phase from here on benefits from CI catching a regression at PR time
   instead of at the next full manual verification pass. The cost of
   adding it now (a few hours) is small and fixed; the cost of *not*
   having it grows with every phase that ships without it. See the
   revised sequencing in §20.

---

## 20. Development phases (revised, reconciling the original roadmap with actual progress)

| Phase | Status | Scope |
|---|---|---|
| **1 — Foundation** | ✅ Done | Architecture, schema, auth, tenancy, RBAC, design system. |
| **2 — CRM & Requirements** | 🟡 Partial | Done: Client CRM, requirements engine core (2 templates, conditional logic, readiness). Missing: general deliverable↔requirement linking (§15 — recommend doing this *first*, before anything else below), dynamic project template generator, calendar/workload views. |
| **2.5 — CI/CD + containerization** *(new, moved up from original Phase 9)* | Not started | §19 in full. Recommended immediately after closing out Phase 2, before Phase 4's larger surface area (file storage, portal) makes "no CI" more expensive to keep tolerating. |
| **3 — Projects/Tasks** | 🟡 Partial | Done: CRUD, milestones, tasks, dependencies (backend), kanban, health. Missing: dependency-setting UI (backend exists, no UI), Gantt/timeline view, object-level `ProjectMember` permission enforcement (§8 — recommend closing this gap here, not deferring it). |
| **4 — Portal, Files, Approvals** | Not started | Client portal (separate guard + route tree, §3/§7), file storage (§10), creative proofing, approval engine UI, asset requests. This is the largest unbuilt phase and the one most of the schema is already waiting for (§1.3). |
| **5 — Change Requests, Meetings, Notifications** | Not started | Change request UI (schema exists), meetings, notification delivery (§12 — needs the queue), WhatsApp channel. |
| **6 — Resources, Time, Financials** | Not started | Time tracking UI (`TimeEntry` exists unused), resource management, retainers, financial reporting. |
| **7 — AI** | Not started, intentionally | §16 in full, feature-flagged, human-confirmation-gated throughout. |
| **8 — Android** | Not started | §4 in full — requires the mobile-token API change (§4) landed first. |
| **9 — Hardening & Platform** | Not started | Full security/perf audit, admin console, billing, feature flags, the two security corrections in §17 closed out for real, object-level permissions fully audited. |

**Sequencing rationale worth calling out explicitly:** the traceability
spine fix (§15) and the object-level permission gap (§8) are both small
relative to the phases they're embedded in, but both are *conceptually*
load-bearing — the traceability spine is the product's positioning, and
project-level access control is a security property, not a feature. Both
are placed as early as possible in this revised plan rather than left
until "someone notices."

---

## 21. Consolidated architectural risks (ranked)

| # | Risk | Severity | Effort to fix | Where discussed |
|---|---|---|---|---|
| 1 | CSRF header sent by client, never verified server-side | High | Low | §17 |
| 2 | No rate limiting anywhere (auth endpoints especially exposed) | High | Low | §17 |
| 3 | `ProjectMember`-level access control not enforced despite existing in schema | High | Low–Medium | §8 |
| 4 | Requirement↔Deliverable linking hardcoded to one template, not general | Medium–High (product positioning) | Medium | §15 |
| 5 | Session/membership resolved via a live DB join on every request, no cache | Medium now, High at scale | Medium | §5, §9 |
| 6 | Single-org-per-session with no switcher; multi-org users unsupported | Medium | Medium (API + web) | §7 |
| 7 | `organizationId` unconstrained (no FK) on most tenant-scoped tables | Medium (latent) | Low (audit job) / Medium (trigger) | §6 |
| 8 | No CI — regressions depend on a human running checks locally | Medium, compounding | Low | §19 |
| 9 | No containerization — non-portable local dev setup | Low–Medium | Low | §19 |
| 10 | No SSR/middleware on web — auth boundary is client-side only | Low today, higher if portal/SEO needs emerge | Low | §3 |
| 11 | `FILE_UPLOAD`/etc. field types selectable in form engine with no working upload path | Low (fails safely/visibly) | — (tracked, not urgent) | §14 |

Risks 1–3 are the ones worth fixing before any further feature work that
depends on them being solid (respectively: before the portal exists, before
public signup traffic exists, before Phase 3 is called complete). The rest
are correctly sequenced into §20's phase plan.

---

## 22. Open decisions requiring product/business input (not architectural calls to make unilaterally)

- **Deployment target:** managed PaaS (Railway/Render/Fly) vs. cloud VPC
  (AWS/GCP) — affects §19's deploy pipeline shape and cost.
- **Object storage vendor** (§10): S3 vs. Cloudflare R2 (cheaper egress)
  vs. self-hosted MinIO (on-prem/enterprise customers).
- **Email provider** (§12): SES vs. Postmark vs. SendGrid — affects
  deliverability tooling and cost at volume.
- **WhatsApp Business API provider** (PRD §35): Meta direct vs. a BSP
  (Twilio, 360dialog) — significant cost/complexity difference.
- **AI budget ceiling and model choice** (§16): per-organization usage
  caps need a product decision before the feature-flag rollout plan can be
  finalized.
- **Is multi-org-per-user actually a required use case** (§7, §21 risk 6),
  or is it acceptable to keep the current one-org-per-session model
  indefinitely? This determines whether risk 6 is a "must-fix before
  Phase 4" or a "nice-to-have, low priority."
- **API versioning policy** (§9) — needs to exist before mobile ships, not
  after the first breaking change is needed.
- **Data residency / compliance requirements**, if any (affects storage
  region choice, and potentially the whole hosting decision above).

---

*This document supersedes nothing in `docs/architecture.md`,
`docs/database.md`, `docs/security.md`, `docs/design-system.md`,
`docs/api.md`, or `docs/testing.md` for what's already built — those
remain the detailed reference for the current implementation. This
document is the full-scope plan for everything around and ahead of it,
and the two corrections noted in §17 have been applied to
`docs/security.md` directly.*
