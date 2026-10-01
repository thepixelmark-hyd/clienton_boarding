# ClientOS — API

Base path: `/api/v1`. OpenAPI/Swagger UI served at `/api/docs` (non-production).

"session" auth below accepts either transport: the `httpOnly` cookie the web
app receives on signup/login, or `Authorization: Bearer <token>` (the same
`session.token` value, used by the Android app) — see `security.md`. Every
cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` must also carry
`X-Requested-With: XMLHttpRequest` or it is rejected as a CSRF precaution;
bearer-authenticated requests are exempt. `/auth/login` and `/auth/signup`
are rate-limited (20 requests/60s per client); every other endpoint shares a
separate, more permissive global limit (300/60s).

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/signup | none (rate-limited) | Creates Organization + owner User in one transaction; returns `session.token` for mobile clients alongside the cookie |
| POST | /auth/login | none (rate-limited) | Email+password → session cookie + `session.token` |
| POST | /auth/logout | session | Revokes current session |
| POST | /auth/logout-all | session | Revokes every session for the current user |
| GET | /auth/me | session | Current user + org memberships |
| POST | /invitations | session (Admin+) | Invite a user to the org by email+role |
| POST | /invitations/:token/accept | none | Accept invite, set password |

## Clients

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /clients | session | Paginated list, filter/search |
| POST | /clients | session (role: create:client) | |
| GET | /clients/:id | session, object check | |
| PATCH | /clients/:id | session, role+version check | Optimistic concurrency |
| DELETE | /clients/:id | session, role | Soft delete, confirmation required client-side |
| POST | /clients/:id/contacts | session | |
| PATCH | /clients/:id/contacts/:contactId | session, version check | |
| DELETE | /clients/:id/contacts/:contactId | session | Soft delete |
| POST | /clients/:id/logo | session (multipart) | Image allow-list + magic-byte check, max 5MB |
| GET | /clients/:id/logo | session | Streams the uploaded logo |
| POST | /clients/:id/onboarding/start | session | Instantiates the default checklist (idempotent) |
| GET | /clients/:id/onboarding | session | List checklist items |
| PATCH | /clients/:id/onboarding/:itemId | session | Updates item status; rolls `Client.onboardingStatus` up to `COMPLETED` once every required item is `DONE` |
| POST | /clients/:id/invitations | session (role: invite:client) | Invites an email to the client portal; sends (or logs) an email |
| GET | /clients/:id/invitations | session | |
| DELETE | /clients/:id/invitations/:invitationId | session | Revokes a pending invitation |
| GET | /clients/:id/portal-users | session | Active portal accounts for this client |

## Forms (builder)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /forms?isTemplate= | session | List org forms (builder templates and/or project-scoped) |
| POST | /forms | session | Creates a blank form; no client/project → a reusable template |
| GET | /forms/:formId | session | Form + its fields, for the builder UI |
| POST | /forms/:formId/fields | session | Adds a field |
| PATCH | /forms/:formId/fields/:fieldId | session | |
| DELETE | /forms/:formId/fields/:fieldId | session | |
| PATCH | /forms/:formId/fields-order | session | Reorders all fields in one call |
| POST | /forms/:formId/submissions | session | Starts a DRAFT submission against an existing form for a project (instantiating a template copies its fields first) |

Field mutations are rejected with `400` once any submission exists against a
non-template form — see `architecture.md`.

## Projects / Tasks

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /projects | session | |
| POST | /projects | session | |
| GET | /projects/:id | session, object check | Includes computed `health` |
| PATCH | /projects/:id | session, version check | |
| GET | /projects/:id/tasks | session | |
| POST | /projects/:id/tasks | session | |
| PATCH | /tasks/:id | session, version check | |

## Requirements

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /forms/templates | session | Built-in template catalog (e.g. Logo Design questionnaire) |
| POST | /projects/:id/requirements | session | Instantiates a hardcoded template onto the project: creates a `Form` (copied fields) + a `DRAFT` `FormSubmission` |
| GET | /forms/:formId/submissions/:submissionId | session | Form + current draft answers |
| PUT | /forms/:formId/submissions/:submissionId/responses | session | Upserts `FormResponse[]` — safe to call repeatedly (autosave). Rejects a malformed value (wrong type, an option not on the field, a `MULTI_SELECT` outside its min/max) with `400` before saving anything |
| POST | /forms/:formId/submissions/:submissionId/submit | session | Marks the submission `SUBMITTED`; computes readiness and auto-detects conflicts from the form's `conflictRules`; creates (or, after a reopen, updates) the `Requirement` and snapshots a `RequirementVersion` |
| GET | /requirements/:id | session | Requirement + submission + responses + readiness |
| GET | /requirements?projectId= | session | List requirements for a project |
| POST | /requirements/:id/review | session | Reviewer decision: `{decision: "READY"\|"NEEDS_CLARIFICATION", note?, addConflicts?}` — versioned |
| POST | /requirements/:id/reopen | session | Unlocks a `NEEDS_CLARIFICATION` requirement's submission for editing again; `400` from any other state |
| PATCH | /requirements/:id/summary | session | Staff-edited summary, distinct from the auto-generated one `submit` writes — versioned |
| GET | /requirements/:id/versions | session | Full `RequirementVersion` history, newest first |

## File uploads

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /forms/:formId/submissions/:submissionId/fields/:fieldId/files | session (multipart) | Only for `FILE_UPLOAD`/`IMAGE_UPLOAD`/`VIDEO_UPLOAD` fields; MIME allow-list + magic-byte check against the actual bytes, per-type size limit |
| GET | /forms/:formId/submissions/:submissionId/fields/:fieldId/files | session | List uploaded files for a field |
| GET | /files/:fileId | session | Streams the file |
| DELETE | /files/:fileId | session | Only before the submission is `SUBMITTED` |

## Client portal

A fully separate authentication boundary — see `security.md` and
`architecture.md` "Mobile (Android) architecture" sibling section, "Client
portal". Session cookie name `clientos_portal_session`, never the staff
`clientos_session`; a `ClientPortalUser`, never an internal `User`. Every
endpoint below is scoped to the authenticated portal session's own
`clientId` — not just its `organizationId`, since two different Clients in
the same org must not reach each other's data.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /portal/auth/login | none (rate-limited) | Email+password → portal session cookie |
| POST | /portal/auth/logout | none | |
| GET | /portal/auth/me | portal session | Current portal user + their client |
| POST | /portal/auth/invitations/:token/accept | none | Accepts a `ClientInvitation`, creates the `ClientPortalUser`, logs in |
| GET | /portal/onboarding | portal session | This client's onboarding checklist (read-only) |
| GET | /portal/requirements | portal session | Submissions (draft + submitted) assigned to this client, each with its `Requirement` data once one exists |
| GET | /portal/forms/:formId/submissions/:submissionId | portal session | |
| PUT | /portal/forms/:formId/submissions/:submissionId/responses | portal session (role: edit) | Only `CLIENT_ADMIN`/`CLIENT_MANAGER` by default — see the portal permission matrix in `security.md` |
| POST | /portal/forms/:formId/submissions/:submissionId/submit | portal session (role: edit) | |
| POST/GET/DELETE | /portal/forms/.../fields/:fieldId/files, /portal/files/:fileId | portal session | Mirrors the internal file-upload endpoints, scoped to the portal user's own client |

## Error format

Every error response:

```json
{
  "code": "PROJECT_NOT_FOUND",
  "message": "Project could not be found.",
  "details": {}
}
```

`code` is a stable machine-readable string (see
`apps/api/src/common/errors.ts`), `message` is safe to show a user verbatim,
`details` is optional field-level validation info. Internal errors (5xx) are
logged with a correlation id server-side and return only `{"code":
"INTERNAL_ERROR", "message": "Something went wrong on our end. Try again, and
contact support if it continues.", "details": {"correlationId": "..."}}` —
never a stack trace.

## Pagination

List endpoints accept `page` (1-based) and `pageSize` (default 20, max 100)
and respond `{ data: [...], page, pageSize, total }`.
