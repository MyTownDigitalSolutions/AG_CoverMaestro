# Cover Making Application

A full-stack web application for managing custom fabric covers for musical instruments, calculating prices, and generating marketplace listing templates.

## Overview

This application helps manage:
- Manufacturers, series, and equipment models with dimensions
- Material types with cost, weight, and labor time properties
- Customers and orders with line items
- Pricing calculations (area, material cost, labor, options, shipping)
- Amazon template import and management

## Technology Stack

### Backend
- **Framework**: Python 3.11 + FastAPI
- **Database**: SQLite with SQLAlchemy ORM
- **Migrations**: Alembic
- **Validation**: Pydantic
- **Excel Parsing**: Pandas + OpenPyXL

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material UI (MUI)
- **HTTP Client**: Axios
- **Build Tool**: Vite
- **Routing**: React Router

## Project Structure

```
/
├── app/                    # Backend Python application
│   ├── api/               # API route handlers
│   ├── models/            # SQLAlchemy database models
│   ├── schemas/           # Pydantic request/response schemas
│   ├── services/          # Business logic services
│   ├── database.py        # Database configuration
│   ├── main.py           # FastAPI application entry
│   └── seed_data.py      # Database seeding script
├── client/                # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API client functions
│   │   └── types/        # TypeScript type definitions
│   └── package.json
└── cover_app.db          # SQLite database file
```

## API Endpoints

- `GET /health` - Health check
- `GET/POST /manufacturers` - Manage manufacturers
- `GET/POST /series` - Manage product series
- `GET/POST/PUT/DELETE /equipment-types` - Manage equipment types
- `GET/PUT /equipment-types/{id}/pricing-options` - Manage pricing options assigned to equipment types
- `GET/PUT /equipment-types/{id}/design-options` - Manage design options assigned to equipment types
- `GET/POST/PUT/DELETE /design-options` - Manage design options (design features)
- `GET/POST /models` - Manage equipment models
- `GET/POST /materials` - Manage materials
- `GET/POST /suppliers` - Manage suppliers
- `GET/POST /customers` - Manage customers
- `GET/POST /orders` - Manage orders
- `POST /pricing/calculate` - Calculate cover pricing
- `GET/POST/PUT/DELETE /pricing/options` - Manage pricing options (add-on features)
- `GET /pricing/options/by-equipment-type/{id}` - Get pricing options for equipment type
- `POST /templates/import` - Import Amazon template
- `GET /templates` - List imported templates
- `GET /enums/*` - Get enum values

## Key Features

1. **Pricing Calculator**: Calculates cover costs based on:
   - Surface area: 2*(W×D + W×H + D×H) with 5% waste
   - Material cost per square inch
   - Labor cost (material labor time × hourly rate)
   - Option surcharges (handle zipper, two-in-one pocket, music rest)
   - Shipping rates by carrier and zone

2. **Amazon Template Import**: Parses Excel files to extract:
   - Data Definitions (field names, requirements)
   - Valid Values for each field
   - Default Values (custom defaults with placeholder support)
   - Item type keywords

3. **Parent SKU Generation**: Auto-generates 40-character parent/base SKUs when models are saved:
   - Format: `MFGR(8)-SERIES(8)-MODEL(13)V1 + zeros`
   - Multi-word names are concatenated and camelCased
   - Short names are padded with X's
   - Example: `FENDERXX-TONEMAST-SUPERREVERBXXV10000000`
   - Endpoint `POST /models/regenerate-skus` to backfill existing models

4. **Dynamic Pricing Options System**:
   - Pricing options are add-on features (e.g., Handle Zipper, Two-in-One Pocket, Music Rest Zipper)
   - Create, edit, and delete pricing options through the Pricing Options page
   - Assign specific pricing options to equipment types via the Equipment Types page
   - Junction table `equipment_type_pricing_options` manages many-to-many relationship

5. **Dynamic Design Options System**:
   - Design options define product design features (e.g., Handle Options, Angle Options)
   - Create, edit, and delete design options through the Design Options page
   - Assign specific design options to equipment types via the Equipment Types page
   - Junction table `equipment_type_design_options` manages many-to-many relationship
   - Default design options: "Handle Options" (for handle location selection), "Angle Options" (for angle/curve type selection)

6. **Supplier Management System**:
   - Manage suppliers with full contact information (name, contact, address, phone, email, website)
   - Link suppliers to materials they sell via `supplier_materials` junction table
   - Each supplier-material link has: `unit_cost`, `shipping_cost` (flat fee), `quantity_purchased`, `is_preferred` flag
   - Only one supplier can be preferred per material (business rule enforced)
   - Calculated fields displayed: Cost per Linear Yard (fabric) or Cost per Unit (hardware), Cost per Square Inch (fabric only)
   - Formula: `cost_per_unit = unit_cost + (shipping_cost / quantity_purchased)`
   - Pricing service uses preferred supplier's unit cost + amortized shipping cost
   - Access via Suppliers page (list) and Supplier Detail page (materials table with add/edit/delete)
   - Also accessible from Materials page via "Manage Suppliers" icon button

7. **Material Type System**:
   - Materials support three types: FABRIC, HARDWARE, PACKAGING (enum: `MaterialType`)
   - Unit of measure enum: YARD, EACH, PACKAGE, BOX, SET (`UnitOfMeasure`)
   - Fabric materials: width (inches), weight per linear yard (lbs), cost per yard
   - Hardware/Packaging materials: unit_of_measure, package_quantity, cost per unit
   - UI displays material type as color-coded chip (blue for fabric, default for others)
   - Conditional form fields: fabric shows width/weight fields; hardware/packaging show unit of measure/quantity
   - Supplier materials table uses dynamic labels: "Yards" for fabric, "Qty" for other types

## Development

The application runs on:
- Backend API: http://localhost:8000
- Frontend: http://localhost:5000 (proxied to backend)

## Database

SQLite database with the following main tables:
- manufacturers, series, equipment_types, models
- materials, material_colour_surcharges
- suppliers, supplier_materials
- customers, orders, order_lines
- pricing_options, shipping_rates, equipment_type_pricing_options (junction table)
- design_options, equipment_type_design_options (junction table)
- amazon_product_types, product_type_fields, product_type_field_values

## Database Migrations

The project uses Alembic for database migrations:

```bash
# Generate a new migration after model changes
alembic revision --autogenerate -m "description"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## Seeding Data

To populate the database with initial data:

```bash
python -c "from app.seed_data import seed_database; seed_database()"
```

This adds default equipment types, materials, pricing options, shipping rates, and sample manufacturers/series/models.
