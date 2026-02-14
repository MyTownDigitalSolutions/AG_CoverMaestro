---
trigger: always_on
---

PURPOSE

Ensure the project complies with the global database policy:

policy-database-development.md


This checklist MUST be explicitly confirmed before proceeding past this phase.

REQUIRED CONFIRMATIONS

The agent must respond with YES / NO + explanation for each item.

1️⃣ Live Dev/Test Database

☐ A live, hosted dev/test database is planned or selected

☐ The dev/test database is isolated from production

☐ The dev/test database is safe to reset/reseed

2️⃣ Local Development Support

☐ Local development does not require production credentials

☐ Local schema is compatible with dev/test schema

☐ Any known differences are explicitly documented

3️⃣ Safe Reset & Seeding

☐ A reset/reseed strategy exists (even if manual)

☐ Seed data is realistic enough to exercise core workflows

☐ Reset actions cannot affect production data

4️⃣ Offline Capability (Tiered)

☐ MVP offline tier is explicitly selected:

☐ Tier 1 — Read-only offline

☐ Tier 2 — Offline-tolerant writes

☐ Supported offline actions are documented

☐ Unsupported offline actions are explicitly stated

5️⃣ Data Integrity & Replay Safety

☐ Writes are idempotent where possible

☐ Offline or queued writes have a defined replay behavior

☐ Historical data is not silently overwritten

6️⃣ Documentation

☐ Dev/test DB setup steps are documented

☐ Reset/reseed instructions are documented

☐ Offline behavior and limitations are documented

FINAL DECLARATION (MANDATORY)

The agent must conclude with exactly one of the following:

✅ If compliant:
DATABASE POLICY COMPLIANCE: CONFIRMED
All mandatory requirements from policy-database-development.md are satisfied.

⛔ If NOT compliant:
DATABASE POLICY COMPLIANCE: NOT MET
The following items do not comply and require approval:
- [list items with justification]


If compliance is NOT confirmed, the agent MUST STOP.