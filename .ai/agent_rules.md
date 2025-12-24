# AG_CoverMaestro — Agent Rules (Authoritative)

These rules are binding for all agentic AI actions in this repository.
If a request would violate these rules, STOP and ask for clarification.

---

## 1) General Behavior Rules

- ✅ Make small, targeted changes only.
- ✅ Prefer explicit, deterministic logic over “smart” heuristics.
- ✅ Keep existing naming, structure, and endpoint contracts stable.

- ❌ Do NOT refactor broadly “for cleanliness.”
- ❌ Do NOT rename tables, columns, endpoints, models, routes, or fields without approval.
- ❌ Do NOT change business formulas or pricing definitions without approval.
- ❌ Do NOT add fallback logic (“best effort”, “default”, “guess”, “if missing then use X”).
- ❌ Do NOT alter schema without an Alembic migration plan.

**Before changing anything meaningful, produce a short plan:**
- Files to change
- What behavior changes
- DB migration needed? (yes/no)
- How to test

---

## A0) Agent Interaction & Workflow Discipline (MANDATORY)

All agent-assisted work in this repository follows a strict incremental workflow.

### Required Format
All implementation guidance MUST be delivered as:
- PHASE → CHUNK
- One chunk at a time
- Explicit STOP after each chunk

### Default Assumptions
Unless explicitly stated in the chunk:
- ❌ Do NOT refactor
- ❌ Do NOT rename variables, functions, files, components, or API fields
- ❌ Do NOT change data flow or behavior
- ❌ Do NOT reorganize UI layout
- ❌ Do NOT commit
- ✅ Additive changes only
- ✅ Minimal surface area changes

### Chunk Requirements
Each chunk must include:
1) Explicit scope (allowed vs forbidden)
2) Single responsibility task
3) Deliverable (file path + code location)
4) Verification intent
5) STOP

### Safety Rule
If a request would require:
- refactoring,
- architectural changes,
- pricing definition changes,
- or unclear assumptions,

The agent MUST:
- STOP
- Explain why
- Propose a separate PHASE


## 2) Surface Area Rule (CRITICAL)

- Surface area is always computed when a model is created/updated and stored on the model.
- Pricing logic must NEVER compute surface area.
- Pricing must fail if the stored surface area is missing or invalid.

**Rule:**
- Canonical field: `model.surface_area_sq_in`

If `model.surface_area_sq_in` is NULL, zero, or invalid → HTTP 400 with an instructional error.

No alternate or derived surface-area fields may be introduced without approval.


❌ No recomputation  
❌ No fallback formulas  
❌ No silent correction  

---

## 3) Pricing Scope (Always Calculate All)

Pricing must always compute **all four variants**:

1) Choice Waterproof Fabric (no padding)  
2) Choice Waterproof Fabric + Padding  
3) Premium Synthetic Leather (no padding)  
4) Premium Synthetic Leather + Padding  

Pricing is computed **per marketplace** (default, amazon, ebay, reverb).

If any one of the four variants cannot be calculated, the entire pricing operation must fail.
Partial pricing is not allowed.


---

## 4) Material Role Resolution (STRICT — NO FALLBACKS)

Pricing resolves materials ONLY via effective-dated role assignments.

### Roles (stable API)
- `CHOICE_WATERPROOF_FABRIC`
- `PREMIUM_SYNTHETIC_LEATHER`
- `PADDING`

### Rules
- Exactly one active assignment per role at any time.
- Active assignment satisfies:
  - `effective_date <= as_of`
  - AND (`end_date IS NULL OR end_date > as_of`)
- Pricing logic must not reference material names or IDs directly.

❌ NO FALLBACKS  
If a required role is missing → fail with HTTP 400 and an instructional error.

---

## 5) Material Cost (Preferred Supplier Only)

Materials have no default cost. All costs come from supplier-material relationships where `is_preferred = true`.

Effective unit cost:
EffectiveUnitCost = unit_cost + (shipping_cost / quantity_purchased)
Padding is treated the same way via its role.

---

## 6) Material Weight (STRICT — NO FALLBACKS)

Each material used in pricing MUST provide:
- `materials.weight_per_sq_in_oz`

Variant weight:
- No padding:
  - `WeightOz = AreaSqIn × FabricWeightPerSqIn`
- With padding:
  - `WeightOz = AreaSqIn × (FabricWeightPerSqIn + PaddingWeightPerSqIn)`

❌ NO FALLBACKS  
If any required material is missing `weight_per_sq_in_oz` → HTTP 400 with a clear, instructional error.

---

## 7) Shipping Resolution (MANDATORY ORDER, STRICT)

Shipping must be resolved in this exact order:
Marketplace
→ Marketplace Shipping Profile
→ Rate Card
→ Pricing Zone
→ Weight Tier
→ Zone Cost

Rules:
- Pricing always uses the configured `pricing_zone`.
- Actual destination zone is ignored for pricing.
- Weight tiers are half-open intervals:
  - `min_oz <= weight_oz < max_oz`

❌ NO FALLBACKS  
Missing mapping/profile/rate card/tier/zone cost → HTTP 400.

---

## 8) Labor (Configurable)

