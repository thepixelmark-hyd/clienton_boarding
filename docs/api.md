# ClientOS — API

Base path: `/api/v1`. OpenAPI/Swagger UI served at `/api/docs` (non-production).

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/signup | none | Creates Organization + owner User in one transaction |
| POST | /auth/login | none | Email+password → session cookie |
| POST | /auth/logout | session | Revokes current session |
| GET | /auth/me | session | Current user + active org + role |
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
| POST | /projects/:id/requirements | session | Instantiates a template onto the project: creates a `Form` (copied fields) + a `DRAFT` `FormSubmission` |
| GET | /forms/:formId/submissions/:submissionId | session | Form + current draft answers |
| PUT | /forms/:formId/submissions/:submissionId/responses | session | Upserts `FormResponse[]` — safe to call repeatedly (autosave) |
| POST | /forms/:formId/submissions/:submissionId/submit | session | Marks the submission `SUBMITTED`, computes readiness, creates the `Requirement` |
| GET | /requirements/:id | session | Requirement + submission + responses + readiness |
| GET | /requirements?projectId= | session | List requirements for a project |

The client-portal-facing versions of the submission/response endpoints
(authenticated as a `ClientPortalUser` rather than an internal `User`) are
part of the client portal module in Phase 4 — see architecture.md roadmap;
this phase's requirements engine is exercised by internal staff on the
client's behalf, which is also a real agency workflow (a PM filling in a
brief from a client call).

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
