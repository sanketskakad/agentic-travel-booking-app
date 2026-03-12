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

# Create a Gradio container pointing to our FastAPI /ui route
with gr.Blocks(title="Agentic Travel Planner") as demo:
    gr.HTML("<iframe src='/ui' style='width:100%; height:100vh; border:none;'></iframe>")

# Mount Gradio onto the FastAPI app under /gradio
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

# Explicitly serve React UI on /ui and /
@app.get("/ui")
@app.get("/app")
def serve_react_ui():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"status": "ok", "message": "Travel Planner Backend"}

demo.app = app

demo.launch()
