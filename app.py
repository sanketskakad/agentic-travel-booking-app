import os
import gradio as gr
from main import app as fastapi_app
import spaces

@spaces.GPU
def dummy_gpu_func():
    print("ZeroGPU function invoked during startup successfully.")
    return True

# Explicitly invoke the ZeroGPU function during startup
try:
    dummy_gpu_func()
except Exception as e:
    print(f"ZeroGPU init call note: {e}")
from fastapi.responses import FileResponse

static_dir = os.path.join(os.path.dirname(__file__), "static")

# Create a minimal Gradio Block container to satisfy HF Space SDK requirements
with gr.Blocks(title="Agentic Travel Planner Service") as demo:
    gr.Markdown("# ✈️ Agentic Travel Planner Service")

# Mount Gradio onto the FastAPI app under /gradio
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

# Explicitly override the GET / route to serve our compiled React index.html
@app.get("/")
def serve_react_ui():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"status": "ok", "message": "Travel Planner Backend"}

demo.app = app

demo.launch()
