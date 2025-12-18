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
        
        STEP 1: DATA DEFINITIONS sheet - ONLY get:
          - Group names (Column A when Column B is empty)
          - Field names (Column B)
          - Local Label names (Column C)
          - Column D is just descriptions, NOT valid values!
        
        STEP 2: VALID VALUES sheet - Get selectable options:
          - Column A = Group name (when Column B empty)
          - Column B = "Local Label - [field_hint]" format
          - Column C onwards = The actual valid values users can select
        
        STEP 3: DEFAULT VALUES sheet - Get defaults and additional values:
          - Column A = Local Label Name
          - Column B = Field Name
          - Column C = Default value to pre-select
          - Column D onwards = Additional values to ADD to valid values
        
        STEP 4: TEMPLATE sheet - Get field order for export
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
        
        print("=" * 60)
        print("STEP 1: Parsing DATA DEFINITIONS sheet")
        print("=" * 60)
        
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
                    print(f"  GROUP: {current_group}")
                    continue
                
                if col_b:
                    field_name = col_b
                    local_label = col_c
                    
                    field_definitions[field_name] = {
                        "group_name": current_group,
                        "local_label": local_label
                    }
                    
                    if local_label:
                        local_label_to_field[local_label] = field_name
                    
                    print(f"    Field: {field_name[:40]}... | Label: {local_label}")
            
            print(f"  TOTAL: {len(field_definitions)} fields from Data Definitions")
            
        except Exception as e:
            print(f"  ERROR: {e}")
        
        valid_values_by_field = {}
        
        print("=" * 60)
        print("STEP 2: Parsing VALID VALUES sheet")
        print("=" * 60)
        
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
                    print(f"  GROUP: {current_vv_group}")
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
                        if matched_field not in valid_values_by_field:
                            valid_values_by_field[matched_field] = []
                        valid_values_by_field[matched_field].extend(values)
                        valid_values_imported += len(values)
                        print(f"    Matched '{local_label_part}' -> {len(values)} values")
                        
                        if local_label_part == "Item Type Keyword":
                            for value in values:
                                kw = ProductTypeKeyword(
                                    product_type_id=product_type.id,
                                    keyword=value
                                )
                                self.db.add(kw)
                                keywords_imported += 1
                    else:
                        print(f"    NO MATCH: {local_label_part}")
            
            self.db.commit()
            print(f"  TOTAL: {valid_values_imported} valid values")
            
        except Exception as e:
            print(f"  ERROR: {e}")
        
        template_field_order = {}
        
        print("=" * 60)
        print("STEP 3: Parsing TEMPLATE sheet")
        print("=" * 60)
        
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
            print(f"  TOTAL: {len(template_field_order)} fields in template")
            
        except Exception as e:
            print(f"  ERROR: {e}")
        
        all_known_fields = set(field_definitions.keys()) | set(template_field_order.keys())
        
        default_values_by_field = {}
        other_values_by_field = {}
        
        print("=" * 60)
        print("STEP 4: Parsing DEFAULT VALUES sheet")
        print("=" * 60)
        
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
                
                if col_b_field_name and col_b_field_name in all_known_fields:
                    matched_field = col_b_field_name
                elif col_a_local_label and col_a_local_label in local_label_to_field:
                    matched_field = local_label_to_field[col_a_local_label]
                
                if not matched_field and col_b_field_name:
                    for fn in all_known_fields:
                        if col_b_field_name in fn or fn in col_b_field_name:
                            matched_field = fn
                            break
                
                if matched_field:
                    if col_c_default:
                        default_values_by_field[matched_field] = col_c_default
                        print(f"    Default: {col_a_local_label} = {col_c_default[:30]}...")
                    
                    other_values = [str(v).strip() for v in row.iloc[3:] if pd.notna(v)]
                    if other_values:
                        if matched_field not in other_values_by_field:
                            other_values_by_field[matched_field] = []
                        other_values_by_field[matched_field].extend(other_values)
                        print(f"    Other values: {col_a_local_label} +{len(other_values)}")
                else:
                    if col_b_field_name:
                        print(f"    NO MATCH: {col_a_local_label} | {col_b_field_name[:40]}...")
            
            print(f"  TOTAL: {len(default_values_by_field)} defaults, {len(other_values_by_field)} with other values")
            
        except Exception as e:
            print(f"  Default Values sheet: {e}")
        
        print("=" * 60)
        print("STEP 5: Creating database records")
        print("=" * 60)
        
        field_name_to_db = {}
        
        for field_name, template_info in template_field_order.items():
            dd_info = field_definitions.get(field_name, {})
            
            group_name = dd_info.get("group_name") or template_info.get("group_from_template")
            local_label = dd_info.get("local_label")
            display_name = template_info.get("display_name") or local_label
            default_value = default_values_by_field.get(field_name)
            
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
            
            all_values = []
            if field_name in valid_values_by_field:
                all_values.extend(valid_values_by_field[field_name])
            if field_name in other_values_by_field:
                for ov in other_values_by_field[field_name]:
                    if ov not in all_values:
                        all_values.append(ov)
            if default_value and default_value not in all_values:
                all_values.insert(0, default_value)
            
            for value in all_values:
                field_value = ProductTypeFieldValue(
                    product_type_field_id=field.id,
                    value=value
                )
                self.db.add(field_value)
        
        self.db.commit()
        
        print(f"  Created {fields_imported} fields")
        print("=" * 60)
        print(f"DONE: {fields_imported} fields, {keywords_imported} keywords, {valid_values_imported} valid values")
        print("=" * 60)
        
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
