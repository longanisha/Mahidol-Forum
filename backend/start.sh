#!/bin/bash
cd "$(dirname "$0")"
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
