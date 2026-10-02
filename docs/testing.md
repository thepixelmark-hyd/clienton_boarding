# ClientOS — Testing

## Philosophy

Per the project's QA loop: build → run → test → inspect → find defects → fix
→ test again. A feature is not done because it compiles; it is done when its
tests pass against a real Postgres database and its critical failure modes
(unauthorized access, cross-tenant access, invalid input) are covered.

## Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | Jest / Vitest | Pure logic: permission matrix resolution (org and client-portal, both resource-aware), form conditional-logic evaluator, declarative conflict-rule detection, field-value validation, requirement-summary generation, project health calculator, CSRF guard exemption rules. |
| Integration (API) | Jest + Supertest + real Postgres (`clientos_test` db) | Full HTTP request → guard → controller → service → Prisma → Postgres round trip, for both the staff API and the separate client-portal API. Migrations are applied to `clientos_test` once (`prisma migrate deploy`, see CI/CD below); each test file then truncates all tables in a `beforeEach` so tests never see another test's rows. |
| Component (web) | React Testing Library | Design-system components: forms validate, buttons disable while loading, empty/error states render. |
| Middleware (web) | Vitest + `NextRequest` | Edge auth-boundary redirects (unauthenticated → `/login`, authenticated away from `/login`). |
| Unit (Android core) | JUnit 5 + MockWebServer, plain JVM (`:core-network`) | Real HTTP-level tests of the auth repository against a fake server — success, typed API errors, rate-limit (429), network failure, and that the bearer header is actually sent. No Android SDK involved, so this runs in any JVM, including this sandbox. |
| E2E | Playwright (scaffolded; see Known limitations) | Critical journeys once the client portal UI exists (Phase 4). |

## What is covered in this phase

- **Auth**: signup creates org+owner atomically; duplicate email rejected;
  login succeeds/fails correctly; logout invalidates the session; protected
  routes reject missing/invalid/expired sessions.
- **Tenant isolation**: cross-org read of a client/project returns 404;
  cross-org write attempt returns 404; same-org insufficient-role write
  returns 403.
- **RBAC**: permission matrix unit tests for every role × action pair used
  by the UI (create/edit/delete/approve on clients, projects, tasks).
- **Requirements engine**: conditional field visibility evaluator (nested
  AND/OR rules); submission preserves raw `FormResponse` rows even when a
  `Requirement` summary is later edited; readiness scorer correctly flags
  missing/conflicting fields from fixture data.
- **Projects/Tasks**: task creation validates required fields and dependency
  cycles are rejected; project health calculator returns the correct state
  + evidence string for fixture scenarios (overdue milestone, overdue task,
  none of the above).
- **Concurrency**: updating a `Task` with a stale `version` returns 409.
- **Session hardening**: a bearer-authenticated request is exempt from the
  CSRF guard while a cookie-authenticated one is not; a mutating
  cookie-authenticated request without `X-Requested-With` is rejected;
  login/signup return `429` past their rate limit while unrelated endpoints
  do not share that budget; login and logout each write an `AuditLog` row;
  every response carries a correlation ID that matches what was logged
  server-side.
- **Android auth repository**: signup/login persist the returned token;
  logout clears the stored token even when the server call itself fails; a
  429 from the API surfaces as a typed `ApiResult.Error`, not an exception;
  a connection failure surfaces as `ApiResult.NetworkError`, never a crash.
- **Client CRM extensions**: contact update enforces optimistic concurrency
  the same way `Client` does; cross-org contact update returns 404; a
  non-image (or content/extension-mismatched) logo upload is rejected before
  anything is written to disk.
- **Client onboarding**: starting onboarding is idempotent (a second call
  doesn't duplicate the checklist); completing every required item rolls
  `Client.onboardingStatus` to `COMPLETED` automatically; timeline events are
  written for start and completion.
- **Client portal**: the full invite → accept → login → view onboarding →
  view/fill/submit a requirement → logout path, driven over real HTTP
  against the real portal auth boundary (not a mocked session). CSRF
  enforcement is verified specifically for portal mutations (cookie present,
  header missing → `403`). Tenant isolation is verified for the case that
  matters most: a portal user for Client A gets `404` reading *or writing*
  Client B's requirement, even though both clients are in the same
  organization — not just an empty list from the "my requirements" endpoint.
  Portal role restriction is verified too (a `VIEWER` can read a requirement
  but gets `403` trying to save an answer).
- **Requirement lifecycle**: automatic conflict detection fires when two
  `MULTI_SELECT` answers that shouldn't overlap do; a malformed answer (wrong
  option, type mismatch, a `MULTI_SELECT` outside its declared min/max) is
  rejected by `PUT .../responses` before it's saved; the full
  submit → request-clarification → reopen → edit → resubmit → mark-ready
  cycle produces the expected version sequence and version-history rows;
  editing a requirement's summary bumps its version; reopening a requirement
  that isn't `NEEDS_CLARIFICATION` is rejected.
