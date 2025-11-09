# Mahidol Forum Backend (FastAPI)

This FastAPI service exposes authenticated endpoints that proxy Supabase for forum threads, posts, and LINE group applications. It uses the Supabase service role key to perform privileged operations and validates end-user JWTs to enforce permissions.

## Features

- Supabase-backed CRUD for `threads`, `posts`, and `line_applications` tables.
- JWT validation via Supabase Auth (`Authorization: Bearer <access_token>` coming from the frontend).
- CORS configured for the Vite frontend (`http://localhost:5173` by default).
- Health check at `/healthz` for easy monitoring.

## Requirements

- Python 3.11+
- Environment variables:
  - `SUPABASE_URL` – your project URL (`https://miwhruqwrhbppaxexptc.supabase.co`).
  - `SUPABASE_SERVICE_KEY` – Supabase service-role key (keep this secret; never ship to the frontend).
  - `CORS_ALLOW_ORIGINS` *(optional)* – comma-separated list of origins allowed to call the API. Defaults to `http://localhost:5173`.

Create a `.env` file in `backend/` for local development:

```env
SUPABASE_URL=https://miwhruqwrhbppaxexptc.supabase.co
SUPABASE_SERVICE_KEY=your-service-role
CORS_ALLOW_ORIGINS=http://localhost:5173
```

> ⚠️ Use the **service role key** on the backend only. Never expose it in the browser.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## API Overview

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/threads/` | Public threads feed with author meta & reply counts | Optional |
| POST | `/threads/` | Create a new thread | Required |
| GET | `/threads/{id}` | Thread detail including ordered posts | Optional |
| POST | `/threads/{id}/posts` | Add a reply | Required |
| POST | `/line-applications/` | Submit LINE group application | Required |
| GET | `/healthz` | Health check | Public |

### Authentication Flow

1. Frontend uses Supabase Auth to sign-in and receives an access token.
2. Requests to the backend include `Authorization: Bearer <token>`.
3. The backend verifies the token via `supabase.auth.get_user(token)`.
4. On success, the FastAPI dependency injects the Supabase user into the route handler.

### Sample Request

```bash
curl -X POST http://localhost:8000/threads/ \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Welcome to Mahidol Forum",
    "category": "General",
    "summary": "Introduce yourself and meet the community"
  }'
```

## Integration Notes

- The frontend can switch to using this backend by pointing its API calls to `http://localhost:8000` (or your deployed URL).
- For production deployments, keep environment secrets in your infrastructure (e.g., Docker secrets, cloud environment variables).
- Extend `routers/` with admin/moderation routes or additional modules (marketplace, groups, etc.) following the same patterns.


