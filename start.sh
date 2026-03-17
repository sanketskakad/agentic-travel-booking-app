#!/bin/bash
# Start the FastAPI agent server on dynamic PORT (default 8000)
PORT=${PORT:-8000}
PYTHON_BIN="python"

if [ -f "/app/.venv/bin/python" ]; then
    PYTHON_BIN="/app/.venv/bin/python"
elif [ -f ".venv/bin/python" ]; then
    PYTHON_BIN=".venv/bin/python"
fi

echo "Starting FastAPI agent server on port ${PORT} using ${PYTHON_BIN}..."
exec ${PYTHON_BIN} -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}

