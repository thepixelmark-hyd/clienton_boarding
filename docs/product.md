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

## Scope delivered in this engineering phase

This is a from-scratch build (the repository was empty at the start of this
phase). Given the size of the full specification (146 numbered requirement
sections spanning web, a native Android app, email/WhatsApp/meeting
integrations, a visual automation engine, AI copilot, billing, and a platform
admin console), this phase intentionally builds a **real, working, tested
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
- Client CRM: clients, contacts, client timeline, internal/client visibility.
- Requirements engine: schema-driven forms with conditional (branching)
  logic, the Logo Design questionnaire as a structured reusable template,
  submission flow, and requirement readiness scoring.
- Projects: phases, milestones, tasks, list + board views, computed project
  health with evidence.
- Seed data producing a realistic demo agency (see `seed.ts`).
- Automated tests: unit tests for guards/services and integration tests
  against a real Postgres database, including negative tests for
  cross-tenant access and role escalation.

**Architected for, not built in this phase** (explicitly flagged, not
half-implemented, per the project's own "no partial implementation" rule —
these are documented as the next engineering phases in `architecture.md`
rather than shipped as broken UI):

- Native Android app (Kotlin/Compose).
- Creative proofing/annotation canvas, file storage backend (S3), signed URLs.
- Email (Gmail/Outlook), WhatsApp Business, calendar/meeting integrations.
- Visual automation engine, AI project copilot, AI requirement analysis.
- Billing/subscription management, platform admin console, feature flags.
- Resource management, time tracking UI, financial reporting.

See `/docs/architecture.md` §"Phased roadmap" for the recommended build order
for these.

## Design principles

See `/docs/design-system.md`. In short: neutral-first, Inter-only, restrained
accent color, no decorative gradients or glow, calm and information-dense
rather than "dashboard-shaped."
