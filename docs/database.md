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
- **Concurrency**: mutable collaborative records (`Task`, `Requirement`,
  `Project`) carry `version Int @default(1)`. Updates require the client to
  send the version it last read; a mismatch returns `409 CONFLICT` rather
  than silently overwriting (§92).
- **Audit**: `createdAt`, `updatedAt` on every model; sensitive mutations
  additionally write an `AuditLog` row (actor, entity, action, before/after
  diff) — see `security.md`.
- **Enums over free text** for anything with a fixed vocabulary (status,
  role, visibility) so the database itself rejects invalid states.

## Core entities (this phase)

- `Organization`, `Membership` (User × Org × Role), `Team`, `TeamMember`
- `User`, `Session`, `Invitation`
- `Client`, `Contact` (client-side people), `ClientPortalUser` (portal login
  identity, distinct from internal `User`)
- `Project`, `ProjectMember`, `ProjectPhase`, `Milestone`
- `Task` (self-relation `parentTaskId` for subtasks), `TaskDependency`
- `Deliverable`, `DeliverableRequirement` (join table realizing the
  requirement→deliverable traceability spine)
- `Form`, `FormField` (with `conditionalRule` JSON for branching logic),
  `FormSubmission`, `FormResponse` (one row per field per submission —
  preserves the original client answer forever, per §21/§56: AI or staff
  summaries never overwrite source responses)
- `Requirement` (a reviewed/normalized view over a `FormSubmission`, carrying
  readiness status: `MISSING | NEEDS_CLARIFICATION | READY | CONFLICTING`)
- `Asset`, `AssetVersion`
- `Comment` (polymorphic via `entityType`/`entityId`, `visibility` enum)
- `Approval` (immutable history: each decision is a new row, never edited)
- `ChangeRequest`
- `Notification`
- `AuditLog`
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
