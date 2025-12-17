import pandas as pd
import json
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
            template_df = pd.read_excel(excel_file, sheet_name="Template", header=None)
            excel_file.seek(0)
            
            header_rows = []
            for i in range(6):
                row_data = []
                for val in template_df.iloc[i]:
                    if pd.isna(val):
                        row_data.append(None)
                    else:
                        row_data.append(str(val))
                header_rows.append(row_data)
            
            product_type.header_rows = header_rows
            
            row4_display_names = template_df.iloc[3].tolist()
            row5_field_names = template_df.iloc[4].tolist()
            row3_attribute_groups = template_df.iloc[2].tolist()
            
            current_group = None
            for idx, field_name in enumerate(row5_field_names):
                if pd.isna(field_name):
                    continue
                
                field_name_str = str(field_name)
                display_name = str(row4_display_names[idx]) if idx < len(row4_display_names) and pd.notna(row4_display_names[idx]) else None
                
                if idx < len(row3_attribute_groups) and pd.notna(row3_attribute_groups[idx]):
                    current_group = str(row3_attribute_groups[idx])
                
                field = ProductTypeField(
                    product_type_id=product_type.id,
                    field_name=field_name_str,
                    display_name=display_name,
                    attribute_group=current_group,
                    order_index=idx
                )
                self.db.add(field)
                fields_imported += 1
            
            self.db.commit()
        except Exception as e:
            print(f"Error parsing Template sheet: {e}")
        
        try:
            valid_values_df = pd.read_excel(excel_file, sheet_name="Valid Values", header=None)
            excel_file.seek(0)
            
            for row_idx in range(len(valid_values_df)):
                row = valid_values_df.iloc[row_idx]
                
                field_label = row.iloc[1] if len(row) > 1 and pd.notna(row.iloc[1]) else None
                if not field_label:
                    continue
                
                field_label_str = str(field_label)
                
                if " - [" in field_label_str:
                    display_name = field_label_str.split(" - [")[0].strip()
                    
                    field = self.db.query(ProductTypeField).filter(
                        ProductTypeField.product_type_id == product_type.id,
                        ProductTypeField.display_name == display_name
                    ).first()
                    
                    if field:
                        values = [str(v) for v in row.iloc[2:] if pd.notna(v)]
                        for value in values:
                            field_value = ProductTypeFieldValue(
                                product_type_field_id=field.id,
                                value=value
                            )
                            self.db.add(field_value)
                            valid_values_imported += 1
                        
                        if display_name == "Item Type Keyword":
                            for value in values:
                                kw = ProductTypeKeyword(
                                    product_type_id=product_type.id,
                                    keyword=value
                                )
                                self.db.add(kw)
                                keywords_imported += 1
            
            self.db.commit()
        except Exception as e:
            print(f"Error parsing Valid Values sheet: {e}")
        
        self.db.commit()
        
        return {
            "product_code": product_code,
            "fields_imported": fields_imported,
            "keywords_imported": keywords_imported,
            "valid_values_imported": valid_values_imported
        }
    
    def get_header_rows(self, product_code: str) -> list:
        product_type = self.db.query(AmazonProductType).filter(
            AmazonProductType.code == product_code
        ).first()
        
        if product_type and product_type.header_rows:
            return product_type.header_rows
        return []
