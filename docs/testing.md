# ClientOS — Testing

## Philosophy

Per the project's QA loop: build → run → test → inspect → find defects → fix
→ test again. A feature is not done because it compiles; it is done when its
tests pass against a real Postgres database and its critical failure modes
(unauthorized access, cross-tenant access, invalid input) are covered.

## Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | Jest | Pure logic: permission matrix resolution, form conditional-logic evaluator, project health calculator, requirement readiness scorer, CSRF guard exemption rules. |
| Integration (API) | Jest + Supertest + real Postgres (`clientos_test` db) | Full HTTP request → guard → controller → service → Prisma → Postgres round trip. Migrations are applied to `clientos_test` once (`prisma migrate deploy`, see CI/CD below); each test file then truncates all tables in a `beforeEach` so tests never see another test's rows. |
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

## Current results (last full run)

| Suite | Count | Status |
|---|---|---|
| `packages/shared` unit (Vitest) | 20 | ✅ passing |
| `apps/api` unit (Jest) | 15 | ✅ passing |
| `apps/api` integration/e2e (Jest + Supertest + Postgres) | 39 | ✅ passing |
| `apps/web` unit/component (Vitest + Testing Library) | 17 | ✅ passing |
| `mobile/core-network` unit (JUnit 5 + MockWebServer) | 7 | ✅ passing |
| **Total** | **98** | ✅ all passing |

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

## Known limitations (honest status, not "minor known bugs")

- Playwright E2E scaffolding exists (`apps/web/e2e/`) but full critical-path
  E2E coverage (the 22 flows in the original spec's §83) requires the client
  portal, file upload, and approval UI that are not yet built — those tests
  will be added alongside those features rather than written against
  not-yet-existing screens.
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
