import sys
import importlib

# Force module reload by removing from cache
if 'app.api.export' in sys.modules:
    del sys.modules['app.api.export']
if 'app.main' in sys.modules:
    del sys.modules['app.main']

# Now import fresh
from app.main import app

# Try to generate OpenAPI
try:
    schema = app.openapi()
    print("✅ OPENAPI OK")
    print(f"✅ Endpoints: {len(schema.get('paths', {}))}")
    print(f"✅ Schemas: {len(schema.get('components', {}).get('schemas', {}))}")
except Exception as e:
    print("❌ OPENAPI FAILED")
    print(f"Error: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
