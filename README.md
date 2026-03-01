# ✈️ Multi-Agent Travel Booking App

An AI-powered multi-agent travel booking system leveraging local zero-key LLM mock APIs for flights, hotels, activities, and reservations.

---

## 🛠️ Architecture & Mock API Integration

This project uses [`sanketkakad/llm-api-playground`](https://hub.docker.com/r/sanketkakad/llm-api-playground) from [sanketskakad/llm-mock-apis](https://github.com/sanketskakad/llm-mock-apis) to provide a local, keyless sandbox server and web dashboard for testing LLM Tool Calling.

### Key Mock API Endpoints

| Endpoint | Method | Description | Example Query |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Service Health Check | `/health` |
| `/flights/available_flights` | `GET` | Search Flights | `?origin=Berlin&destination=Paris` |
| `/hotels/available_hotels` | `GET` | Search Hotels | `?city=Paris&rating=4.5` |
| `/thingsToDo/available_activities` | `GET` | Search Activities | `?city=Berlin` |
| `/book` | `POST` | Create Reservation | `{ "name": "Alice", "itemId": "BER-PAR-001" }` |
| `/bookings/active_bookings` | `GET` | List Recorded Bookings | `/bookings/active_bookings` |

---

## ⚡ Quick Start with Docker Compose

### 1. Start Mock APIs Container Only
To launch the mock API sandbox server (`llm-mock-apis`) in the background:

```bash
docker compose up -d llm-mock-apis
```

* **Web Dashboard & API:** `http://localhost:3000`
* **Health Check:** `http://localhost:3000/health`

*Note: If port 3000 is already in use on your host machine, you can specify a custom port:*
```bash
MOCK_API_PORT=3001 docker compose up -d llm-mock-apis
```

### 2. Start Full Service Stack (Mock APIs + Python Agent App)
To launch both the mock APIs container and the multi-agent Python application:

```bash
docker compose up -d --build
```

### 3. Stop Containers
```bash
docker compose down
```

---

## 🐍 Local Python Development with `uv`

If you are running the Python application locally outside Docker while `llm-mock-apis` runs on port `3000`:

```bash
# Set up virtual environment and run main script
uv run main.py
```

To specify a custom API URL:
```bash
MOCK_API_BASE_URL=http://localhost:3001 uv run main.py
```

---

## 📂 Project Structure

```text
.
├── docker-compose.yml   # Multi-container Compose definition (llm-mock-apis + app)
├── Dockerfile           # Multi-stage Python application Dockerfile using uv
├── .dockerignore        # Docker build ignore patterns
├── .env.example         # Environment variable template
├── main.py              # Application entrypoint & API verification script
├── pyproject.toml       # Python project configuration (uv)
└── README.md            # Project documentation
```

---

## 🚀 Deployment Strategy (Hugging Face Spaces)

This section explains how to deploy a unified React frontend and FastAPI/LangGraph backend to Hugging Face Spaces using the Docker SDK.

### The Single-Port Constraint
Hugging Face Spaces exposes only a single public port (by default, port `7860`). Therefore, to run a separate React frontend and a FastAPI backend together, the recommended deployment pattern is:
1. **Multi-Stage Build**: Compile the React frontend into static assets (HTML/CSS/JS).
2. **Serve from Backend**: Mount and serve the compiled static assets directly via FastAPI using `StaticFiles`.
3. **API Prefixing**: Expose the backend endpoints under a prefixed path (e.g. `/api/...`).

### Dockerfile Setup for Hugging Face Spaces
Create or update your `Dockerfile` at the root of the project to build both applications:

```dockerfile
# --- Stage 1: Build React Frontend ---
FROM node:20 AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python Backend & Execution ---
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app

# Install Python dependencies
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project

# Copy backend code
COPY backend/ ./

# Copy React build files from Stage 1 into the backend's static directory
COPY --from=frontend-builder /frontend/dist ./static

# Expose Hugging Face's default port
EXPOSE 7860
ENV PORT=7860

# Run the FastAPI server
CMD ["uv", "run", "main.py"]
```

### FastAPI Config for Static Serving
To serve the static React assets from FastAPI, update your `main.py`:

```python
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

# 1. API Route Example
@app.post("/api/travelplan")
def get_travel_plan(request: QueryRequest):
    return {"response": "Travel plan generated successfully."}

# 2. Serve React static asset files
app.mount("/assets", StaticFiles(directory="static/assets"), name="static")

# 3. Catch-all route to serve index.html (supports React Router client-side navigation)
@app.get("/{catchall:path}")
def serve_frontend(catchall: str):
    return FileResponse("static/index.html")
```

---

## 🧑‍🏫 Step-by-Step Setup Guide (For Students)

This guide walks you through the step-by-step setup of this project, explaining package management, Docker setup, and FastAPI CORS configuration.

### Step 1: Initialize the Project with `uv`
Instead of standard `pip` and `venv`, this project uses **`uv`** (a fast Python package manager written in Rust).
To initialize a new Python project specifying Python version 3.14 (or any version compatible with your requirements):
```bash
uv init --python 3.14
```
This automatically generates:
1. `pyproject.toml`: The metadata configuration file for your Python project.
2. `main.py`: A simple hello-world script.
3. `.python-version`: A file specifying the local Python runtime version.

### Step 2: Docker Containerization Setup
To ensure the backend runs identically in development and production environments, we containerize it alongside our mock travel API server.

#### 1. The `Dockerfile`
The `Dockerfile` instructs Docker how to package the FastAPI application using the slim Python runtime and the `uv` package installer.
```dockerfile
# Use the official lightweight uv image with python 3.12/3.14
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Enable bytecode compilation for performance
ENV UV_COMPILE_BYTECODE=1

# Copy project definitions
COPY pyproject.toml .python-version ./

# Cache mounts speed up subsequent dependency installations
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project || uv sync --no-install-project

# Copy the rest of the application code
COPY . .

# Set default env variables
ENV MOCK_API_BASE_URL=http://llm-mock-apis:3000
ENV PYTHONUNBUFFERED=1

# Execute the application
CMD ["uv", "run", "main.py"]
```

#### 2. Multi-Container Orchestration (`docker-compose.yml`)
The `docker-compose.yml` orchestrates two containers:
1. `llm-mock-apis`: The sandbox API server that simulates flights, hotels, and activities.
2. `app`: Our Python FastAPI backend application.
```yaml
services:
  # 1. LLM Mock APIs Sandbox Server
  llm-mock-apis:
    image: sanketkakad/llm-api-playground:latest
    container_name: llm-mock-apis
    ports:
      - "${MOCK_API_PORT:-3000}:3000"
    environment:
      - PORT=3000
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s
    restart: unless-stopped

  # 2. Multi-Agent Travel Booking Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: multi-agents-travel-booking-app
    environment:
      - MOCK_API_BASE_URL=http://llm-mock-apis:3000
    depends_on:
      llm-mock-apis:
        # Ensures our app starts only after the mock API service passes healthchecks
        condition: service_healthy
    restart: unless-stopped
```

### Step 3: Configure FastAPI and Enable CORS
FastAPI is a modern, high-performance web framework for building APIs. To allow a separate frontend app (running on a different domain or port) to fetch data from this backend, we must enable **CORS (Cross-Origin Resource Sharing)**.

#### 1. Add Dependencies
Install `fastapi` and `uvicorn` (the ASGI web server) to your project:
```bash
uv add fastapi uvicorn
```
This updates the `dependencies` list in `pyproject.toml`:
```toml
dependencies = [
    "fastapi>=0.141.1",
    "uvicorn>=0.52.1",
]
```

#### 2. Write the API Server (`main.py`)
Modify `main.py` to initialize the FastAPI app, register the CORS middleware, add simple endpoints, and set up the startup script.
```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI application
app = FastAPI(title="Multi-Agent Travel Booking API")

# Configure CORS Middleware
# This allows browsers to bypass origin-restrictions when requests are made from the frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],             # In production, specify your frontend domain e.g. ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],             # Allows all HTTP methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],             # Allows all headers
)

# Define sample routes
@app.get("/")
def read_root():
    return {"message": "Welcome to the Multi-Agent Travel Booking API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Run the server when executing the file directly
if __name__ == "__main__":
    import uvicorn
    # Use PORT environment variable if available (e.g. inside Docker), fallback to 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
```
