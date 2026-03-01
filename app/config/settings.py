import os

# Base URL for the mock travel API service
MOCK_API_BASE_URL = os.getenv("MOCK_API_BASE_URL", "http://localhost:3000")

# API port for the FastAPI server
PORT = int(os.getenv("PORT", 8000))
