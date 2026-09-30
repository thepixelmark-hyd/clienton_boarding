# ClientOS — Testing

## Philosophy

Per the project's QA loop: build → run → test → inspect → find defects → fix
→ test again. A feature is not done because it compiles; it is done when its
tests pass against a real Postgres database and its critical failure modes
(unauthorized access, cross-tenant access, invalid input) are covered.

## Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | Jest | Pure logic: permission matrix resolution, form conditional-logic evaluator, project health calculator, requirement readiness scorer. |
| Integration (API) | Jest + Supertest + real Postgres (`clientos_test` db) | Full HTTP request → guard → controller → service → Prisma → Postgres round trip. Each test file resets its schema via `prisma migrate reset --force` in a `beforeAll` (test DB only). |
| Component (web) | React Testing Library | Design-system components: forms validate, buttons disable while loading, empty/error states render. |
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

## Current results (last full run)

| Suite | Count | Status |
|---|---|---|
| `packages/shared` unit (Vitest) | 20 | ✅ passing |
| `apps/api` unit (Jest) | 7 | ✅ passing |
| `apps/api` integration/e2e (Jest + Supertest + Postgres) | 24 | ✅ passing |
| `apps/web` component (Vitest + Testing Library) | 10 | ✅ passing |
| **Total** | **61** | ✅ all passing |

Also verified at last full run: `pnpm -r typecheck`, `pnpm -r lint`, and `pnpm -r build` all pass with zero errors and zero warnings across `packages/shared`, `packages/database`, `apps/api`, and `apps/web`.

## Running tests

```bash
pnpm --filter @clientos/api test          # unit
pnpm --filter @clientos/api test:e2e      # integration, needs clientos_test db
pnpm --filter @clientos/web test          # component tests
pnpm test                                 # everything, from repo root
```

## Known limitations (honest status, not "minor known bugs")

- Playwright E2E scaffolding exists (`apps/web/e2e/`) but full critical-path
  E2E coverage (the 22 flows in the original spec's §83) requires the client
  portal, file upload, and approval UI that are not yet built — those tests
  will be added alongside those features rather than written against
  not-yet-existing screens.
- No load/performance testing has been run against this build; it has not
  been validated at production data volumes.
- Security testing this phase = the authz/tenancy integration tests above.
  Broader penetration-style testing (IDOR sweep across every future
  endpoint, upload of malicious file types, rate-limit bypass) should be
  re-run as each new module ships, and a dedicated pass is recommended
  before production launch (see architecture.md Phase 9).
