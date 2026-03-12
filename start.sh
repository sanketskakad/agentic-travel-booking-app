#!/bin/bash
# Start the mock backend database server on port 3000
echo "Starting mock API database server on port 3000..."
node /app/mock-backend/index.js &

# Start the FastAPI agent server on dynamic PORT (default 8000)
PORT=${PORT:-8000}
echo "Starting FastAPI agent server on port ${PORT}..."
exec uv run uvicorn main:app --host 0.0.0.0 --port ${PORT}