- **Form builder**: a staff-authored template can be built field by field,
  reordered, and instantiated onto a project as an independent copy (editing
  the template afterward doesn't touch already-instantiated forms); a
  non-template form's fields lock once any submission exists against it.
- **File uploads**: a real PNG (verified by its actual magic bytes, not its
  claimed `Content-Type`) is accepted, downloadable, and deletable before
  submission; content that doesn't match its claimed type is rejected;
  uploading to a non-upload field type is rejected; a file belonging to
  another organization 404s on download.
- **Project templates**: a blueprint with a dangling phase/milestone/parent/
  dependency key reference is rejected with `400` and a specific error list,
  before it's ever persisted; a dependency cycle among template tasks is
  rejected the same way; instantiating a template creates real `Project`/
  `ProjectPhase`/`Milestone`/`Task` rows with every key reference resolved to
  a real id and every `*OffsetDays` field turned into a real date relative to
  the given start date (asserted down to the exact date, not just "a date
  exists"); updating a template re-validates the *merged* blueprint; deleting
  a template leaves already-instantiated projects completely intact;
  instantiating a template for a client in a different organization 404s.
- **Phases, milestones, and project members**: full phase CRUD plus
  reordering (rejects a reorder call whose id set doesn't exactly match the
  project's current phases); completing a milestone stamps `completedAt`,
  un-completing clears it; adding a project member rejects a duplicate and a
  user who isn't an org member at all; phases are tenant-isolated the same
  way every other project sub-resource is.
- **Deliverables and traceability**: deliverable updates enforce optimistic
  concurrency (`409` on a stale `version`); linking a requirement rejects a
  duplicate link and a requirement that belongs to a *different* project;
  the project traceability view correctly separates deliverables-with-their-
  linked-requirements-and-tasks from requirements not yet linked to
  anything; deliverables are tenant-isolated.
- **Task detail, subtasks, and comments**: task detail includes resolved
  subtask and dependency data (a blocking task's title and status, not just
  its id); deleting a task is a soft delete (it drops off the project's task
  list immediately); a task comment can only be deleted by its own author
  (someone else gets `403`).
- **Project activity and dashboard**: real activity events are recorded for
  project/task/milestone/deliverable mutations and are readable in order;
  every number on the project dashboard (task-status breakdown, overdue-task
  list, deliverable-status breakdown, waiting-on-client items) is checked
  against a fixture with a known, hand-computed answer — never just "a number
  came back" — so a regression that silently returns `0` or a wrong count
  would fail the test, not just a regression that returns nothing at all.
- **Client portal project dashboard**: milestones and deliverables render in
  full; a task's title/description only appears in the response when that
  task is `CLIENT_VISIBLE` — an internal task's title is asserted *absent*
  from the response body, not just unrendered — while both kinds of task
  still count toward the real `progress.totalTasks`/`doneTasks` numbers; a
  portal user for Client A gets `404` and an empty list for Client B's
  project in the same organization; a `VIEWER` portal role can read the
  dashboard (read is universal) but the matrix still gates `edit`/`upload`
  elsewhere the way Phase 2's tests already covered.

## Current results (last full run)

| Suite | Count | Status |
|---|---|---|
| `packages/shared` unit (Vitest) | 49 | ✅ passing |
| `apps/api` unit (Jest) | 15 | ✅ passing |
| `apps/api` integration/e2e (Jest + Supertest + Postgres) | 88 | ✅ passing |
| `apps/web` unit/component (Vitest + Testing Library) | 24 | ✅ passing |
| `mobile/core-network` unit (JUnit 5 + MockWebServer) | 7 | ✅ passing |
| **Total** | **183** | ✅ all passing |

Also verified at last full run: `pnpm -r typecheck`, `pnpm -r lint`, and `pnpm -r build` all pass with zero errors and zero warnings across `packages/shared`, `packages/database`, `apps/api`, and `apps/web`.

## Running tests

```bash
pnpm --filter @clientos/api test          # unit
pnpm --filter @clientos/api test:e2e      # integration, needs clientos_test db
pnpm --filter @clientos/web test          # component tests
pnpm test                                 # everything TS/JS, from repo root

cd mobile && ./gradlew :core-network:test # Android business logic, plain JVM
```

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR: `lint-typecheck`, `build`,
and `test-unit` jobs cover the whole pnpm workspace; `test-api-e2e` spins up
a real `postgres:16-alpine` service container, applies migrations with
`prisma migrate deploy`, and runs the full e2e suite against it — the same
commands documented above, not a separate CI-only test path. `mobile-core`
builds and runs `:core-network:test` on a plain JVM. `mobile-app` builds the
Android `:app` module against a real Android SDK (`android-actions/setup-android`),
which GitHub Actions' runners can reach but this development sandbox cannot
(see Known limitations).

`apps/api/Dockerfile` and `apps/web/Dockerfile` build standalone production
images from the repo root (both apps depend on workspace packages, so the
build context must be the monorepo root, not the app directory); root
`docker-compose.yml` wires them to a Postgres container for a local
production-like run.

## Browser verification (not a maintained suite)

No automated Playwright suite exists in this repo yet (a prior version of
this document claimed scaffolding at `apps/web/e2e/` — that directory never
existed; this is the correction). What *was* done, by hand, for each
phase's new UI: a real Chromium browser, driven by Playwright, against the
actual dev servers and the actual database — not mocks. Phase 2 walked the
full client-portal requirement-fill journey and the staff-side CRM/
onboarding/builder flow end to end on real rendered DOM state (see the
previous revision of this section for that detail — still accurate, not
repeated here).

**Phase 3's browser verification** covered the new project engine
end to end: build a project template through the builder UI (add a phase,
a milestone, and a task, each via its own dialog), save it, confirm no
validation-error banner appears, instantiate it onto a new project, and
confirm the instantiated project's Phases and Tasks tabs actually show the
phase and task that came from the template — not just that instantiation
returned `201`. Separately: open a task's detail dialog from the board,
edit its description, post a comment and see it render, close the dialog,
go to the Phases tab and add a phase/milestone and mark the milestone
complete, and visit every new tab (Timeline, Calendar, Workload, Activity,
Overview, Members, Deliverables) and confirm each renders without a
JavaScript page error. Separately again, and most security-sensitive: a
full client-portal accept-invite flow through the real UI (reading the
invite token out of the `EmailLog` table, same as Phase 2's pattern),
landing on the portal dashboard, opening the shared project, and asserting
on live DOM that a `CLIENT_VISIBLE` task's title is rendered while a
plain `INTERNAL` task's title is *not present anywhere in the page* —
the same assertion the e2e test makes at the HTTP-response level, now
also confirmed at the rendered-page level. All of it passed. As before,
these scripts were throwaway verification, not committed — see "Known
limitations" below for why a real, committed Playwright suite is still the
recommended next step rather than re-deriving this by hand indefinitely.

## Known limitations (honest status, not "minor known bugs")

- No committed Playwright (or other browser-automation) E2E suite exists —
  see "Browser verification" above for what was actually exercised, by hand,
  for this phase's new screens. Full critical-path E2E coverage (the 22
  flows in the original spec's §83) also needs project/deliverable/approval
  UI that isn't built yet; a real suite is worth adding once those screens
  exist too, rather than in two passes.
- No load/performance testing has been run against this build; it has not
  been validated at production data volumes.
- Security testing this phase = the authz/tenancy/CSRF/rate-limit
  integration tests above. Broader penetration-style testing (IDOR sweep
  across every future endpoint, upload of malicious file types, rate-limit
  bypass) should be re-run as each new module ships, and a dedicated pass is
  recommended before production launch (see architecture.md Phase 9).
- **The Android `:app` module and both Dockerfiles were written and
  reviewed but could not be compiled or run in this development sandbox**:
  the sandbox's network policy blocks `dl.google.com` (where the Android
  Gradle Plugin, Hilt's Android artifacts, and Jetpack libraries are hosted)
  and no Docker daemon is available here. `:core-network` — the pure-Kotlin
  module holding the actual networking/auth business logic — has zero
  Android/Google-Maven dependencies specifically so it *could* be built and
  tested here, and it was (7/7 passing, real HTTP-level tests against
  MockWebServer, not mocks standing in for the network). The `:app` module
  (Compose UI, Hilt wiring, DataStore, biometric gating) and the two
  Dockerfiles will get their first real build/run in `mobile-app`'s CI job
  or on a developer machine with unrestricted network access — either
  environment can reach `dl.google.com` and a Docker daemon, which this one
  cannot. Adjusting this sandbox's network policy to allow `dl.google.com`
  would let a future session verify `:app` in-sandbox too.
