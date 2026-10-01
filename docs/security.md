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
- **Client portal is a second, fully independent auth system** — not the
  staff login with a different role. A `ClientPortalUser` is not a `User`
  row; a `ClientPortalSession` is not a `Session` row; the cookie name
  (`clientos_portal_session`) is different from the staff cookie
  (`clientos_session`); and `ClientInvitation` is a separate token namespace
  from the staff `Invitation` model. The only things shared with staff auth
  are the *security properties* (argon2id, the same token-hashing scheme,
  the same session TTL) — deliberately, not the tables. `PortalAuthGuard`
  resolves the portal cookie exactly the way `SessionAuthGuard` resolves the
  staff one, and is registered globally right after it (see
  `apps/api/src/app.module.ts`) specifically so it can tag
  `request.authSource = "cookie"` early enough for `CsrfGuard` to cover
  portal mutations too — a module-local guard would run too late for that.
  A staff session can never reach a `/portal/*` route and a portal session
  can never reach a staff route; each guard checks its own named cookie only
  and `@RequirePortalAuth()`/`@Public()` are both applied per route to keep
  the two boundaries from leaking into each other.

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
- **Client portal permissions**: `clientPortalPermissionMatrix` in
  `packages/shared/src/roles.ts` is resource-aware (`requirement`,
  `onboarding`, `project`, `deliverable`, `invoice`, `team`), checked by
  `PortalPermissionsGuard` — the portal's own `PermissionsGuard` equivalent,
  module-local rather than global since only portal routes use it. Only
  `CLIENT_ADMIN`/`CLIENT_MANAGER` can fill in and submit a requirement form
  by default; other portal roles (`STAKEHOLDER`, `APPROVER`, `VIEWER`,
  `BILLING_CONTACT`) can view and comment but not edit — a real engagement
  usually has one or two named people who own the brief while a wider
  stakeholder group stays informed, not everyone editing the same form.
- **Tenant isolation for the portal is stricter than for staff**: a staff
  session is scoped by `organizationId` alone (one org = one tenant). A
  portal session is additionally scoped by `clientId`, because two different
  `Client` records in the *same* organization must not reach each other's
  forms/files by guessing an id — `organizationId` matching isn't enough.
  Every portal-facing query either takes `clientId` directly
  (`FormsService.listForClientPortal`) or calls
  `FormsService.assertFormBelongsToClient`/`FormsUploadService.
  getFileForClient` before delegating to the organization-scoped internal
  method. Verified by a dedicated integration test
  (`apps/api/test/client-portal.e2e-spec.ts`) where a portal user for Client
  A gets `404` reading or writing Client B's requirement, not just an empty
  list.
- **Tenant isolation (staff)**: see `architecture.md` — enforced at guard +
  query layer, verified by integration tests that attempt cross-tenant reads.
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
  cases (bearer, GET/HEAD, missing vs. wrong header). The guard's own check
  (`authSource === "cookie"`) is transport-agnostic, so it covers client
  portal cookie mutations the same way it covers staff ones — see "Client
  portal is a second, fully independent auth system" above for why
  `PortalAuthGuard` has to run where it does for that to be true.

## File security

- Uploads (form `FILE_UPLOAD`/`IMAGE_UPLOAD`/`VIDEO_UPLOAD` fields, client
  logos) are validated before anything is persisted: a MIME-type allow-list
  per field type, a hand-rolled magic-byte signature check against the
  actual bytes (`apps/api/src/storage/file-signature.ts`) — never trusting
  the browser-supplied `Content-Type` header — and a per-type size limit
  (5MB logos, 10MB images, 20MB documents, 100MB video).
- Storage keys are server-generated (`${organizationId}/${randomUUID()}`),
  never derived from the client-supplied filename, and `LocalDiskStorageProvider`
  re-validates that a resolved path can't escape its storage root even
  though every caller already only ever passes a key it generated itself.
- Files are never served from a public path. Every download
  (`GET /files/:fileId`, `GET /clients/:id/logo`) re-checks authorization for
  that specific file — tenant-scoped for staff, tenant-*and-client*-scoped
  for the portal (see "Client portal tenant isolation" above) — not just a
  path that happens to be hard to guess.
- **Known limitation, disclosed rather than silently skipped**: the active
  `StorageProvider` is local-disk (`apps/api/src/storage/
  local-disk-storage.provider.ts`) — correct for a single instance, but it
  does not survive a redeploy on most hosts and does not work across
  multiple API instances behind a load balancer. An S3-compatible provider
  behind the same interface is the production upgrade; swapping it in is a
  single new class, nothing above the interface needs to change.

## Email

- `EmailService` (`apps/api/src/email`) sends through whichever
  `EmailProvider` is bound: `SmtpEmailProvider` (real delivery via
  nodemailer) when `SMTP_HOST` is configured, `ConsoleEmailProvider`
  otherwise — the default in every environment that hasn't set real SMTP
  credentials, including this one. The console provider never silently
  pretends to send: it logs loudly and writes a real `EmailLog` row, so an
  invitation flow is fully testable and auditable without a mail server —
  the same honesty principle as the local-disk `StorageProvider` above. Both
  providers write `EmailLog` regardless, so delivery is inspectable the same
  way either way.
- An email failure never breaks the mutation that triggered it — an
  invitation row is still created even if `SmtpEmailProvider`'s send call
  throws; the error is logged, not propagated.
- Wired to: staff invitations, client portal invitations, and a
  requirement-submitted notice to the organization's owners/admins/account
  managers (not every member, to avoid noise).

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

MFA/2FA, OAuth login, device/session management UI (staff or portal),
object-level `ProjectMember` permission checks (tracked in
`docs/architecture-assessment.md` §8/§21 risk #3 — this is about *internal*
project visibility and is unrelated to the client-portal tenant isolation
work done this phase, which is a different, now-closed gap), dependency/SAST
scanning in CI (`.github/workflows/ci.yml` runs lint/typecheck/build/test,
not a security scanner), encryption-at-rest for the Android token store and
for uploaded files on local disk (both noted above), an S3-compatible
production storage backend (noted above), real SMTP credentials in any
environment including this one (console/log delivery only until
`SMTP_HOST` is configured), backup/restore runbook. Rate limiting and CSRF
header enforcement — previously listed here as gaps found during the
architecture assessment — are implemented; see Authentication and Input
validation above.
