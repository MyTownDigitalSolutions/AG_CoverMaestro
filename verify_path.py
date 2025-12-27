import os

print(f"CWD: {os.getcwd()}")
# The path provided in prompt has backslashes and forward slashes mixed?
# "attached_assets/product_type_templates\SOUND_AND_RECORDING_EQUIPMENT_20251227_041547_SOUND_AND_RECORDING_EQUIPMENT(ALLKEYWORDS).xlsm"
# I'll use it exactly as provided but handle path separators.
db_path = r"attached_assets/product_type_templates\SOUND_AND_RECORDING_EQUIPMENT_20251227_041547_SOUND_AND_RECORDING_EQUIPMENT(ALLKEYWORDS).xlsm"

print(f"\n--- Path Resolution ---")
print(f"Raw: {db_path}")
# Fix mixed separators for Windows
fixed_path = db_path.replace('/', os.sep).replace('\\', os.sep)
norm_path = os.path.normpath(fixed_path)
print(f"Norm: {norm_path}")
abs_path = os.path.abspath(norm_path)
print(f"Abs: {abs_path}")

exists = os.path.exists(abs_path)
print(f"Exists: {exists}")
if exists:
    print(f"Size: {os.path.getsize(abs_path)} bytes")

print(f"\n--- Directory Listing ---")
base = "attached_assets"
if os.path.exists(base):
    print(f"Listing {base}: {os.listdir(base)}")
    sub = os.path.join(base, "product_type_templates")
    if os.path.exists(sub):
        print(f"Listing {sub}:")
        files = os.listdir(sub)
        found = False
        for f in files:
            # Check by substring to be safe
            if "SOUND_AND_RECORDING_EQUIPMENT_20251227_041547" in f:
                print(f"  MATCH: {f}")
                found = True
        if not found:
            print("  Target file NOT found in listing.")
            print(f"  Full list: {files}")
    else:
        print(f"{sub} does not exist.")
else:
    print(f"{base} does not exist.")
