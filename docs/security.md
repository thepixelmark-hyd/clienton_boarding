# ClientOS — Security

## Authentication

- Passwords hashed with **argon2id** (`argon2` package, memory cost tuned for
  server hardware, never a fast hash like bcrypt-only-cost-10 or plain
  sha256).
- Sessions are **server-side**, stored in the `Session` table, referenced by
  an opaque random token — not a JWT, so sessions can be enumerated and
  revoked (§69), and XSS cannot forge a usable one out of thin air. Two
  transports carry that same token, resolved by the same `SessionAuthGuard`
  against the same `Session` row:
  - **Web**: an `httpOnly`, `secure`, `sameSite=lax` cookie. The browser
    never exposes it to JS, so XSS cannot exfiltrate it either.
  - **Mobile (Android)**: `Authorization: Bearer <token>`, since a native
    app has no cookie jar shared with a browser. The token is persisted in
    Jetpack DataStore behind the app's biometric unlock gate (see
    `mobile/app/src/main/kotlin/.../data/DataStoreTokenStore.kt` and
    `BiometricAuthManager.kt`) — DataStore itself is sandboxed to the app
    by the OS but not encrypted at rest; encrypting the stored value with
    `androidx.security.crypto` (already a dependency) is the next hardening
    step, called out rather than silently skipped.
  `SessionAuthGuard.extractToken()` checks the `Authorization` header first
  and falls back to the cookie, tagging the request with which one was used
  (`request.authSource`) — this tag is what the CSRF guard below keys off.
- Session tokens are hashed (SHA-256) before storage, same principle as
  password storage: a database read does not hand out live credentials.
- **Login/signup are rate-limited**: `@nestjs/throttler`, scoped to just
  those two routes (`POST /auth/login`, `POST /auth/signup`) rather than
  globally, at 20 requests/60s per client — enough headroom for a person
  mistyping a password, not enough for a credential-stuffing loop. A
  separate, more permissive global default (300 req/60s) covers the rest of
  the API against gross abuse without interfering with normal use. See
  `apps/api/test/rate-limiting.e2e-spec.ts`.
- `POST /auth/logout` deletes the session row; "log out of all devices"
  deletes all sessions for the user. Both write an `AuditLog` entry
  (`LOGIN_SUCCESS` / `LOGOUT`), alongside every failed login already having
  nowhere to persist to (rate limiting above is the mitigation there, not an
  audit trail of failures).
- Org invitations use single-use, expiring (7 day) signed tokens; accepting
  one requires setting a password and does not itself grant access until the
  invite's target organization/role is applied server-side (the client
  cannot choose its own role from the accept-invite form).

## Authorization

- **Role-based**: `OWNER | ADMIN | OPERATIONS_MANAGER | PROJECT_MANAGER |
  ACCOUNT_MANAGER | TEAM_LEAD | EMPLOYEE | CONTRACTOR | FINANCE | VIEWER` at
  the organization level; `CLIENT_ADMIN | CLIENT_MANAGER | STAKEHOLDER |
  APPROVER | VIEWER | BILLING_CONTACT` at the client-portal level. Full
  permission matrix lives in `packages/shared/src/roles.ts` as data (not
  scattered `if` statements), so it's auditable in one place, and is checked
  by `apps/api/src/common/guards/permissions.guard.ts`.
