#!/bin/bash
# Start the FastAPI agent server on dynamic PORT (default 8000)
PORT=${PORT:-8000}
echo "Starting FastAPI agent server on port ${PORT}..."
exec /app/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
