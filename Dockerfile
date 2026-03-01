FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy project definition files
COPY pyproject.toml .python-version ./

# Install project dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project || uv sync --no-install-project

# Copy application source code
COPY . .

# Environment defaults
ENV MOCK_API_BASE_URL=http://llm-mock-apis:3000
ENV PYTHONUNBUFFERED=1

CMD ["uv", "run", "main.py"]
