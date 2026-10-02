# ClientOS — Product Specification

## What this is

ClientOS is a **Client Delivery Operating System** for agencies and professional
services firms. It connects the entire client lifecycle — onboarding,
requirement gathering, project delivery, creative review, approvals, change
requests, and client communication — into one system of record, so that every
deliverable is traceable back to the requirement that justified it.

Positioning: **not** "project management software," **not** "client onboarding
software." ClientOS is the operating system a delivery team runs client work
through, end to end.

Core promise: *Understand every client. Capture every requirement. Track every
commitment. Deliver every project.*

Core loop: **UNDERSTAND → COMMUNICATE → PLAN → EXECUTE → REVIEW → APPROVE →
DELIVER → RETAIN**

## Primary users

- **Agency team** — Owner, Admin, Operations Manager, Project Manager, Account
  Manager, Team Lead, Employee, Contractor, Finance, Viewer.
- **Client stakeholders** — Client Admin, Client Manager, Stakeholder,
  Approver, Viewer, Billing Contact. Clients never see the internal
  project-management surface — they see a purpose-built portal.

## The traceability spine

This is the single most important structural idea in the product:

```
Requirement → Deliverable → Task → Asset → Review → Feedback → Approval → Delivery
```

A requirement captured during discovery is not just a form answer — it is a
first-class record that tasks and deliverables can cite. The system must be
able to answer, at any time:

- What requirement does this task satisfy?
- What deliverables depend on this requirement?
- What approved requirement caused this scope?

This is enforced in the data model (`Deliverable.requirementLinks`,
`Task.deliverableId`) rather than left to convention — see `database.md`.

## Scope delivered across phases 1–3

This is a from-scratch build (the repository was empty at the start of
Phase 1). Given the size of the full specification (146 numbered requirement
sections spanning web, a native Android app, email/WhatsApp/meeting
integrations, a visual automation engine, AI copilot, billing, and a platform
admin console), these phases intentionally build a **real, working, tested
vertical slice** rather than a shallow pass across every surface. Everything
listed below is fully functional — authenticated, authorized, persisted, and
tested — not a mock.

**Delivered:**

- Multi-tenant data model covering the full core object graph (Organization,
  User, Membership, Team, Client, Contact, Project, Milestone, Task,
  Deliverable, Requirement/Form engine, Asset, Comment, Approval, Change
  Request, Notification, Audit Log, Invitation, CSAT, Time Entry).
- Real authentication: argon2id password hashing, server-side sessions,
  session rotation, logout/session revocation, org invitation flow.
- Tenant isolation and RBAC enforced in guards on every request — never
  trusted from the client.
- Design system foundation (tokens, Inter type scale, light/dark theme, and
  the core component set used by every screen below).
- Client CRM: clients (full edit/delete, logo upload), contacts (full
  edit/delete, stakeholder role tagging), client timeline,
  internal/client visibility.
- Client onboarding: a code-defined checklist instantiated per client,
  tracked to completion, auto-rolling the client's onboarding status up as
  required steps finish.
- Requirements engine: schema-driven forms with conditional (branching)
  logic, field-level value validation (type/shape, not just required-ness),
  a form builder for staff-authored reusable templates and project-scoped
  forms (not just the hardcoded catalog), the Logo Design questionnaire and
  Website Discovery templates as structured reusable templates, submission
  flow, requirement readiness scoring, automatic conflict detection between
  declared field pairs (e.g. a color marked both preferred and to-avoid),
  reviewer actions (mark ready / request clarification with a note and
  manually-flagged conflicts), a reopen-and-resubmit cycle, and full
  requirement version history.
- File uploads: real upload/download/delete for `FILE_UPLOAD`/
  `IMAGE_UPLOAD`/`VIDEO_UPLOAD` form fields and client logos, with a
  MIME-type allow-list and magic-byte content verification (not just a
  trusted `Content-Type` header) — see `security.md`.
- Client portal: a fully separate authenticated surface (own session cookie,
  own login/invitation flow, own permission matrix) where an invited client
  contact can view their onboarding checklist and fill in/submit assigned
  requirement forms — never the internal project-management UI.
- Email notifications: a real `EmailProvider` abstraction wired to staff and
  client-portal invitations and requirement-submitted notices — delivers for
  real once SMTP credentials are configured, logs to an inspectable
  `EmailLog` table otherwise (see `security.md` "Email").
- **Project engine (Phase 3)**: reusable project templates (phases/
  milestones/tasks blueprint, authored and edited through a real builder UI,
  validated server-side against dangling references and dependency cycles
  before it can be saved) that instantiate into a real project in one step;
  full phase and milestone management (create/edit/reorder/delete, milestone
  completion); subtasks and task dependencies with cycle detection; task
  comments; project member assignment with roles; deliverables with
  optimistic concurrency, linked to the requirements they satisfy and the
  tasks that build them — the requirement→deliverable→task traceability
  spine is now populated by real application code, not just seed data; five
  project views (list, Kanban board, a CSS-only timeline, a month calendar,
  and a workload-by-assignee view); computed project health (already
  existed) plus a genuine project dashboard whose every statistic is a real
  database aggregate, never a placeholder; an append-only project activity
  feed; a "waiting on client" state (orthogonal to task status) surfaced
  both internally and to the client; and a client-portal project dashboard
  — milestones and deliverables in full, tasks filtered to only the ones
  marked client-visible, real progress numbers, and a "waiting on you"
  section for deliverables awaiting their review and open requirements.
- Android application foundation: auth, session, navigation, and theming —
  see `architecture.md` "Mobile (Android) architecture". Project/requirement
  screens on Android are still Phase 8, not this phase.
- Seed data producing a realistic demo agency (see `seed.ts`).
- Automated tests: unit tests for guards/services/business logic and
  integration tests against a real Postgres database — including negative
  tests for cross-tenant access, role escalation, and (new this phase) a
  portal user from one client reaching another client's data in the *same*
  organization.

**Architected for, not built in this phase** (explicitly flagged, not
half-implemented, per the project's own "no partial implementation" rule —
these are documented as the next engineering phases in `architecture.md`
rather than shipped as broken UI):

- Creative proofing/annotation canvas, a deliverable approval workflow UI
  (`Approval` remains schema-only — no controller/service exists for it
  yet), an S3-compatible production storage backend (local-disk works
  today; see `architecture.md`), signed URLs for it. (The
  requirement→deliverable→task traceability spine's *linking* — the part
  this list used to flag as not built — is now real application code as of
  Phase 3; see "Delivered" above.)
- Gmail/Outlook inbox integration, WhatsApp Business, calendar/meeting
  integrations. (Outbound transactional email itself — invitations,
  submission notices — is now built; see "Delivered" above.)
- Visual automation engine, AI project copilot, AI requirement analysis.
- Billing/subscription management, platform admin console, feature flags.
- Resource management (an org-wide, cross-project workload view — the
  per-project workload view is now built; see "Delivered" above), time
  tracking UI, financial reporting.
- Project/task/requirement screens on the Android app (the auth/session/nav
  foundation is built; see "Delivered" above).

See `/docs/architecture.md` §"Phased roadmap" for the recommended build order
for these.

## Design principles

See `/docs/design-system.md`. In short: neutral-first, Inter-only, restrained
accent color, no decorative gradients or glow, calm and information-dense
rather than "dashboard-shaped."
