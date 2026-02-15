# Phase 01C, Chunk 1: Environment Parity & DB Targeting — Env Var Matrix

## Backend
- [x] Add `pydantic-settings` to `pyproject.toml`
- [x] Create `app/config.py` defining `Settings` model with `ENV`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`
- [x] Refactor `app/database.py` to use `Settings` for DB connection (removing hardcoded sqlite)
- [x] Update `app/main.py` to use `Settings` for app configuration
- [x] Create `.env.example` mirroring `Settings` fields
- [x] Ensure `alembic/env.py` aligns with `Settings` (verify import)

## Frontend
- [x] (No changes required for backend-focused env parity in this chunk)

## Integration
- [x] Verify application starts with `.env` values loaded
- [x] Confirm strict failure if required env vars are missing

## Verification
- [x] Manual: Inspect `app/config.py`
- [x] Manual: Start app without `.env` and verify failure
- [x] Manual: Connect to Supabase DB via App to confirm `DATABASE_URL` usage
