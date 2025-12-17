import pandas as pd
from io import BytesIO
from sqlalchemy.orm import Session
from fastapi import UploadFile
from app.models.templates import AmazonProductType, ProductTypeKeyword, ProductTypeField, ProductTypeFieldValue

class TemplateService:
    def __init__(self, db: Session):
        self.db = db
    
    async def import_amazon_template(self, file: UploadFile, product_code: str) -> dict:
        contents = await file.read()
        excel_file = BytesIO(contents)
        
        existing = self.db.query(AmazonProductType).filter(
            AmazonProductType.code == product_code
        ).first()
        if existing:
            self.db.delete(existing)
            self.db.commit()
        
        product_type = AmazonProductType(
            code=product_code,
            name=product_code.replace("_", " ").title()
        )
        self.db.add(product_type)
        self.db.commit()
        self.db.refresh(product_type)
        
        fields_imported = 0
        keywords_imported = 0
        valid_values_imported = 0
        
        try:
            df_definitions = pd.read_excel(excel_file, sheet_name="Data Definitions")
            excel_file.seek(0)
            
            for idx, row in df_definitions.iterrows():
                field_name = str(row.iloc[0]) if pd.notna(row.iloc[0]) else None
                if not field_name or field_name == 'nan':
                    continue
                    
                attribute_group = str(row.iloc[1]) if len(row) > 1 and pd.notna(row.iloc[1]) else None
                required_val = row.iloc[2] if len(row) > 2 else False
                required = bool(required_val) if pd.notna(required_val) else False
                description = str(row.iloc[3]) if len(row) > 3 and pd.notna(row.iloc[3]) else None
                
                field = ProductTypeField(
                    product_type_id=product_type.id,
                    field_name=field_name,
                    attribute_group=attribute_group if attribute_group != 'nan' else None,
                    required=required,
                    order_index=idx,
                    description=description if description != 'nan' else None
                )
                self.db.add(field)
                fields_imported += 1
        except Exception:
            pass
        
        try:
            df_valid = pd.read_excel(excel_file, sheet_name="Valid Values")
            excel_file.seek(0)
            
            for col in df_valid.columns:
                field = self.db.query(ProductTypeField).filter(
                    ProductTypeField.product_type_id == product_type.id,
                    ProductTypeField.field_name == col
                ).first()
                
                if field:
                    for value in df_valid[col].dropna().unique():
                        field_value = ProductTypeFieldValue(
                            product_type_field_id=field.id,
                            value=str(value)
                        )
                        self.db.add(field_value)
                        valid_values_imported += 1
        except Exception:
            pass
        
        try:
            df_keywords = pd.read_excel(excel_file, sheet_name="Dropdown Lists")
            excel_file.seek(0)
            
            if "item_type_keyword" in df_keywords.columns:
                for keyword in df_keywords["item_type_keyword"].dropna().unique():
                    kw = ProductTypeKeyword(
                        product_type_id=product_type.id,
                        keyword=str(keyword)
                    )
                    self.db.add(kw)
                    keywords_imported += 1
        except Exception:
            pass
        
        self.db.commit()
        
        return {
            "product_code": product_code,
            "fields_imported": fields_imported,
            "keywords_imported": keywords_imported,
            "valid_values_imported": valid_values_imported
        }
