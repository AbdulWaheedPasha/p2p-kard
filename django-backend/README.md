# P2P Kardh Backend

Scaffolded Django + DRF backend for the P2P Kardh (interest-free P2P lending) platform.

## Local setup

1) Create a virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2) Create your `.env`:

```bash
copy .env.example .env  # Windows
cp .env.example .env    # macOS/Linux
```

3) Run migrations and create a superuser:

```bash
python manage.py runmigrations
python manage.py createsuperuser_from_env
```

4) Start the server:

```bash
python manage.py runserver
```

The API is namespaced under `/api/v1/`.

## Docker

Build and run with Postgres:

```bash
copy .env.example .env  # Windows
cp .env.example .env    # macOS/Linux
docker compose up --build
```

The app runs on `http://localhost:8000` and applies migrations on startup.

## Settings

Default settings module is `kardh.settings.local`. Override via:

```bash
set DJANGO_SETTINGS_MODULE=kardh.settings.prod  # Windows
export DJANGO_SETTINGS_MODULE=kardh.settings.prod  # macOS/Linux
```

## Notes

- JWT auth is configured with SimpleJWT (Bearer tokens).
- PostgreSQL is recommended via `DATABASE_URL`, SQLite is used by default.
- CORS and AWS/Stripe settings are configured via environment variables.

## CI

GitHub Actions runs linting (ruff, flake8) and tests on pushes and PRs. See `.github/workflows/ci.yml`.