- **Object-level (correction — not yet implemented):** this doc previously
  claimed project visibility checks `ProjectMember` for roles below
  Admin/Owner. It does not — `ProjectMember` rows exist in the schema but
  nothing currently reads them for authorization, so any org member with
  sufficient org-level role can read any project regardless of project
  assignment. See `docs/architecture-assessment.md` §8/§21 (risk #3) for
  the fix, prioritized ahead of calling the Projects phase complete.
- **Tenant isolation**: see `architecture.md` — enforced at guard + query
  layer, verified by integration tests that attempt cross-tenant reads.
- Every guard decision that denies access returns `404` for existence-hiding
  cases (wrong tenant) and `403` for same-tenant-wrong-role cases (the
  distinction matters: a same-org user knowing a resource exists but lacking
  permission is not a leak; a cross-tenant user learning a resource ID is
  valid, is).

## Input validation & injection defense

- All input validated server-side with Zod schemas (`packages/shared`) —
  frontend validation is UX only, never the security boundary (§77).
- Prisma's parameterized queries prevent SQL injection; the codebase has no
  raw string-interpolated SQL. The one raw-SQL usage (full-text search index
  creation, migrations) is static DDL, not user input.
- React's default escaping + a strict `Content-Security-Policy` header
  mitigate stored/reflected XSS; rich-text fields (requirement notes,
  comments) are sanitized server-side (`sanitize-html` allow-list) before
  storage, not just before render.
- `helmet` middleware sets standard secure headers
  (HSTS, X-Content-Type-Options, frame-ancestors, etc).
- **CSRF**: `CsrfGuard` rejects any cookie-authenticated mutating request
  (`POST`/`PUT`/`PATCH`/`DELETE`) that doesn't carry
  `X-Requested-With: XMLHttpRequest`, which a cross-site form POST or
  `<img>`/plain-form CSRF payload cannot attach — only same-origin
  `fetch`/XHR code can set that header, and `apps/web/src/lib/api-client.ts`
  does so on every request. The guard is scoped to `authSource === "cookie"`
  specifically: a bearer-authenticated (mobile) request is exempt, since the
  entire CSRF threat model is "a browser automatically attaches your
  credentials to a request you didn't make" — a native app's Authorization
  header is never attached automatically by anything, so there's nothing to
  forge. `sameSite=lax` remains the first layer; this is the second. See
  `apps/api/src/common/guards/csrf.guard.ts` and its spec for the exemption
  cases (bearer, GET/HEAD, missing vs. wrong header).

## File security (architected; storage adapter not yet wired — see
architecture.md "Known gaps")

- Files are never served from a public bucket path. Every download issues a
  short-lived signed URL after an authorization check specific to that
  file's `organizationId`/`visibility`.
- Upload validation: MIME-type allow-list + magic-byte sniffing (not just
  trusting the `Content-Type` header) + max size, before the file is
  persisted.

## Secrets

- All configuration via environment variables, documented in `.env.example`
  with no real values. Nothing is hardcoded. Prisma's `DATABASE_URL`,
  session secret, and (future) OAuth client secrets are read from `process.env`
  and validated at boot (`apps/api/src/config`) — the app refuses to start
  with a missing required secret rather than silently running insecurely.

## Audit logging

Every sensitive mutation (role change, permission change, deletion,
requirement/scope change, approval decision, invitation, login, logout)
writes an `AuditLog` row with actor, timestamp, entity type/id, action, and a
before/after value diff. This is append-only from the application's
perspective — there is no update/delete endpoint for `AuditLog`.

## Request tracing

Every request is tagged with a correlation ID (`X-Correlation-Id`: echoed
back if the caller supplied one, generated otherwise) by
`CorrelationIdMiddleware`, threaded through `LoggingInterceptor`'s structured
access log (`method path status durationMs correlationId org=...`) and into
`HttpExceptionFilter`'s error responses. A support request that includes the
correlation ID from a failed response can be matched to the exact server-side
log line — including which org/user made it — without needing timestamps to
line up by hand.

## What was verified this phase

- Automated integration tests assert: a session for Org A's user gets `404`
  reading Org B's client/project records; a `VIEWER` gets `403` attempting a
  write; an unauthenticated request gets `401`; a tampered/unknown session
  cookie is rejected; passwords are not returned in any API response
  (checked via response-shape assertions, not just by convention).
- Manual review confirmed no endpoint accepts `organizationId` from the
  request body/query for authorization purposes.

## Explicitly not yet implemented

MFA/2FA, OAuth login, device/session management UI, object-level
`ProjectMember` permission checks (tracked in
`docs/architecture-assessment.md` §8/§21 risk #3 — Projects/CRM/Requirements
were explicitly out of scope for this phase and were not touched),
dependency/SAST scanning in CI (`.github/workflows/ci.yml` runs
lint/typecheck/build/test, not a security scanner), encryption-at-rest for
the Android token store (noted above), backup/restore runbook. Rate limiting
and CSRF header enforcement — previously listed here as gaps found during
the architecture assessment — are now implemented; see Authentication and
Input validation above.
