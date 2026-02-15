import os
import pytest
from pydantic import ValidationError
from app.config import Settings

@pytest.fixture
def mock_env(monkeypatch):
    """Clear existing env vars to avoid .env interference"""
    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/db")
    monkeypatch.setenv("MIGRATION_DATABASE_URL", "postgresql://user:pass@localhost/db")
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-key")

def test_settings_load_correctly(mock_env):
    # Ensure we don't read from .env file by overriding _env_file
    try:
        settings = Settings(_env_file=None)
        assert settings.ENV == "test"
        assert settings.DATABASE_URL == "postgresql://user:pass@localhost/db"
        assert settings.SUPABASE_KEY == "test-key"
    except ValidationError as e:
        pytest.fail(f"Validation failed: {e}")

def test_settings_fail_on_missing_vars(monkeypatch):
    # Clear critical env vars
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
