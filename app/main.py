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

# Serve static assets (JS, CSS, images) from React build
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

client_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "client", "dist")
assets_dir = os.path.join(client_dist, "assets")

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    print(f"[SPA] Serving static assets from: {assets_dir}")
else:
    print(f"[SPA] Warning: Assets directory not found at {assets_dir}")

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

# SPA fallback route - MUST be last to not interfere with API routes
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    Catch-all route to serve React SPA for client-side routing.
    Returns index.html for any non-API route so React Router can handle routing.
    """
    # Do not intercept API routes or FastAPI built-in documentation routes
    excluded_prefixes = ["api/"]
    excluded_exact = ["openapi.json", "docs", "redoc", "health"]
    
    # Check exact matches first
    if full_path in excluded_exact:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")
    
    # Check prefix matches
    for prefix in excluded_prefixes:
        if full_path.startswith(prefix):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
    
    # Serve index.html for all other routes
    index_path = os.path.join(client_dist, "index.html")
    
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        print(f"[SPA] Warning: index.html not found at {index_path}")
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="SPA index.html not found")
