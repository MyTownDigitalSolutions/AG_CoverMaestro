---
trigger: always_on
---

PHASE: B
CHUNK ID: PHASE B — CHUNK 2
CHUNK TITLE: Backend Catalog API
🔒 EXECUTION AUTHORITY (MANDATORY)

This document does NOT grant execution permission by itself.

Execution is authorized ONLY when the most recent user message contains an explicit approval token in the exact format:

APPROVE::PHASE_B::CHUNK_2


No other wording, confirmation, plan approval, or acknowledgement constitutes approval.

If the approval token is not present:

❌ No file reads

❌ No file writes

❌ No dependency installs

❌ No commands

❌ No router registration

❌ No task.md updates

The agent must STOP and request approval.

1️⃣ INTENT (Single Responsibility)

Implement the backend API for managing the core catalog entities: Manufacturers, Series, and Equipment Models.

Does: Define Pydantic schemas for Catalog entities.

Does: Implement FastAPI router for CRUD operations.

Does: Connect to Supabase via the existing DB client.

2️⃣ SCOPE (ALLOWED CHANGES ONLY)

Allowed:

server/schemas/catalog.py (New – Pydantic Models)

server/routers/catalog.py (New – API Routes)

server/main.py (Register Router)

server/tests/test_catalog.py (New – Tests)

shared/ (Optional ONLY if explicitly required and approved)

Explicitly OUT OF SCOPE:

Frontend UI

Materials

Pricing

Orders

Any other PHASE B chunks

3️⃣ FILES / AREAS TO BE TOUCHED

server/ workspace ONLY

No other directories may be read or modified.

4️⃣ DEPENDENCIES & ASSUMPTIONS

Assumes:

Database tables (manufacturers, series, equipment_models) exist
(Created in Phase A — Chunk 4)

Supabase client is functional

No new dependencies may be introduced without explicit approval.

5️⃣ IMPLEMENTATION NOTES

Use Pydantic v2

RESTful patterns:

GET /manufacturers

POST /manufacturers

GET /manufacturers/{id}/series

GET /equipment (with filters)

Error handling:

404 if not found

400 for validation errors

6️⃣ TESTING & VALIDATION

Validation methods:

pytest integration tests (preferred)

Manual curl / Swagger UI verification

Tests to run:

pytest server/tests/test_catalog.py


Expected outcomes must be reported before marking completion.

7️⃣ SAFETY & REVERSIBILITY

Reversible: Yes (delete files, unregister router)

Destructive: No

Data-affecting: No

🔒 VIOLATION HANDLING (MANDATORY)

If any execution occurs without the explicit approval token:

All changes are NON-COMPLIANT

All changes must be reverted

Execution must halt immediately

task.md must NOT be updated

FINAL DECLARATION (MANDATORY)
CHUNK READY FOR EXECUTION
STOP — awaiting explicit approval token.