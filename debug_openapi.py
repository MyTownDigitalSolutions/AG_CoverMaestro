import traceback
import sys

try:
    from app.main import app
    app.openapi()
    with open('openapi_result.txt', 'w') as f:
        f.write('OPENAPI OK\n')
    print('OPENAPI OK')
except Exception as e:
    with open('openapi_error.txt', 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("FULL TRACEBACK:\n")
        f.write("=" * 80 + "\n")
        traceback.print_exc(file=f)
        f.write("\n" + "=" * 80 + "\n")
        f.write(f"Error type: {type(e).__name__}\n")
        f.write(f"Error message: {str(e)}\n")
        f.write("=" * 80 + "\n")
    print("Error written to openapi_error.txt")
    sys.exit(1)
