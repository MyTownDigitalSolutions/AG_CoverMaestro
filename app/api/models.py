from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from app.database import get_db
from app.models.core import Model
from app.schemas.core import ModelCreate, ModelResponse

router = APIRouter(prefix="/models", tags=["models"])

@router.get("", response_model=List[ModelResponse])
def list_models(series_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Model)
    if series_id:
        query = query.filter(Model.series_id == series_id)
    return query.all()

@router.get("/{id}", response_model=ModelResponse)
def get_model(id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model

@router.post("", response_model=ModelResponse)
def create_model(data: ModelCreate, db: Session = Depends(get_db)):
    try:
        model = Model(
            name=data.name,
            series_id=data.series_id,
            equipment_type_id=data.equipment_type_id,
            width=data.width,
            depth=data.depth,
            height=data.height,
            handle_length=data.handle_length,
            handle_width=data.handle_width,
            handle_location=data.handle_location,
            angle_type=data.angle_type,
            image_url=data.image_url
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Model with this name already exists in this series")

@router.put("/{id}", response_model=ModelResponse)
def update_model(id: int, data: ModelCreate, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    try:
        model.name = data.name
        model.series_id = data.series_id
        model.equipment_type_id = data.equipment_type_id
        model.width = data.width
        model.depth = data.depth
        model.height = data.height
        model.handle_length = data.handle_length
        model.handle_width = data.handle_width
        model.handle_location = data.handle_location
        model.angle_type = data.angle_type
        model.image_url = data.image_url
        db.commit()
        db.refresh(model)
        return model
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Model with this name already exists in this series")

@router.delete("/{id}")
def delete_model(id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(model)
    db.commit()
    return {"message": "Model deleted"}
