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
        Import Amazon template with this EXACT logic:
        
        STEP 1: Parse DATA DEFINITIONS sheet
        - Row 2 = Headers (Group Name, Field Name, Local Label Name, ...)
        - Row 3+: When Column A has value and Column B is empty = GROUP NAME
        - Following rows: Column A empty, Column B = Field Name, Column C = Local Label Name
        - This gives us the mapping of groups -> fields -> local labels
        
        STEP 2: Parse VALID VALUES sheet
        - Column A = Group names (when present, marks new group)
        - Column B = "Local Label Name - [ FIELD_HINT ]" format
        - Column C onwards = Valid values user can select from
        - Match to Data Definitions by local label name
        
        STEP 3: Parse DEFAULT VALUES sheet
        - Row 1 = Headers
        - Column A = Local Label Name
        - Column B = Field Name  
        - Column C = Default Value (what should be pre-selected)
        - Column D+ = "Other Value" - additional values to ADD to valid values
        
        STEP 4: Parse TEMPLATE sheet
        - Get field order for export
        - Get display names from row 4
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
        
        field_definitions = {}
        local_label_to_field = {}
        
        try:
            dd_df = pd.read_excel(excel_file, sheet_name="Data Definitions", header=None)
            excel_file.seek(0)
            
            current_group = None
            
            for row_idx in range(2, len(dd_df)):
                row = dd_df.iloc[row_idx]
                
                col_a = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
                col_b = str(row.iloc[1]).strip() if len(row) > 1 and pd.notna(row.iloc[1]) else None
                col_c = str(row.iloc[2]).strip() if len(row) > 2 and pd.notna(row.iloc[2]) else None
                
                if col_a and not col_b:
                    current_group = col_a
                    print(f"[DD] Group: {current_group}")
                    continue
                
                if col_b:
                    field_name = col_b
                    local_label = col_c
                    
                    field_definitions[field_name] = {
                        "group_name": current_group,
                        "local_label": local_label,
                        "valid_values": [],
                        "default_value": None,
                        "other_values": []
                    }
                    
                    if local_label:
                        local_label_to_field[local_label] = field_name
                    
                    print(f"[DD]   Field: {field_name[:50]} -> Label: {local_label}")
            
            print(f"[DD] Total fields from Data Definitions: {len(field_definitions)}")
            
        except Exception as e:
            print(f"Error parsing Data Definitions sheet: {e}")
        
        try:
            vv_df = pd.read_excel(excel_file, sheet_name="Valid Values", header=None)
            excel_file.seek(0)
            
            current_vv_group = None
            
            for row_idx in range(len(vv_df)):
                row = vv_df.iloc[row_idx]
                
                col_a = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
                col_b = str(row.iloc[1]).strip() if len(row) > 1 and pd.notna(row.iloc[1]) else None
                
                if col_a and not col_b:
                    current_vv_group = col_a
                    print(f"[VV] Group: {current_vv_group}")
                    continue
                
                if col_b:
                    local_label_part = None
                    field_hint = None
                    
                    if " - [" in col_b:
                        parts = col_b.split(" - [")
                        local_label_part = parts[0].strip()
                        if len(parts) > 1:
                            field_hint = parts[1].rstrip("]").strip()
                    else:
                        local_label_part = col_b
                    
                    values = [str(v).strip() for v in row.iloc[2:] if pd.notna(v)]
                    
                    matched_field = None
                    
                    if local_label_part and local_label_part in local_label_to_field:
                        matched_field = local_label_to_field[local_label_part]
                    
                    if not matched_field and field_hint:
                        for fn in field_definitions.keys():
                            if field_hint in fn:
                                matched_field = fn
                                break
                    
                    if not matched_field and local_label_part:
                        for label, fn in local_label_to_field.items():
                            if local_label_part.lower() in label.lower() or label.lower() in local_label_part.lower():
                                matched_field = fn
                                break
                    
                    if matched_field:
                        field_definitions[matched_field]["valid_values"].extend(values)
                        valid_values_imported += len(values)
                        print(f"[VV]   Matched '{local_label_part}' to field, {len(values)} values")
                        
                        if local_label_part == "Item Type Keyword":
                            for value in values:
                                kw = ProductTypeKeyword(
                                    product_type_id=product_type.id,
                                    keyword=value
                                )
                                self.db.add(kw)
                                keywords_imported += 1
                    else:
                        print(f"[VV]   No match for: {local_label_part}")
            
            self.db.commit()
            print(f"[VV] Valid values imported: {valid_values_imported}")
            
        except Exception as e:
            print(f"Error parsing Valid Values sheet: {e}")
        
        try:
            dv_df = pd.read_excel(excel_file, sheet_name="Default Values", header=None)
            excel_file.seek(0)
            
            for row_idx in range(1, len(dv_df)):
                row = dv_df.iloc[row_idx]
                
                col_a_local_label = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
                col_b_field_name = str(row.iloc[1]).strip() if len(row) > 1 and pd.notna(row.iloc[1]) else None
                col_c_default = str(row.iloc[2]).strip() if len(row) > 2 and pd.notna(row.iloc[2]) else None
                
                if not col_a_local_label and not col_b_field_name:
                    continue
                
                matched_field = None
                
                if col_b_field_name and col_b_field_name in field_definitions:
                    matched_field = col_b_field_name
                elif col_a_local_label and col_a_local_label in local_label_to_field:
                    matched_field = local_label_to_field[col_a_local_label]
                
                if not matched_field and col_b_field_name:
                    for fn in field_definitions.keys():
                        if col_b_field_name in fn or fn in col_b_field_name:
                            matched_field = fn
                            break
                
                if matched_field:
                    if col_c_default:
                        field_definitions[matched_field]["default_value"] = col_c_default
                        print(f"[DV]   Default for '{matched_field[:40]}': {col_c_default[:30]}")
                    
                    other_values = [str(v).strip() for v in row.iloc[3:] if pd.notna(v)]
                    if other_values:
                        existing_vals = field_definitions[matched_field]["valid_values"]
                        for ov in other_values:
                            if ov not in existing_vals:
                                field_definitions[matched_field]["other_values"].append(ov)
                        print(f"[DV]   Other values for '{matched_field[:40]}': {len(other_values)}")
            
            print(f"[DV] Default values processed")
            
        except Exception as e:
            print(f"Default Values sheet not found or error: {e}")
        
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
            print(f"[Template] Fields in template: {len(template_field_order)}")
            
        except Exception as e:
            print(f"Error parsing Template sheet: {e}")
        
        field_name_to_db = {}
        
        for field_name, template_info in template_field_order.items():
            dd_info = field_definitions.get(field_name, {})
            
            group_name = dd_info.get("group_name") or template_info.get("group_from_template")
            local_label = dd_info.get("local_label")
            display_name = template_info.get("display_name") or local_label
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
            
            all_values = dd_info.get("valid_values", []) + dd_info.get("other_values", [])
            seen_values = set()
            for value in all_values:
                if value not in seen_values:
                    seen_values.add(value)
                    field_value = ProductTypeFieldValue(
                        product_type_field_id=field.id,
                        value=value
                    )
                    self.db.add(field_value)
        
        self.db.commit()
        
        print(f"[DONE] Import complete: {fields_imported} fields, {keywords_imported} keywords, {valid_values_imported} valid values")
        
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
