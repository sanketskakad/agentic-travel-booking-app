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
# Create a Gradio container pointing to our FastAPI static index page
with gr.Blocks(title="Agentic Travel Planner") as demo:
    gr.HTML("<iframe src='/' style='width:100%; height:100vh; border:none;'></iframe>")

# Mount Gradio onto the FastAPI app
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

# Override demo.app so Hugging Face's Gradio SDK runner launches our combined app
demo.app = app

# Launch the Gradio app to keep the server running on Hugging Face
demo.launch(server_name="0.0.0.0", server_port=7860)
