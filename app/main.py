from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api import (
    manufacturers, series, equipment_types, models,
    materials, suppliers, customers, orders,
    pricing, templates, enums, export, design_options, settings
)
from app.services.storage_policy import ensure_storage_dirs_exist, cleanup_tmp_dir

Base.metadata.create_all(bind=engine)


# verify reload
app = FastAPI(
    title="Cover Making Application",
    description="API for managing custom fabric covers for musical instruments",
    version="1.0.0"
)

# Phase 0 Diagnostics
import os
import sys
print(f"PID: {os.getpid()}")
print(f"CWD: {os.getcwd()}")
try:
    import app.api.export as exp_check
    print(f"Export module path: {os.path.abspath(exp_check.__file__)}")
except Exception as e:
    print(f"Could not resolve export module path: {e}")

# Storage Policy: Ensure directories exist and cleanup old temp files
try:
    ensure_storage_dirs_exist()
    print("[STORAGE_POLICY] Storage directories verified/created")
    
    deleted_count = cleanup_tmp_dir(max_age_days=7)
    if deleted_count > 0:
        print(f"[STORAGE_POLICY] Cleaned up {deleted_count} old temp files")
except Exception as e:
    print(f"[STORAGE_POLICY] Warning: Storage policy initialization failed: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Export-Signature", "X-Export-Template-Code"]
)

app.include_router(manufacturers.router)
app.include_router(series.router)
app.include_router(equipment_types.router)
app.include_router(models.router)
app.include_router(materials.router)
app.include_router(suppliers.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(pricing.router)
app.include_router(templates.router)
app.include_router(enums.router)
app.include_router(export.router)
app.include_router(design_options.router)
app.include_router(settings.router)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/")
def root():
    return {
        "message": "Cover Making Application API",
        "docs": "/docs",
        "health": "/health"
    }
