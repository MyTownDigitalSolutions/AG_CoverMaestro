# AG_CoverMaestro — Project Rules (Source of Truth)

This document defines the **high-level rules, architecture, and intent**
for the AG_CoverMaestro repository.

It is written for **humans** and as an entry point for **agentic AI systems**.
Detailed and enforceable AI rules live in the `.ai/` directory.

---

## 1) Authoritative AI Rules (IMPORTANT)

This repository uses **strict AI governance**.

The authoritative rules for agentic AI behavior do **not** live only in this file.

They live here:

.ai/
agent_rules.md ← authoritative AI behavior rules
DO_NOT_TOUCH.md ← locked areas (must ask before changing)
pricing_audit_checklist.md ← validation checklist for pricing logic


If there is any conflict:
> **`.ai/agent_rules.md` always wins.**

---

## 2) Project Overview

AG_CoverMaestro is a full-stack application for managing **custom protective covers**
for musical equipment.

The system manages:

- Manufacturers, series, and equipment models
- Materials and suppliers (preferred-supplier pricing only)
- Shipping rate cards, tiers, zones, and marketplace profiles
- Labor, profit, and marketplace fee configuration
- A **strict, auditable pricing engine**
- Marketplace-ready pricing snapshots and exports

---

## 3) Technology Stack

### Backend
- Python 3.11
- FastAPI
- SQLAlchemy ORM
- Alembic migrations
- Pydantic validation
- SQLite (current; portable to PostgreSQL later)

### Frontend
- React 18
- TypeScript
- Material UI (MUI)
- REST API integration

---

## 4) Core Business Principles (Non-Negotiable)

- Pricing must be **deterministic and auditable**
- No silent fallbacks or guessing
- All pricing inputs are **data-driven**
- Historical correctness matters
- Supplier cost changes must be traceable
- Agentic AI must not “optimize” business logic

---

## 5) Model Lifecycle Rules

### Surface Area (Critical)

- Surface area is computed **when a model is created or updated**
- It is stored directly on the model record
- Pricing logic **never recomputes surface area**
- Missing or invalid surface area → pricing fails (HTTP 400)

---

## 6) Pricing Architecture (High-Level)

Pricing is computed:

- Per model
- Per marketplace
- For **four required variants**
- Using strict material role resolution
- Using marketplace-controlled shipping zones
- Using closed-form marketplace fee math
- With mandatory `.95` retail rounding

### Required Variants
1. Choice Waterproof Fabric (no padding)  
2. Choice Waterproof Fabric + Padding  
3. Premium Synthetic Leather (no padding)  
4. Premium Synthetic Leather + Padding  

If **any** variant cannot be calculated, pricing fails entirely.

---

## 7) Pricing Persistence Strategy

Pricing uses a **two-layer persistence model**:

### A) Current Pricing Snapshots
- Stored in `model_pricing_snapshots`
- One row per `(model_id, marketplace, variant_key)`
- Overwritten on recalculation
- Used for UI and exports

### B) Pricing History Ledger
- Stored in an append-only table (e.g. `model_pricing_history`)
- Records prior pricing values when costs/prices change
- Immutable audit trail

(Exact behavior is defined in `.ai/agent_rules.md`.)

---

## 8) Database Governance

- All schema changes require Alembic migrations
- No destructive changes without approval + rollback plan
- Runtime table creation is not a substitute for migrations
- Effective-dated tables are used where historical accuracy matters

---

## 9) Error Philosophy

Configuration or data errors must:

- Fail fast
- Return HTTP 400
- Include **instructional error messages**
- Never silently recover or guess

---

## 10) Agent Safety Summary

Agentic AI **must not**:

- Change pricing math or rounding
- Add fallback logic
- Recompute surface area in pricing
- Rename pricing concepts
- Modify snapshot/history strategy
- Change shipping resolution order

If an AI thinks:
> “This would be cleaner if…”

The correct action is:
> **STOP. ASK. WAIT.**

---

## 11) Where to Look Next

- Authoritative AI rules → `.ai/agent_rules.md`
- Locked areas → `.ai/DO_NOT_TOUCH.md`
- Pricing validation → `.ai/pricing_audit_checklist.md`

---

This file is intentionally stable.
Detailed operational rules belong in `.ai/`.
