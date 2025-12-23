# AG_CoverMaestro — Pricing Audit Checklist

This checklist must be mentally or explicitly verified **before committing or approving**
any pricing-related change.

If **any item fails**, STOP and fix the issue before proceeding.

---

## A) Preconditions (Data Integrity)

- [ ] Model exists and has a **stored surface area**  
      (`model.surface_area_sq_in` is present, non-zero, valid)
- [ ] Pricing logic does **not** recompute surface area
- [ ] All required material roles exist and are active:
  - [ ] `CHOICE_WATERPROOF_FABRIC`
  - [ ] `PREMIUM_SYNTHETIC_LEATHER`
  - [ ] `PADDING`
- [ ] Exactly one active assignment per role
- [ ] No material names or IDs are referenced directly in pricing logic

---

## B) Material Cost Resolution

- [ ] Each material used in pricing has **one preferred supplier**
- [ ] Material cost is derived **only** from preferred supplier relationships
- [ ] Effective unit cost uses:
unit_cost + (shipping_cost / quantity_purchased)

- [ ] No default or hard-coded material costs exist

---

## C) Material Weight (STRICT)

- [ ] Each pricing material has `weight_per_sq_in_oz` populated
- [ ] Weight is calculated using:
- [ ] Fabric only: `AreaSqIn × FabricWeightPerSqIn`
- [ ] With padding: `AreaSqIn × (FabricWeightPerSqIn + PaddingWeightPerSqIn)`
- [ ] No linear-yard or derived weight fallback exists
- [ ] Missing weight causes **HTTP 400 with instructional error**

---

## D) Shipping Resolution (Strict Order)

Verify the shipping lookup follows **this exact chain**:

Marketplace
→ Marketplace Shipping Profile
→ Rate Card
→ Pricing Zone
→ Weight Tier
→ Zone Cost

min_oz <= weight_oz < max_oz

- [ ] Missing any element results in **HTTP 400**
- [ ] No fallback or “best available” shipping logic exists

---

## E) Labor Cost

- [ ] Labor values are sourced from `labor_settings`
- [ ] Labor cost uses:
labor_rate_per_hour × (minutes / 60)
- [ ] Separate minutes exist for padded vs non-padded variants
- [ ] No hard-coded labor values in pricing logic

---

## F) Profit + Marketplace Fees

- [ ] Profit is a **fixed dollar amount**, not a percentage
- [ ] Profit is resolved via `variant_profit_settings`
- [ ] Marketplace fee rate is resolved via `marketplace_fee_rates`
- [ ] Marketplace fee is defined as **percentage of Retail Price**

---

## G) Pricing Math (Closed-Form Validation)

Confirm these definitions are used exactly:
RawCost = MaterialCost + ShippingCost + LaborCost
Profit = fixed dollar amount
Rate = marketplace fee rate


- [ ] BaseCost does NOT include profit
- [ ] RetailPrice DOES include profit
- [ ] Marketplace fee is derived from retail (not cost)

---

## H) Retail Price Rounding

- [ ] RetailPrice is rounded **UP** to the nearest price ending in `.95`
- [ ] Rounding occurs **before** marketplace fee calculation
- [ ] MarketplaceFee and BaseCost are derived from the rounded price
- [ ] Rounding logic has not been altered or simplified

---

## I) Variant Coverage

- [ ] All four variants are calculated:
  - [ ] Choice (no padding)
  - [ ] Choice + Padding
  - [ ] Premium (no padding)
  - [ ] Premium + Padding
- [ ] If any variant fails, the **entire pricing operation fails**
- [ ] No partial variant persistence occurs

---

## J) Snapshot Persistence (Current State)

- [ ] Pricing results are written to `model_pricing_snapshots`
- [ ] Exactly one row per `(model_id, marketplace, variant_key)`
- [ ] Upsert overwrites current snapshot values
- [ ] Snapshot includes full pricing breakdown
- [ ] Partial pricing results are not persisted

---

## K) Pricing History (Append-Only Ledger)

- [ ] Pricing history is written to `model_pricing_history` (or equivalent)
- [ ] History rows are **append-only**
- [ ] History rows are never updated or deleted
- [ ] A new history row is written when pricing values change
- [ ] History includes full pricing breakdown and timestamp
- [ ] Snapshot updates do NOT replace history records

---

## L) Error Handling

- [ ] All data/config failures return **HTTP 400**
- [ ] Error messages are instructional (tell the user how to fix data)
- [ ] No generic “something went wrong” errors for pricing failures
- [ ] No silent recovery or fallback paths exist

---

## M) Final Sanity Checks

- [ ] No pricing logic bypasses agent rules
- [ ] No hidden defaults were introduced
- [ ] No schema changes without Alembic migration
- [ ] Agent rules remain unmodified

---

### ✅ Pricing Audit Verdict

Only proceed if **ALL** items above are checked.

If unsure: **STOP. ASK. DO NOT GUESS.**



