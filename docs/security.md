# ClientOS — Security

## Authentication

- Passwords hashed with **argon2id** (`argon2` package, memory cost tuned for
  server hardware, never a fast hash like bcrypt-only-cost-10 or plain
  sha256).
- Sessions are **server-side**, stored in the `Session` table, referenced by
  an opaque random token in an `httpOnly`, `secure`, `sameSite=lax` cookie —
  not a JWT in localStorage, so sessions can be enumerated and revoked
  (§69), and XSS cannot exfiltrate a usable bearer token.
- Session tokens are hashed (SHA-256) before storage, same principle as
  password storage: a database read does not hand out live credentials.
- Login is rate-limited per IP+email (in-memory limiter this phase;
  Redis-backed in production) to blunt credential stuffing.
- `POST /auth/logout` deletes the session row; "log out of all devices"
  deletes all sessions for the user.
- Org invitations use single-use, expiring (7 day) signed tokens; accepting
  one requires setting a password and does not itself grant access until the
  invite's target organization/role is applied server-side (the client
  cannot choose its own role from the accept-invite form).

## Authorization

- **Role-based**: `OWNER | ADMIN | OPERATIONS_MANAGER | PROJECT_MANAGER |
  ACCOUNT_MANAGER | TEAM_LEAD | EMPLOYEE | CONTRACTOR | FINANCE | VIEWER` at
  the organization level; `CLIENT_ADMIN | CLIENT_MANAGER | STAKEHOLDER |
  APPROVER | VIEWER | BILLING_CONTACT` at the client-portal level. Full
  permission matrix lives in `apps/api/src/auth/permissions.ts` as data (not
  scattered `if` statements), so it's auditable in one place.
- **Object-level**: project visibility additionally checks `ProjectMember`
  for roles below Admin/Owner — an Employee not assigned to a project cannot
  read it even though they're in the org.
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
- CSRF: since auth is cookie-based, state-changing requests require a
  custom `X-Requested-With` header (checked server-side) in addition to
  `sameSite=lax`, which blocks the common CSRF vectors for cookie auth.

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
requirement/scope change, approval decision, invitation) writes an
`AuditLog` row with actor, timestamp, entity type/id, action, and a
before/after value diff. This is append-only from the application's
perspective — there is no update/delete endpoint for `AuditLog`.

## What was verified this phase

- Automated integration tests assert: a session for Org A's user gets `404`
  reading Org B's client/project records; a `VIEWER` gets `403` attempting a
  write; an unauthenticated request gets `401`; a tampered/unknown session
  cookie is rejected; passwords are not returned in any API response
  (checked via response-shape assertions, not just by convention).
- Manual review confirmed no endpoint accepts `organizationId` from the
  request body/query for authorization purposes.

## Explicitly not yet implemented (see architecture.md roadmap)

MFA/2FA, OAuth login, device/session management UI, WAF-style rate limiting
at the edge, dependency/SAST scanning in CI, backup/restore runbook. These
are Phase 9 (final security hardening) items and are called out here so they
are not mistaken for oversights.
