# ADR-001: Amazon Export Workflows & Snapshot Guardrails

## Context
The "Amazon Export" feature requires a strict preflight check to ensure all baseline pricing snapshots exist before generating a preview. Previously, missing imports and untracked API behavior caused regressions.

## Decisions

1. **Preflight Check**: The CLI/UI must hit `POST /pricing/snapshots/status` before generating a preview.
2. **Auto-Recovery**: If snapshots are missing, the UI offers a "Run Recalculate Now" button which triggers a recalc and immediately re-runs the check.
3. **Series-First Selection**: Selecting a series automatically selects all its models to reduce user clicks.
4. **Structured Logging**: The status endpoint emits a deterministic INFO log for observability.

## Implementation Details

- **Endpoint**: `POST /pricing/snapshots/status` (in `app/api/pricing.py`)
- **Logging**: Uses `logging.getLogger(__name__)` to emit `[SNAPSHOTS-STATUS] ...` lines.
- **Frontend**: `ExportPage.tsx` handles the 500/400 recovery logic.

## Regression Guardrails

A specialized test suite (`tests/test_api_snapshots.py`) protects this workflow. It asserts:

1. **Module Integrity**: Imports (e.g., `Dict`) are valid.
2. **Schema Contract**: Request/Response models match expectations.
3. **Route Registration**: The endpoint is registered at the correct path.
4. **Logic Correctness**: Missing snapshots are correctly identified.
5. **Observability**: The specific INFO log line is emitted.

## Execution

Run the guardrails with:
```bash
PYTHONPATH=. python tests/test_api_snapshots.py
```

## How to Verify Manually

1. Go to Amazon Export page.
2. Select Manufacturer -> Series.
3. Click "Generate Preview".
4. Confirm `[SNAPSHOTS-STATUS] ...` appears in server logs.
5. If snapshots are missing, confirm the "Run Recalculate Now" button appears and functions.
