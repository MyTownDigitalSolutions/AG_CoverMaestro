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
        
        existing_field_settings = {}
        if existing:
            existing_fields = self.db.query(ProductTypeField).filter(
                ProductTypeField.product_type_id == existing.id
            ).all()
            for field in existing_fields:
                existing_field_settings[field.field_name] = {
                    'required': field.required,
                    'selected_value': field.selected_value,
                    'custom_value': field.custom_value
                }
            
            self.db.query(ProductTypeFieldValue).filter(
                ProductTypeFieldValue.product_type_field_id.in_(
                    self.db.query(ProductTypeField.id).filter(
                        ProductTypeField.product_type_id == existing.id
                    )
                )
            ).delete(synchronize_session=False)
            self.db.query(ProductTypeField).filter(
                ProductTypeField.product_type_id == existing.id
            ).delete(synchronize_session=False)
            self.db.query(ProductTypeKeyword).filter(
                ProductTypeKeyword.product_type_id == existing.id
            ).delete(synchronize_session=False)
            self.db.commit()
            product_type = existing
        else:
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
        
        data_definitions = {}
        try:
            dd_df = pd.read_excel(excel_file, sheet_name="Data Definitions", header=None)
            excel_file.seek(0)
            
            for row_idx in range(2, len(dd_df)):
                row = dd_df.iloc[row_idx]
                group_name = str(row.iloc[0]) if pd.notna(row.iloc[0]) else None
                field_name = str(row.iloc[1]) if len(row) > 1 and pd.notna(row.iloc[1]) else None
                display_name = str(row.iloc[2]) if len(row) > 2 and pd.notna(row.iloc[2]) else None
                
                if field_name and field_name.strip():
                    data_definitions[field_name] = {
                        "group_name": group_name,
                        "display_name": display_name
                    }
        except Exception as e:
            print(f"Error parsing Data Definitions sheet: {e}")
        
        template_field_order = {}
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
            
            row5_field_names = template_df.iloc[4].tolist()
            row4_display_names = template_df.iloc[3].tolist()
            row3_attribute_groups = template_df.iloc[2].tolist()
            
            current_group = None
            for idx, field_name in enumerate(row5_field_names):
                if pd.isna(field_name):
                    continue
                
                field_name_str = str(field_name)
                template_field_order[field_name_str] = {
                    "order_index": idx,
                    "display_name_from_template": str(row4_display_names[idx]) if idx < len(row4_display_names) and pd.notna(row4_display_names[idx]) else None,
                    "group_from_row3": str(row3_attribute_groups[idx]) if idx < len(row3_attribute_groups) and pd.notna(row3_attribute_groups[idx]) else None
                }
                if template_field_order[field_name_str]["group_from_row3"]:
                    current_group = template_field_order[field_name_str]["group_from_row3"]
                template_field_order[field_name_str]["current_group"] = current_group
            
            self.db.commit()
        except Exception as e:
            print(f"Error parsing Template sheet: {e}")
        
        field_name_to_db = {}
        for field_name, template_info in template_field_order.items():
            dd_info = data_definitions.get(field_name, {})
            
            display_name = dd_info.get("display_name") or template_info.get("display_name_from_template")
            group_name = dd_info.get("group_name") or template_info.get("current_group")
            
            prev_settings = existing_field_settings.get(field_name, {})
            
            field = ProductTypeField(
                product_type_id=product_type.id,
                field_name=field_name,
                display_name=display_name,
                attribute_group=group_name,
                order_index=template_info["order_index"],
                required=prev_settings.get('required', False),
                selected_value=prev_settings.get('selected_value'),
                custom_value=prev_settings.get('custom_value')
            )
            self.db.add(field)
            self.db.flush()
            field_name_to_db[field_name] = field
            fields_imported += 1
        
        self.db.commit()
        
        display_to_field_name = {}
        for field_name, field_obj in field_name_to_db.items():
            if field_obj.display_name:
                display_to_field_name[field_obj.display_name] = field_name
        
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
                    
                    field = None
                    bracket_start = field_label_str.find("[")
                    bracket_end = field_label_str.find("]")
                    if bracket_start != -1 and bracket_end != -1:
                        bracket_field_name = field_label_str[bracket_start+1:bracket_end]
                        for stored_field_name in field_name_to_db.keys():
                            if bracket_field_name in stored_field_name:
                                field = field_name_to_db[stored_field_name]
                                break
                    
                    if not field:
                        field_name = display_to_field_name.get(display_name)
                        field = field_name_to_db.get(field_name) if field_name else None
                    
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
        
        default_values_imported = 0
        other_values_imported = 0
        try:
            default_values_df = pd.read_excel(excel_file, sheet_name="Default Values", header=None)
            excel_file.seek(0)
            
            print(f"Default Values sheet found with {len(default_values_df)} rows")
            print(f"Available fields in template: {list(field_name_to_db.keys())[:5]}...")
            
            for row_idx in range(1, len(default_values_df)):
                row = default_values_df.iloc[row_idx]
                
                field_name_col = row.iloc[1] if len(row) > 1 and pd.notna(row.iloc[1]) else None
                default_value = row.iloc[2] if len(row) > 2 and pd.notna(row.iloc[2]) else None
                
                if not field_name_col:
                    continue
                
                field_name_str = str(field_name_col).strip()
                
                field = field_name_to_db.get(field_name_str)
                match_type = "exact" if field else None
                
                if not field:
                    for stored_field_name in field_name_to_db.keys():
                        if field_name_str in stored_field_name or stored_field_name in field_name_str:
                            field = field_name_to_db[stored_field_name]
                            match_type = "contains"
                            break
                    
                    if not field:
                        base_name = field_name_str.split('[')[0] if '[' in field_name_str else field_name_str
                        for stored_field_name in field_name_to_db.keys():
                            stored_base = stored_field_name.split('[')[0] if '[' in stored_field_name else stored_field_name
                            if base_name == stored_base:
                                field = field_name_to_db[stored_field_name]
                                match_type = "base_name"
                                break
                
                if field:
                    if default_value:
                        default_value_str = str(default_value).strip()
                        field.custom_value = default_value_str
                        default_values_imported += 1
                        print(f"Set default for '{field.field_name}' ({match_type}): {default_value_str[:50]}...")
                    
                    other_values = [str(v).strip() for v in row.iloc[3:] if pd.notna(v)]
                    for value in other_values:
                        field_value = ProductTypeFieldValue(
                            product_type_field_id=field.id,
                            value=value
                        )
                        self.db.add(field_value)
                        other_values_imported += 1
                else:
                    print(f"No match found for: '{field_name_str[:60]}...'")
            
            print(f"Default values imported: {default_values_imported}, other values: {other_values_imported}")
            self.db.commit()
        except Exception as e:
            print(f"Default Values sheet not found or error parsing: {e}")
        
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
