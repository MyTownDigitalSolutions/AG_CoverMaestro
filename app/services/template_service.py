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
        """
        Import Amazon template following this exact logic:
        
        1. Parse Data Definitions sheet FIRST
           - Row 2 = headers
           - Starting Row 3:
             - When Column A has a value (and nothing else in row), that's a Group Name
             - Following rows have field data with Column A empty:
               - Column B = Field Name
               - Column C = Default Value
               - Column D onwards = Other values (headers in Row 2 are the local label names)
        
        2. Parse Valid Values sheet for valid value lists
        
        3. Parse Template sheet for field order and display names
        """
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
            
            row2_headers = dd_df.iloc[1].tolist() if len(dd_df) > 1 else []
            
            current_group = None
            
            for row_idx in range(2, len(dd_df)):
                row = dd_df.iloc[row_idx]
                
                col_a = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
                col_b = str(row.iloc[1]).strip() if len(row) > 1 and pd.notna(row.iloc[1]) else None
                col_c = str(row.iloc[2]).strip() if len(row) > 2 and pd.notna(row.iloc[2]) else None
                
                if col_a and not col_b:
                    current_group = col_a
                    print(f"Found group: {current_group}")
                    continue
                
                if col_b:
                    field_name = col_b
                    default_value = col_c
                    
                    other_values = []
                    for col_idx in range(3, len(row)):
                        cell_value = row.iloc[col_idx]
                        if pd.notna(cell_value):
                            header_name = str(row2_headers[col_idx]).strip() if col_idx < len(row2_headers) and pd.notna(row2_headers[col_idx]) else None
                            other_values.append({
                                "header": header_name,
                                "value": str(cell_value).strip()
                            })
                    
                    data_definitions[field_name] = {
                        "group_name": current_group,
                        "default_value": default_value,
                        "other_values": other_values
                    }
                    print(f"  Field: {field_name[:40]}, default: {default_value[:30] if default_value else 'None'}, others: {len(other_values)}")
                    
        except Exception as e:
            print(f"Error parsing Data Definitions sheet: {e}")
        
        valid_values_by_field = {}
        try:
            vv_df = pd.read_excel(excel_file, sheet_name="Valid Values", header=None)
            excel_file.seek(0)
            
            for row_idx in range(len(vv_df)):
                row = vv_df.iloc[row_idx]
                
                col_b = row.iloc[1] if len(row) > 1 and pd.notna(row.iloc[1]) else None
                if not col_b:
                    continue
                
                col_b_str = str(col_b)
                
                if " - [" in col_b_str:
                    display_name = col_b_str.split(" - [")[0].strip()
                    bracket_start = col_b_str.find("[")
                    bracket_end = col_b_str.find("]")
                    field_name_hint = col_b_str[bracket_start+1:bracket_end] if bracket_start != -1 and bracket_end != -1 else None
                    
                    values = [str(v).strip() for v in row.iloc[2:] if pd.notna(v)]
                    
                    if field_name_hint:
                        for dd_field_name in data_definitions.keys():
                            if field_name_hint in dd_field_name:
                                if dd_field_name not in valid_values_by_field:
                                    valid_values_by_field[dd_field_name] = []
                                valid_values_by_field[dd_field_name].extend(values)
                                
                                if display_name == "Item Type Keyword":
                                    for value in values:
                                        kw = ProductTypeKeyword(
                                            product_type_id=product_type.id,
                                            keyword=value
                                        )
                                        self.db.add(kw)
                                        keywords_imported += 1
                                break
                    
                    valid_values_imported += len(values)
            
            self.db.commit()
        except Exception as e:
            print(f"Error parsing Valid Values sheet: {e}")
        
        template_field_order = {}
        try:
            template_df = pd.read_excel(excel_file, sheet_name="Template", header=None)
            excel_file.seek(0)
            
            header_rows = []
            for i in range(min(6, len(template_df))):
                row_data = []
                for val in template_df.iloc[i]:
                    if pd.isna(val):
                        row_data.append(None)
                    else:
                        row_data.append(str(val))
                header_rows.append(row_data)
            
            product_type.header_rows = header_rows
            
            row5_field_names = template_df.iloc[4].tolist() if len(template_df) > 4 else []
            row4_display_names = template_df.iloc[3].tolist() if len(template_df) > 3 else []
            row3_groups = template_df.iloc[2].tolist() if len(template_df) > 2 else []
            
            current_group = None
            for idx, field_name in enumerate(row5_field_names):
                if pd.isna(field_name):
                    continue
                
                field_name_str = str(field_name).strip()
                
                group_from_template = str(row3_groups[idx]).strip() if idx < len(row3_groups) and pd.notna(row3_groups[idx]) else None
                if group_from_template:
                    current_group = group_from_template
                
                display_name = str(row4_display_names[idx]).strip() if idx < len(row4_display_names) and pd.notna(row4_display_names[idx]) else None
                
                template_field_order[field_name_str] = {
                    "order_index": idx,
                    "display_name": display_name,
                    "group_from_template": current_group
                }
            
            self.db.commit()
        except Exception as e:
            print(f"Error parsing Template sheet: {e}")
        
        field_name_to_db = {}
        
        for field_name, template_info in template_field_order.items():
            dd_info = data_definitions.get(field_name, {})
            
            group_name = dd_info.get("group_name") or template_info.get("group_from_template")
            display_name = template_info.get("display_name")
            default_value = dd_info.get("default_value")
            
            prev_settings = existing_field_settings.get(field_name, {})
            
            custom_value = prev_settings.get('custom_value')
            if not custom_value and default_value:
                custom_value = default_value
            
            field = ProductTypeField(
                product_type_id=product_type.id,
                field_name=field_name,
                display_name=display_name,
                attribute_group=group_name,
                order_index=template_info["order_index"],
                required=prev_settings.get('required', False),
                selected_value=prev_settings.get('selected_value'),
                custom_value=custom_value
            )
            self.db.add(field)
            self.db.flush()
            field_name_to_db[field_name] = field
            fields_imported += 1
            
            other_values = dd_info.get("other_values", [])
            for ov in other_values:
                field_value = ProductTypeFieldValue(
                    product_type_field_id=field.id,
                    value=ov["value"]
                )
                self.db.add(field_value)
            
            if field_name in valid_values_by_field:
                for value in valid_values_by_field[field_name]:
                    existing_values = [ov["value"] for ov in other_values]
                    if value not in existing_values:
                        field_value = ProductTypeFieldValue(
                            product_type_field_id=field.id,
                            value=value
                        )
                        self.db.add(field_value)
        
        self.db.commit()
        
        print(f"Import complete: {fields_imported} fields, {keywords_imported} keywords, {valid_values_imported} valid values")
        
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
