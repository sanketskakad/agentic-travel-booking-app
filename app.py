import os
os.environ["GRADIO_SERVER_PORT"] = "7861"

import gradio as gr
from main import app as fastapi_app

# Create a Gradio container pointing to our FastAPI static index page
with gr.Blocks(title="Agentic Travel Planner") as demo:
    gr.HTML("<iframe src='/' style='width:100%; height:100vh; border:none;'></iframe>")

# Mount Gradio onto the FastAPI app
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
