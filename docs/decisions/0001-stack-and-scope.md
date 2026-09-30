# ADR 0001: Stack selection and phase-1 scope

**Status**: Accepted
**Date**: 2026-09-30

## Context

The product spec (146 sections) describes a multi-year, multi-team platform:
web app, native Android app, a dozen third-party integrations, an AI
copilot, a visual automation engine, billing, and a platform admin console —
built from an empty repository in a single engineering session.

## Decision

1. Use Next.js (web) + NestJS (api) + PostgreSQL/Prisma, as directed by the
   spec's own technology-stack section, in a pnpm-workspace monorepo.
2. Build Phase 1 (architecture, database, auth, design system) to full
   production-quality depth, since every later phase depends on it being
   solid — a weak foundation compounds into rework across everything else.
3. From Phases 2-3, build complete, real, tested vertical slices (Client
   CRM, Requirements engine, Projects/Tasks) rather than a shallow pass
   across all remaining phases. A fully working slice demonstrates and
   exercises the architecture end-to-end (auth → tenancy → RBAC → UI); a
   thin layer across 12 phases would not, and would violate the spec's own
   "no partial implementation" rule (§144) at a much larger scale.
4. Explicitly defer, and document as deferred rather than fake: the Android
   app, third-party integrations (email/WhatsApp/calendar), AI features,
   the automation engine, billing, and the admin console. These require
   external accounts/credentials (OAuth apps, WhatsApp Business API,
   S3/object storage credentials, an LLM API key for the copilot) that
   don't exist in this environment, and/or are large enough to be their own
   engineering phases per the spec's own phasing (§123).

## Consequences

- The delivered system is a real, running, tested product for the agency
  workflow of: sign up → invite team → create client → gather requirements
  → plan project → track tasks to completion — not a demo.
- Anything not listed as delivered in `product.md` must not be assumed to
  exist. Feature flags are used where a partially-built surface could
  otherwise leak into the UI (see `architecture.md`).
