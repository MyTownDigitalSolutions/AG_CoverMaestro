import os
from app.main import app

def main():
    """Local entrypoint parity for platforms that invoke `python main.py`."""
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    main()
