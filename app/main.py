import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config.settings import PORT
from app.controllers.agent_controller import router as agent_router
from app.controllers.mock_controller import mock_router

app = FastAPI(
    title="Multi-Agent Travel Booking API",
    description="Enterprise Multi-Agent AI Travel Planning & Booking Service",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route controllers
app.include_router(agent_router, prefix="/api", tags=["Agent Workflow"])
app.include_router(mock_router, prefix="/mock-api", tags=["Database Mock API"])

@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server Error: {str(exc)}"}
    )

# Static file serving & SPA single-page routing
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(base_dir, "static")

if not os.path.exists(static_dir):
    alt_static = os.path.join(os.getcwd(), "static")
    if os.path.exists(alt_static):
        static_dir = alt_static

assets_dir = os.path.join(static_dir, "assets")

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/favicon.svg")
def serve_favicon():
    favicon_path = os.path.join(static_dir, "favicon.svg")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return JSONResponse(status_code=404, content={"detail": "Favicon not found"})

@app.get("/")
@app.get("/ui")
@app.get("/app")
def serve_root_index():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )
    return JSONResponse(status_code=404, content={"detail": f"Index file not found at {index_file}"})

@app.get("/{full_path:path}")
def serve_spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("mock-api/"):
        return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})
    
    file_path = os.path.join(static_dir, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
        
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )
    return JSONResponse(status_code=404, content={"detail": "Page not found"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
