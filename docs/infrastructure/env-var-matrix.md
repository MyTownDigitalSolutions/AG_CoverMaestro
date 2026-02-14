# Environment Variable Matrix

This document serves as the canonical reference for all environment variables required by the AG CoverMaestro application. It is used to generate `.env.example` and validate configuration in `app/config.py`.

## Core Configuration

| Variable Name | Required | Default | Description | Usage Location |
| :--- | :---: | :--- | :--- | :--- |
| `ENV` | No | `development` | Operational environment (development, production, testing). | `app/main.py`, `app/config.py` |

## Database Connections

| Variable Name | Required | Default | Description | Usage Location |
| :--- | :---: | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | - | Primary database connection string for the running application (Transaction Pooler recommended). | `app/database.py`, `alembic/env.py` |
| `MIGRATION_DATABASE_URL` | No | `DATABASE_URL` | Connection string for Alembic migrations (Session Pooler required for IPv4 compatibility). | `alembic/env.py` |

## Security & Admin

| Variable Name | Required | Default | Description | Usage Location |
| :--- | :---: | :--- | :--- | :--- |
| `ADMIN_KEY` | No | `""` | API Key for protecting sensitive admin endpoints (e.g., resets). | `app/api/customers.py`, `app/api/marketplace_orders.py`, `marketplace_credentials.py` |
| `CREDENTIALS_MASTER_KEY` | No | `""` | Master key for encrypting/decrypting stored marketplace credentials. | `app/api/marketplace_credentials.py`, `reverb_service.py` |
| `ALLOW_PLAINTEXT_CREDENTIALS` | No | `false` | **Unsafe:** Allows bypassing encryption for credentials. Local dev only. | `app/api/marketplace_credentials.py`, `reverb_service.py` |
| `ENABLE_CREDENTIALS_REVEAL` | No | `false` | **Unsafe:** Allows Admin API to return decrypted credentials. Debugging only. | `app/api/marketplace_credentials.py` |

## Notes

- **Missing Variables**: If `DATABASE_URL` is missing, the application **must fail to start**.
- **Defaults**: Defaults provided above are for the application logic; actual deployment environments should strictly define these.
- **Boolean Parsing**: Variables like `ALLOW_PLAINTEXT_CREDENTIALS` are parsed by checking `.lower() == "true"`.
