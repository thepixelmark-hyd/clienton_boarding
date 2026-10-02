# ClientOS — Database

PostgreSQL 16, managed through Prisma (`packages/database/prisma/schema.prisma`).

## Conventions

- **Primary keys**: `cuid()` strings — sortable-ish, collision-resistant,
  safe to expose in URLs (unlike sequential ints, which leak record counts
  and enable enumeration).
- **Tenancy**: every org-scoped model has `organizationId String` with an
  index, and a relation to `Organization` with `onDelete: Cascade` (deleting
  an org — an admin-only, confirmed, soft action — cleans up its data).
- **Soft delete**: models where history matters for audit/compliance
  (`Client`, `Project`, `Task`, `Requirement`, `Asset`, `Approval`,
  `ChangeRequest`) carry `deletedAt DateTime?`. Deletion sets this field;
  reads default to `deletedAt: null` via the repository layer. Hard deletion
  is a platform-admin-only operation, not exposed in the app.
- **Concurrency**: mutable collaborative records (`Client`, `Contact`, `Task`,
  `Requirement`, `Project`, `Deliverable`) carry `version Int @default(1)`.
  Updates require the client to send the version it last read; a mismatch
  returns `409 CONFLICT` rather than silently overwriting (§92). On
  `Requirement` specifically, `version` also drives `RequirementVersion`
  (below): every version bump snapshots the prior state, so this field is
  both an optimistic-concurrency guard and a history pointer. `ProjectPhase`
  and `Milestone` deliberately do *not* carry `version` — low-contention
  records (one PM plans a project's phases, not a team editing concurrently)
  where the added friction of a version field isn't worth it; see
  `ProjectsService`.
- **Audit**: `createdAt`, `updatedAt` on every model; sensitive mutations
  additionally write an `AuditLog` row (actor, entity, action, before/after
  diff) — see `security.md`.
- **Enums over free text** for anything with a fixed vocabulary (status,
  role, visibility) so the database itself rejects invalid states.

## Core entities (this phase)

- `Organization`, `Membership` (User × Org × Role), `Team`, `TeamMember`
- `User`, `Session`, `Invitation`
- `Client`, `Contact` (client-side people, with a `ContactRole` stakeholder
  tag — decision maker, champion, technical contact, etc. — alongside the
  narrower `isPrimary`/`isDecisionMaker`/`isBillingContact` flags),
  `ClientPortalUser` (portal login identity, distinct from internal `User`),
  `ClientPortalSession` (mirrors `Session`, scoped to portal users only),
  `ClientInvitation` (the portal's own invitation flow, distinct from staff
  `Invitation` — different token namespace, grants a `ClientPortalRole` not
  an `OrgRole`)
- `ClientOnboardingItem` — one row per step for a client's onboarding
  checklist, instantiated from a code-defined catalog
  (`packages/shared/src/onboarding.ts`) the same way form templates work
- `ProjectTemplate` — a reusable blueprint (phases/milestones/tasks, stored
  as JSON arrays keyed by an author-chosen `key` string rather than child
  rows — see architecture.md "Project templates") that
  `ProjectTemplatesService.instantiate` resolves into real `Project`/
  `ProjectPhase`/`Milestone`/`Task` rows in one transaction. `Project.
  sourceTemplateId` (nullable, `onDelete: SetNull`) remembers which template
  a project came from, same "remember the origin, never block on it
  existing" relationship as `Form.templateKey`.
- `Project`, `ProjectMember`, `ProjectPhase`, `Milestone`
- `ProjectActivityEvent` — an append-only, human-readable feed (project
  created, task moved to Done, milestone completed, deliverable created, a
  requirement linked, ...) written alongside the mutation that caused it,
  distinct from `AuditLog`'s generic before/after diff — see
  `ProjectActivityService`.
- `Task` (self-relation `parentTaskId` for subtasks; `waitingOnClient` +
  `waitingOnClientNote` flag a task that's stalled on something only the
  client can provide — orthogonal to `status`, since a task can be
  `IN_PROGRESS` *and* waiting on the client at once), `TaskDependency`
- `Deliverable` (now carries `version` for optimistic concurrency and an
  optional `dueDate`), `DeliverableRequirement` (join table realizing the
  requirement→deliverable half of the traceability spine) — both halves of
  the spine are now populated by real application code, not just seed data:
  `DeliverablesService` manages the requirement link, and `Task.
  deliverableId` (already modeled) is set directly through the existing task
  create/update endpoints. See `architecture.md` "The traceability spine."
- `Form` (`isTemplate` marks a reusable org-level template authored via the
  form builder, as opposed to a project/client-scoped instance;
  `conflictRules` JSON — copied from its template at instantiation — drives
  automatic conflict detection at submit time), `FormField` (with
  `conditionalRule` JSON for branching logic, `minSelections`/`maxSelections`
  for `MULTI_SELECT`), `FormSubmission`, `FormResponse` (one row per field
  per submission — preserves the original client answer forever, per
  §21/§56: AI or staff summaries never overwrite source responses),
  `FormResponseFile` (uploaded files for `FILE_UPLOAD`/`IMAGE_UPLOAD`/
  `VIDEO_UPLOAD` fields — see `security.md` "File security")
- `Requirement` (a reviewed/normalized view over a `FormSubmission`, carrying
  readiness status: `MISSING | NEEDS_CLARIFICATION | READY | CONFLICTING`,
  a staff-editable `summary` distinct from the raw `FormResponse` rows, and
  `version`), `RequirementVersion` (an immutable snapshot written every time
  a requirement is reviewed, reopened, or resubmitted — never edited, same
  append-only principle as `Approval`)
- `Asset`, `AssetVersion`
- `Comment` (polymorphic via `entityType`/`entityId`, `visibility` enum)
- `Approval` (immutable history: each decision is a new row, never edited)
- `ChangeRequest`
- `Notification`
- `AuditLog`
- `EmailLog` — every email the app attempts to send, real or
  console-logged-only (see `security.md` "Email")
- `CSAT`
- `TimeEntry`

Full field-level detail is in the Prisma schema itself, which is the source
of truth — this document explains *why*, the schema explains *what*.

## Indexing strategy

- Every foreign key is indexed (Prisma does this by default for relations
  used in `@relation`, verified explicitly for composite lookup patterns
  like `(organizationId, status)` on `Task` and `Project`, which back the
  most common list-screen queries).
- `FormResponse(submissionId, fieldId)` composite unique — one answer per
  field per submission.
- `AuditLog(organizationId, createdAt)` for the audit timeline query.
- Full-text: `Client.name`, `Project.name`, `Task.title` get a
  `tsvector`-backed index (raw SQL migration) for the Phase 1 search
  implementation, per `architecture.md`'s Postgres-FTS-first search decision.

## Migrations

Managed by `prisma migrate dev` in development and `prisma migrate deploy`
in CI/production. Every schema change is a checked-in migration file under
`packages/database/prisma/migrations/` — the schema is never hand-edited in
a running database.

## Transactions

Multi-row writes that must be atomic (e.g. "submit form → create
Requirement → write AuditLog", or "approve change request → update Project
scope → create Tasks") are wrapped in `prisma.$transaction(...)`.
