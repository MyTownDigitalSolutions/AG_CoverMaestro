# Phase 01C, Chunk 1: Environment Parity & DB Targeting — Env Var Matrix

## Backend
- [ ] Add `pydantic-settings` to `pyproject.toml`
- [ ] Create `app/config.py` defining `Settings` model with `ENV`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`
- [ ] Refactor `app/database.py` to use `Settings` for DB connection (removing hardcoded sqlite)
- [ ] Update `app/main.py` to use `Settings` for app configuration
- [ ] Create `.env.example` mirroring `Settings` fields
- [ ] Ensure `alembic/env.py` aligns with `Settings` (verify import)

## Frontend
- [ ] (No changes required for backend-focused env parity in this chunk)

## Integration
- [ ] Verify application starts with `.env` values loaded
- [ ] Confirm strict failure if required env vars are missing

## Verification
- [ ] Manual: Inspect `app/config.py`
- [ ] Manual: Start app without `.env` and verify failure
- [ ] Manual: Connect to Supabase DB via App to confirm `DATABASE_URL` usage
