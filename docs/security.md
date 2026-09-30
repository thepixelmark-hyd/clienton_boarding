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
- **Correction (found during the architecture assessment, not yet
  fixed):** login is **not currently rate-limited**. No throttling
  package is installed and no attempt counter is kept anywhere. This
  line previously claimed an in-memory limiter existed — it does not.
  Brute-force login attempts are unmitigated beyond password strength
  requirements. See `docs/architecture-assessment.md` §17/§21 (risk #2)
  for the recommended fix (`@nestjs/throttler` on `/auth/login` and
  `/auth/signup`).
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
- **CSRF (correction — not yet enforced):** the web client sends a custom
  `X-Requested-With: XMLHttpRequest` header on every request intending for
  it to be a CSRF mitigation, but no guard or middleware in the API
  actually validates that header today — a request missing it is still
  processed. `sameSite=lax` alone provides partial protection (blocks
  cross-site simple form-POST forgery in modern browsers) but the intended
  second layer is not active. See `docs/architecture-assessment.md`
  §17/§21 (risk #1) for the fix.

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

## Explicitly not yet implemented (see docs/architecture-assessment.md §17/§21)

MFA/2FA, OAuth login, device/session management UI, application-level rate
limiting (corrected above — not just WAF-style edge limiting, there is none
at all yet), CSRF header enforcement (corrected above), object-level
`ProjectMember` permission checks (corrected above), dependency/SAST
scanning in CI (no CI exists yet), backup/restore runbook. These are called
out here, with the three corrections dated to this architecture assessment,
so they are not mistaken for oversights or, worse, for controls that are
already protecting production.
