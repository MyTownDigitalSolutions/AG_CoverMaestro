from app.models.core import Model, Series, Manufacturer, EquipmentType
from app.api.export import substitute_placeholders
import re
import traceback

# Mock classes
class MockObj:
    def __init__(self, name):
        self.name = name

def log(msg):
    print(msg)
    with open("verification.log", "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def test_truncation():
    # clear log
    with open("verification.log", "w", encoding="utf-8") as f:
        f.write("Starting Verification\n")

    mfr = MockObj("Fender")
    et = MockObj("Guitar Case")
    
    # Template
    val = "[SERIES_NAME] [MODEL_NAME]"
    
    log("--- Test 1: Short (No Truncation) ---")
    s_short = MockObj("A")
    m_short = MockObj("B")
    res = substitute_placeholders(val, m_short, s_short, mfr, et, max_length=40)
    log(f"Result: '{res}' (Len: {len(res)})")
    if res != "A B":
        log(f"FAILURE: Expected 'A B', got '{res}'")
        raise AssertionError(f"Expected 'A B', got '{res}'")
    
    log("\n--- Test 2: Truncation Needed (Long Series) ---")
    # Series: 35 chars
    s_long = MockObj("Super Long Series Name That Takes A") 
    # Model: 10 chars
    m_med = MockObj("Model Name")
    # Total nominal: 35 + 1 + 10 = 46 chars.
    # Expected: Model (10) + Space (1) = 11 chars reserved.
    # Available for Series: 40 - 11 = 29 chars.
    # Expected Result: s_long[:29] + " " + m_med.name
    
    res = substitute_placeholders(val, m_med, s_long, mfr, et, max_length=40)
    log(f"Result: '{res}' (Len: {len(res)})")
    
    expected_series = s_long.name[:29]
    expected = f"{expected_series} {m_med.name}"
    log(f"Expected: '{expected}' (Len: {len(expected)})")
    
    if res != expected:
        log(f"FAILURE: Expected '{expected}', got '{res}'")
        raise AssertionError(f"Expected '{expected}', got '{res}'")
    if len(res) > 40:
        log("FAILURE: Length > 40")
        raise AssertionError("Length > 40")

    log("\n--- Test 3: Truncation Needed (Huge Model Name) ---")
    s_normal = MockObj("Series")
    m_huge = MockObj("Really Long Model Name That Exceeds The Limit By Itself") # 55 chars
    
    res = substitute_placeholders(val, m_huge, s_normal, mfr, et, max_length=40)
    log(f"Result: '{res}' (Len: {len(res)})")
    
    # Logic forecast:
    # 1. Replace Model: "[SERIES_NAME] Really..."
    # 2. Budget for Series: 40 - (High Number) < 0
    # 3. Series -> ""
    # 4. Result: " Really..." 
    # 5. Hard Truncate to 40.
    
    if len(res) > 40:
        log("FAILURE: Length > 40")
        raise AssertionError("Length > 40")
    
    expected_huge = " Really Long Model Name That Exceeds The"
    if res != expected_huge:
        log(f"FAILURE: Expected '{expected_huge}', got '{res}'")
        raise AssertionError(f"Expected '{expected_huge}', got '{res}'")

    log("\n--- Test 4: Exact Fit ---")
    s_fit = MockObj("A" * 19)
    m_fit = MockObj("B" * 20)
    # 19 + 1 + 20 = 40
    res = substitute_placeholders(val, m_fit, s_fit, mfr, et, max_length=40)
    log(f"Result: '{res}' (Len: {len(res)})")
    if len(res) != 40:
        log(f"FAILURE: Expected 40 chars, got {len(res)}")
        raise AssertionError(f"Expected 40 chars, got {len(res)}")
    if res != f"{s_fit.name} {m_fit.name}":
        log(f"FAILURE: Mismatch contents")
        raise AssertionError("Mismatch")

    log("\n--- Test 5: Placeholder Variants ([Series_Name]) ---")
    val_var = "[Series_Name] [Model_Name]"
    res = substitute_placeholders(val_var, m_med, s_long, mfr, et, max_length=40)
    log(f"Result: '{res}' (Len: {len(res)})")
    
    expected_series = s_long.name[:29]
    expected = f"{expected_series} {m_med.name}"
    
    if res != expected:
        log(f"FAILURE: Expected '{expected}', got '{res}'")
        raise AssertionError(f"Expected '{expected}', got '{res}'")

if __name__ == "__main__":
    try:
        test_truncation()
        log("\nALL TESTS PASSED")
    except Exception as e:
        log("\n!!! TEST FAILED !!!")
        log(str(e))
        traceback.print_exc()
        raise e
