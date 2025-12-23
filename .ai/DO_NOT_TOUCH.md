# AG_CoverMaestro — DO NOT TOUCH (Without Explicit Approval)

This file defines **locked areas** of the system.
Any agentic AI (and any developer) must **STOP and ASK** before changing anything in these sections.

If a change touches any item below, you must:
1) Explain what you want to change and why
2) List impacted files/endpoints/tables
3) Provide a test plan
4) Wait for explicit approval before making changes

---

## 1) Locked Pricing Definitions & Semantics

Do NOT change the meaning or relationship of any of these terms:

- **AreaSqIn** (stored on model; pricing must not recompute)
- **MaterialCost**
- **ShippingCost**
- **LaborCost**
- **RawCost**
- **Profit**
- **Rate** (marketplace fee rate)
- **RetailPrice**
- **MarketplaceFee**
- **BaseCost**

Renaming, redefining, or “simplifying” these concepts requires approval.

---

## 2) Locked Pricing Math (NON-NEGOTIABLE)

Do NOT change these formulas:

RawCost = MaterialCost + ShippingCost + LaborCost
RetailPrice = (RawCost + Profit) / (1 - Rate)
MarketplaceFee = RetailPrice × Rate
BaseCost = RetailPrice - Profit


- Marketplace fee must remain a **percentage of RetailPrice**.
- Profit must remain a **fixed dollar amount** (not a percentage).

---

## 3) Locked Retail Rounding Rule

Do NOT remove or modify:

- RetailPrice is rounded **UP** to the nearest price ending in **`.95`**.
- MarketplaceFee and BaseCost are derived from the **rounded** RetailPrice.

No alternate rounding schemes without approval.

---

## 4) Locked Variant Set (Always Calculate All)

Do NOT change the required set of four variants:

1) Choice Waterproof Fabric (no padding)  
2) Choice Waterproof Fabric + Padding  
3) Premium Synthetic Leather (no padding)  
4) Premium Synthetic Leather + Padding  

Do NOT change the requirement that all four are calculated on every pricing run.

---

## 5) Locked “NO FALLBACKS” Policy

Do NOT add fallback logic for:

- Missing material role assignments
- Missing preferred supplier relationships
- Missing `materials.weight_per_sq_in_oz`
- Missing shipping profiles / rate cards / tiers / zone rates
- Missing profit settings
- Missing marketplace fee rates
- Missing/invalid stored surface area

Pricing must fail with **HTTP 400** and an instructional message.

---

## 6) Locked Surface Area Policy

- Surface area must be computed during model create/update and stored on the model.
- Pricing must never compute surface area.
- If stored surface area is missing/invalid → fail (HTTP 400).

Do NOT introduce alternate/derived surface area fields without approval.

---

## 7) Locked Shipping Resolution Order

Do NOT change shipping lookup order:

Marketplace
→ Marketplace Shipping Profile
→ Rate Card
→ Pricing Zone
→ Weight Tier
→ Zone Cost


- Pricing must always use `pricing_zone`.
- Destination zone must not affect pricing unless explicitly approved.

---

## 8) Locked Data Authority & Configuration Model

Do NOT change the philosophy that pricing inputs are:

- Configurable via DB tables/settings
- Effective-dated where required
- Deterministic and auditable

Do NOT hard-code:
- Material IDs/names in pricing logic
- Labor rates/minutes
- Profit amounts
- Marketplace fee rates
- Shipping rates

---

## 9) Locked Persistence Strategy (Current + History)

Do NOT replace the two-layer persistence model without approval:

### A) Current Snapshot
- `model_pricing_snapshots` is the current authoritative state
- One row per `(model_id, marketplace, variant_key)`
- Upsert overwrites current values

### B) History Ledger (Option A)
- `model_pricing_history` is append-only (immutable audit trail)
- History rows are never updated or deleted
- History is written when values change (or if explicitly configured)

Do NOT implement snapshot “versioning” or effective-dated snapshot rows without approval.

---

## 10) Locked API Contracts (Pricing)

Do NOT rename or change response semantics of pricing endpoints without approval.

If new fields are added to responses:
- They must be additive (non-breaking)
- Frontend compatibility must be maintained

---

## 11) Locked Migration Discipline (Alembic Only)

Do NOT:
- Change schema without Alembic migration
- Depend on runtime `Base.metadata.create_all()` for schema evolution
- Drop/rename/change types without explicit approval + rollback plan

---

## 12) Locked “Helpfulness Traps” (Common AI Mistakes)

Agents must NOT:
- Refactor pricing to “clean it up”
- Replace Decimal/cents logic with floats casually
- Change rounding behavior
- Add defaults to avoid errors
- “Fix” missing data by guessing
- Compute surface area in pricing

If any of these seem necessary, STOP and ASK.

---

## 13) If You Think a Locked Change Is Needed

You must provide:

- The problem statement
- The proposed change (exactly what will differ)
- Impacted areas (files/tables/endpoints/UI)
- Migration plan (if schema)
- Test plan
- Rollback plan

Then wait for approval.

---
