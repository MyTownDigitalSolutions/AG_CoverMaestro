# Phase 2 Proposal: Product Design Options Schema Update


“This document is a design proposal. No code has been implemented from it yet.”


## Current Limitation
The current `DesignOption` schema consists of a flat structure:
- `id`
- `name`
- `description`
- `equipment_types` (relationship)

It lacks a `group`, `category`, or `type` field. This makes it impossible to distinguish between different *kinds* of options (e.g., "Handle Location" vs. "Angle Type") when they are assigned to the same Equipment Type.

To fulfill the requirement of populating specific dropdowns ("Handle Location" dropdown vs "Angle Type" dropdown) dynamically from the database, we need to know which Design Option belongs to which group.

## Proposed Changes

### 1. Database Schema Update
Modify the `DesignOption` table (in `app/models/core.py`) to include a discriminator field.

```python
class DesignOption(Base):
    __tablename__ = "design_options"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    
    # NEW FIELD
    option_type = Column(String, nullable=False, index=True) 
    # Examples: 'handle_location', 'angle_type'
    
    equipment_types = relationship("EquipmentTypeDesignOption", back_populates="design_option")
```

### 2. API Updates
Update `DesignOptionCreate` and `DesignOptionResponse` schemas to include `option_type`.

### 3. Frontend Updates
- Update `DesignOption` interface in `types/index.ts`.
- Update the "Product Design Options" management page to allow selecting a generic "Type/Group" when creating an option.
- Implement the "Add/Edit Model" form logic to filter:
  - `handleOptions = designOptions.filter(o => o.option_type === 'handle_location')`
  - `angleOptions = designOptions.filter(o => o.option_type === 'angle_type')`

## Implementation Plan
1.  **Migration**: Create Alembic migration to add `option_type` column to `design_options`.
2.  **Backend**: Update `app/models/core.py` and Pydantic schemas.
3.  **Frontend**: Update types and API services.
4.  **UI**: Implement the form wiring as originally requested, now enabled by the schema.
