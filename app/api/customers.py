from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.core import Customer
from app.schemas.core import CustomerCreate, CustomerResponse

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("", response_model=List[CustomerResponse])
def list_customers(db: Session = Depends(get_db)):
    return db.query(Customer).all()

@router.get("/{id}", response_model=CustomerResponse)
def get_customer(id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.post("", response_model=CustomerResponse)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(
        name=data.name,
        address=data.address,
        phone=data.phone
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer

@router.put("/{id}", response_model=CustomerResponse)
def update_customer(id: int, data: CustomerCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.name = data.name
    customer.address = data.address
    customer.phone = data.phone
    db.commit()
    db.refresh(customer)
    return customer

@router.delete("/{id}")
def delete_customer(id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    return {"message": "Customer deleted"}
