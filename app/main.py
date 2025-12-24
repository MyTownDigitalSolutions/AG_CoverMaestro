from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api import (
    manufacturers, series, equipment_types, models,
    materials, suppliers, customers, orders,
    pricing, templates, enums, export, design_options, settings
)

Base.metadata.create_all(bind=engine)


# verify reload
app = FastAPI(
    title="Cover Making Application",
    description="API for managing custom fabric covers for musical instruments",
    version="1.0.0"
)

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
