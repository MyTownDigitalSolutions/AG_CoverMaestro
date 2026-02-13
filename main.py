from app.main import app


def main():
    """Local entrypoint parity for platforms that invoke `python main.py`."""
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    main()
