# ── Stage 1: Build the Vite React frontend ──
FROM node:20-slim AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ── Stage 2: Final runner environment ──
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Set up environment variables
ENV UV_COMPILE_BYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV USE_LOCAL_MOCK=true
ENV UV_CACHE_DIR=/tmp/uv-cache
ENV UV_LINK_MODE=copy
ENV UV_PYTHON_INSTALL_DIR=/app/.python

# Set up app directory and permissions
WORKDIR /app
RUN mkdir -p /app && chown -R 1000:1000 /app

# Copy python dependencies definition
COPY pyproject.toml uv.lock ./

# Install python project dependencies
RUN --mount=type=cache,target=/tmp/uv-cache \
    uv sync --frozen --no-install-project || uv sync --no-install-project

# Copy application source code
COPY --chown=1000:1000 . .

# Copy static frontend assets built in stage 1
COPY --from=frontend-builder --chown=1000:1000 /build/dist /app/static

# Ensure everything inside /app is owned by the non-root user
RUN chown -R 1000:1000 /app

# Make start.sh executable
RUN chmod +x /app/start.sh

# Switch to non-root user
USER 1000

# Expose default port
EXPOSE 8000

# Run entrypoint script
CMD ["/app/start.sh"]
