# Phase 01: MVP Workflows & Structure
Phase Purpose:
Define the scope of the Minimum Viable Product (MVP) by explicitly listing supported user workflows, excluding non-essential features, and resolving ambiguity.

Status: DRAFT

1. MVP Workflows (Testable)

The following workflows represent the complete "Walking Skeleton" of the MVP.

A. Catalog Management

Manage Manufacturers

Create, read, update, delete (CRUD) manufacturer entities.

Manage Series

CRUD series associated with manufacturers.

Manage Equipment Models

CRUD equipment models.

Define required pricing inputs such as:

surface_area

pricing_tier

B. Pricing Engine

Configure Cost Basis

Update raw material costs (Fabric, Padding).

Update labor rates.

Compute Model Pricing

Trigger calculation of:

Retail Price

Wholesale Price

Generate 4 required variants per model:

Variant 1: Choice Waterproof (No Pad)

Variant 2: Choice Waterproof (+ Pad)

Variant 3: Premium Leather (No Pad)

Variant 4: Premium Leather (+ Pad)

Verify Pricing Rules

Enforce .95 rounding.

Enforce minimum margin constraints.

Pricing logic must be deterministic.

C. Marketplace Operations

Generate Amazon Export

Select models.

Generate inventory/price loader CSV for Amazon.

Generate Reverb Export

Select models.

Generate draft listing CSV for Reverb.

Manage Shipping Profiles

Map internal shipping weights to marketplace shipping templates.

D. Order Import & Fulfillment

Import Marketplace Orders

Import orders from supported marketplaces (e.g., Amazon, Reverb).

Persist imported orders in Supabase.

Imported order data becomes the authoritative source for fulfillment workflows.

No automatic API push-back to marketplaces.

Generate Work Orders (Fulfillment Only)

Create a Work Order from an imported order.

Snapshot:

Model

Variant

Selected options

Customer reference

Include internal build instructions for sewing team.

Manual status transitions:

Draft → In Progress → Completed

Work Orders do NOT:

Modify pricing

Modify inventory

Trigger marketplace exports

Perform accounting functions

Generate Packing Slips / Order Documents

Generate printable customer-facing document derived from imported order.

Editable internal notes allowed.

Print-friendly layout (HTML-based acceptable for MVP).

Packing Slips are NOT accounting invoices.

No financial ledger functionality included.

E. System Access & Security

Secure Access (Required)

Frontend

Application is private by default.

Any unauthenticated user attempting to access / or internal routes MUST be redirected to /login.

Only public routes:

/login

/auth/callback

Authentication via Supabase Auth (Email/Password or Magic Link).

Backend API

All endpoints (except health checks and auth callbacks) require a valid Supabase JWT.

Missing or invalid token → 401 Unauthorized.

Database

Row Level Security (RLS) enabled on ALL tables.

Policies restrict access to authenticated users.

Single internal admin assumption (no role separation in MVP).

Service Role key restricted to backend-only tasks.

2. Environment Policy (MVP)

System of Record
Supabase (PostgreSQL) is the sole and continuing system of record for MVP data.

Development Environment

Local development connects directly to Remote Supabase DEV project.

Developers must be members of the Supabase project.

DEV may be seeded with sanitized PROD data for testing.

Supabase Local (Docker) is excluded from MVP.

Legacy Database

SQLite is deprecated.

No migration work included in MVP.

All active data resides in Supabase.

Schema Management

All schema changes must be applied via version-controlled SQL migrations (supabase/migrations/).

Structural changes via Supabase Dashboard UI are prohibited.

Changes must be additive only.

3. Explicit "Not Doing" (Exclusions)

Direct real-time Marketplace API synchronization (CSV export only).

Public storefront / B2C interface.

Custom variant builder beyond the 4 fixed variants.

Raw material inventory tracking.

Supply invoice tracking.

Accounting system functionality.

Automated financial reconciliation.

Mobile native application.

4. Phase 01 Completion Checklist

 Workflows Approved

 Exclusions Accepted

 Environment Policy Accepted

 Order Import + Work Order + Packing Slip scope confirmed

Gate: APPROVE COMPLETION
