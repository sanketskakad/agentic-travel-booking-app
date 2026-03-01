import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

app = FastAPI(title="Multi-Agent Travel Booking API")

# Configure CORS to allow the frontend application to access this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, adjust if restricting to specific domains (e.g. localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str

@app.get("/")
def read_root():
    return {"message": "Welcome to the Multi-Agent Travel Booking API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/travelplan")
def get_travel_plan(request: QueryRequest):
    user_query = request.query
    # Return a mock response for now
    return {
        "query": user_query,
        "response": f"Received your travel query: '{user_query}'. The travel agent agent workflow is ready to be connected."
    }

if __name__ == "__main__":
    import uvicorn
    # Use PORT environment variable if available, fallback to 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