Labor cost is derived from `labor_settings`:
LaborCost = labor_rate_per_hour × (minutes / 60)
- Separate minutes for padded vs non-padded variants.
- No hard-coded labor values in pricing logic.

---

## 9) Profit (Fixed Dollar Amounts)

Profit is a fixed dollar amount, not a percentage.
Resolved from `variant_profit_settings` by `variant_key`.

---

## 10) Marketplace Fees (Percent of Retail Price)

Marketplace fees are defined in `marketplace_fee_rates` (or equivalent configured table/model).

Authoritative rule:
> Marketplace fee is a percentage of the Retail Price (what the customer pays).

---

## 11) Pricing Math (NON-NEGOTIABLE)

Definitions:
RawCost = MaterialCost + ShippingCost + LaborCost
Profit = fixed dollar amount (variant-specific)
Rate = marketplace fee rate (decimal)

Closed-form solution:
RetailPrice = (RawCost + Profit) / (1 - Rate)
MarketplaceFee = RetailPrice × Rate
BaseCost = RetailPrice - Profit


Guarantees:
- BaseCost does NOT include profit
- RetailPrice includes profit
- Marketplace fee is derived from retail (not cost)

---

## 11A) Pricing Display & Reconciliation (Frontend Invariant)

When pricing data is displayed in the UI:

### Definitions
- Displayed Component Costs = material + labor + shipping + marketplace_fee
- Displayed Total Cost MUST equal the sum of displayed components
- Profit (dollars) = retail_price − displayed_total_cost

### Invariants
- Marketplace fee must be counted exactly once
- If a cost appears in the UI breakdown, it MUST be included in Total Cost
- If a cost is included in Total Cost, it MUST appear in the breakdown
- Retail price rounding (.95) must already be reflected in all displayed values

### Required Debug Instrumentation (Before Fixes)
When investigating pricing mismatches, log together:
- material_cost
- labor_cost
- shipping_cost
- marketplace_fee
- sum_of_components
- displayed_total_cost
- retail_price
- profit_dollars
- retail_minus_profit

If:
`abs(sum_of_components - displayed_total_cost) > 0.01`
→ STOP and fix before proceeding.

UI may not “correct” backend math.
UI must reconcile to backend-authoritative values.


## 12) Retail Price Rounding (MANDATORY)

After computing the closed-form RetailPrice:
- Round UP to the nearest price ending in `.95`.

All downstream values are derived from the rounded retail price:
- `MarketplaceFee = RetailPrice × Rate` (post-rounding)
- `BaseCost = RetailPrice - Profit` (post-rounding)

❌ Do not remove or “simplify” this rounding rule.

---

## 13) Pricing Persistence (Snapshots + History)

Pricing persistence has TWO layers:

### A) Current Snapshot (Fast Reads)
Pricing results are persisted to `model_pricing_snapshots` (or equivalent snapshot table/model).

- Exactly one current row per `(model_id, marketplace, variant_key)`
- Use upsert on recalculation (overwrite the current snapshot values)
- Do not persist partial pricing results
- Snapshots must include a full breakdown (raw/base/retail/fee/profit/material/shipping/labor/weight) and timestamps

### B) Pricing History Ledger (Append-Only Audit Trail)
In addition to updating the current snapshot, the system must maintain an append-only history table
(e.g., `model_pricing_history`) that records prior pricing values over time.

- History rows are NEVER updated or deleted (append-only)
- A new history row is written on successful recalculation when pricing values change
  (or always, if explicitly configured later)
- History records must include:
  - `model_id`, `marketplace`, `variant_key`
  - `raw_cost`, `base_cost`, `retail_price`, `marketplace_fee`, `profit`
  - `material_cost`, `shipping_cost`, `labor_cost`, `weight_oz`
  - `calculated_at`
  - and any required metadata for traceability (e.g., pricing_run_id)

### Rule: Snapshot ≠ History
- `model_pricing_snapshots` is the current authoritative price state.
- `model_pricing_history` is the immutable audit trail of changes.

Agents must not implement effective-dated snapshot rows or “versioning” inside `model_pricing_snapshots`.
History belongs only in the dedicated append-only history table.


---

## 14) Error Handling Standard (Instructional)

When pricing fails due to missing configuration/data:
- Return HTTP 400
- Use explicit, instructional messages that tell the user exactly what to fix:
  - missing role assignment
  - missing preferred supplier
  - missing weight_per_sq_in_oz
  - missing shipping profile / tier / zone cost
  - missing fee/profit settings

No generic “something went wrong” errors for data/config issues.

---

## 15) Schema Change Policy (Alembic Only)

- If a schema change is required, it MUST be implemented via Alembic migration.
- Do not rely on runtime `create_all()` to introduce schema changes.
- No destructive migrations (drop/rename/type changes) without explicit approval + rollback plan.

---

## 16) Definition of Done (Per Task)

A task is done only when:
- Backend endpoints behave correctly
- Frontend UI features relying on them work
- DB migrations applied (if needed)
- No browser console errors
- No backend traceback errors
- Pricing audit checklist passes (see `pricing_audit_checklist.md`)

---
