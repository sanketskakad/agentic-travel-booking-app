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
ENV PORT=7860
ENV MOCK_API_BASE_URL=http://localhost:3000

# Install Node.js for mock database server
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set up app directory and permissions for Hugging Face non-root user (UID 1000)
WORKDIR /app
RUN mkdir -p /app && chown -R 1000:1000 /app

# Copy python dependencies definition
COPY pyproject.toml uv.lock ./

# Install python project dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project || uv sync --no-install-project

# Copy mock backend code and install its npm dependencies
COPY --chown=1000:1000 mock-backend/ /app/mock-backend/
WORKDIR /app/mock-backend
RUN npm install --production

# Return to app directory
WORKDIR /app

# Copy application source code
COPY --chown=1000:1000 . .

# Copy static frontend assets built in stage 1
COPY --from=frontend-builder --chown=1000:1000 /build/dist /app/static

# Make start.sh executable and set ownership
RUN chmod +x /app/start.sh && chown 1000:1000 /app/start.sh

# Switch to Hugging Face non-root user
USER 1000

# Expose port 7860 for Hugging Face Spaces
EXPOSE 7860

# Run entrypoint script
CMD ["/app/start.sh"]
