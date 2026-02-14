---
trigger: always_on
---

PURPOSE

This policy defines mandatory rules for how databases are used during development, testing, and early production for all projects that require persistent data.

Its goals are to:

Enable realistic end-to-end testing using live data

Avoid mock-only development

Preserve data safety

Support future offline usage without premature complexity

Prevent database-related rework later

This policy is global and applies to all projects unless explicitly overridden.

SCOPE

This policy applies to:

Backend services

Full-stack applications

Internal tools

MVPs that rely on persistent data

This policy does not mandate a specific database, vendor, or hosting provider.

1️⃣ LIVE DATABASE REQUIREMENT (MANDATORY)
Rule

All database-backed projects MUST use a live, hosted development/test database during active development.

Rationale

Ensures real integration testing

Exposes schema, migration, and performance issues early

Avoids false confidence from mocks

Requirements

The dev/test database MUST be:

Isolated from production

Safe to reset and reseed

Treated as disposable

The system MUST be able to run against this database end-to-end

2️⃣ LOCAL DEVELOPMENT SUPPORT (MANDATORY)
Rule

Projects MUST support local development without requiring production credentials.

Acceptable approaches

Local database instance

Local proxy to dev/test database

Local emulation where appropriate

Requirements

Schema must remain compatible between local and dev/test

Differences must be documented explicitly

Local dev setup must be reproducible

3️⃣ SAFE RESET & SEEDING (MANDATORY)
Rule

The development database MUST support safe reset and reseeding.

Requirements

A documented process for:

Initial seeding

Partial reseeding

Full reset

Reset actions MUST NOT impact production data

Seed data should be realistic enough to exercise workflows

4️⃣ OFFLINE CAPABILITY — TIERED APPROACH (MANDATORY)

Offline capability is tiered. Not all projects require full offline sync.

MVP DEFAULT: Offline Tolerant

At minimum, MVPs MUST support offline tolerance, defined as one of:

Tier 1 — Read-Only Offline (Minimum Acceptable)

Cached reads for key data

No writes allowed while offline

Clear user feedback when offline

Tier 2 — Offline-Tolerant Writes (Preferred When Reasonable)

Limited writes allowed while offline

Writes are queued locally

Automatic sync on reconnect

Explicit conflict behavior (e.g., last-write-wins or manual resolve)

FUTURE ONLY: Tier 3 — True Offline Sync

Bidirectional sync

Conflict resolution

Per-record versioning

Multi-device complexity

Tier 3 MUST NOT be assumed or implemented unless explicitly required and justified.

5️⃣ OFFLINE SCOPE CLARITY (MANDATORY)
Rule

Each project MUST explicitly document:

Which data is available offline

Which actions work offline

Which actions are blocked offline

What happens on reconnect

What is NOT supported offline

Implicit or undefined offline behavior is not allowed.

6️⃣ DATA CONSISTENCY & AUDITABILITY (MANDATORY)
Rule

Systems MUST preserve data integrity across:

Online usage

Offline usage (if applicable)

Sync/replay scenarios

Requirements

Writes must be idempotent where possible

Replay-safe mechanisms must be used for queued actions

Historical records must not be silently overwritten

Overrides must be explicit and traceable

7️⃣ DOCUMENTATION REQUIREMENTS (MANDATORY)

Each project MUST document:

Dev/test DB setup steps

How to reset and reseed data

Offline tier supported (Tier 1 or Tier 2)

Known limitations and future upgrade path

Documentation may be brief but must exist.

8️⃣ ENFORCEMENT

This policy MUST be enforced in:

Phase 4 — System Architecture

Phase 5 — Tech Stack Selection

Phase 6 — Build Planning

If any part of this policy cannot be met:

It MUST be explicitly called out

It MUST be justified

It MUST be approved before proceeding

9️⃣ NON-GOALS (IMPORTANT)

This policy does NOT:

Require a specific database vendor

Require immediate offline sync

Require mobile-first design

Mandate complex conflict resolution for MVPs

FINAL NOTE

This policy exists to prevent:

Mock-driven false confidence

Painful late-stage database rewrites

Offline feature creep

Silent data corruption

When in doubt:

Prefer correctness, clarity, and simplicity over cleverness.

END OF POLICY