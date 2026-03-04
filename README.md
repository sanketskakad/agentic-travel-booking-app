---
title: Agentic Travel Planner
emoji: ✈️
colorFrom: blue
colorTo: indigo
sdk: gradio
app_file: app.py
pinned: false
---

# ✈️ Multi-Agent Travel Planner (FastAPI Backend)

An AI-powered multi-agent travel planning system built with FastAPI and LangGraph, using a fully integrated Python mock database server to search and book flights, hotels, activities, and itineraries.

---

## 📂 Backend Python Codebase Structure

- **`app.py`**: The entrypoint that starts the Uvicorn server on port `7860` (or uses the `PORT` environment variable).
- **`main.py`**: The FastAPI core app config. It registers route controllers, mounts CORS middleware, and configures static files serving.
- **`requirements.txt`**: Lists all python dependency requirements (FastAPI, LangGraph, Groq, requests, aiofiles).
- **`app/config/settings.py`**: Handles configuration variables such as server port, target mock API URLs, and the local direct-query execution switch.
- **`app/controller/router.py`**: Primary router containing endpoints for executing the travel agent LangGraph workflows, fetching item reviews, and generating trip summaries.
- **`app/controller/mock_router.py`**: In-memory database router containing Python ports of mock data search, price range filtering, and reservation bookings.
- **`app/repository/travel_client.py`**: Client module managing database interactions (bypasses HTTP round-trips when `USE_LOCAL_MOCK` is active).
- **`app/service/agent_service.py`**: Compiles the travel planner LangGraph orchestration graph.
- **`app/models/schemas.py`**: Defines Pydantic validation schemas for API payloads.

---

## 🛠️ Step-by-Step Local Setup

### 1. Prerequisites
- Python 3.12+ installed.
- A Groq API Key (Sign up and get one for free on the [Groq Console](https://console.groq.com/)).

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=8000
USE_LOCAL_MOCK=true
```

### 3. Install Dependencies
Run the following command using `pip` or the fast `uv` package manager:
```bash
# Using standard pip
pip install -r requirements.txt

# Or using uv
uv pip install -r requirements.txt
```

### 4. Start the Application
Run the Python entrypoint:
```bash
python app.py
```
The server will boot on `http://localhost:8000` (or port specified in your `.env`).

---

## 🔌 API Endpoints Reference

### 🚀 Travel Agent API

#### Post Travel Query
- **Endpoint**: `POST /api/travelplan`
- **Payload**:
  ```json
  { "query": "Plan a trip from Berlin to Paris on 2026-09-01 returning on 2026-09-10" }
  ```
- **Description**: Submits the user prompt to the compiled LangGraph workflow.

#### Get Item Reviews
- **Endpoint**: `GET /api/reviews/{item_id}`
- **Description**: Retrieves user reviews mock data for a flight, hotel, or activity.

#### Generate Trip Summary
- **Endpoint**: `POST /api/generatesummary`
- **Payload**:
  ```json
  { "bookingDetails": "..." }
  ```
- **Description**: Compiles a structured markdown summary of the booked selections using LLM completion.

---

### 🗄️ Integrated Python Database Mock API
These mock database routes run inside the same FastAPI process (reading/writing to `mock-backend/database/db.json` locally):

- **`GET /mock-api/flights/available_flights`**: Returns available departure/arrival flights matching origin/destination. Supports price range filtering via query params (`minPrice`/`maxPrice`).
- **`GET /mock-api/hotels/available_hotels`**: Lists hotels by city, rating, and price.
- **`GET /mock-api/thingsToDo/available_activities`**: Lists things to do matching target cities.
- **`GET /mock-api/bookings/active_bookings`**: Lists all recorded travel bookings.
- **`POST /mock-api/book`**: Creates a reservation booking in the local JSON database database.
