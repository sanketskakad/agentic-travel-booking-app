---
title: Agentic Travel Planner
emoji: ✈️
colorFrom: blue
colorTo: indigo
sdk: gradio
app_file: app.py
pinned: false
hardware: cpu-basic
---

# ✈️ Multi-Agent Travel Planner

**Agentic Travel Planner** is an advanced, enterprise-grade AI travel planning ecosystem powered by a multi-agent orchestration workflow built on FastAPI, LangGraph, and LangChain. The system automatically parses natural language travel queries, extracts structured itineraries (origin, destination, travel dates, budget), and coordinates a network of specialized AI agents to inspect, compare, and coordinate flights, hotel accommodations, and local activities. Featuring built-in JSON database-backed booking capabilities, real-time customer reviews retrieval, and automated LLM-generated travel itinerary summaries, it showcases the future of stateful, autonomous agentic service orchestration.

---

## 📂 Backend Python Codebase Structure

- **`app.py`**: Root entrypoint wrapper that runs the Uvicorn application on the configured port.
- **`main.py`**: Local dev runner script.
- **`requirements.txt`**: Lists Python dependency packages (FastAPI, LangGraph, Groq, LangChain).
- **`app/main.py`**: Primary FastAPI application setup, CORS middleware registration, static file mounts, and route controller inclusions.
- **`app/config/settings.py`**: Application settings and configuration environment variables.
- **`app/controllers/`**: Route controllers handling agent workflows (`agent_controller.py`) and mock database APIs (`mock_controller.py`).
- **`app/services/`**: Business logic layer including the LangGraph agent state graph compiler (`agent_service.py`).
- **`app/repositories/`**: Data access layer managing local query logic and file transactions (`travel_repository.py`).
- **`app/models/`**: Shared domain models and validation schemas (`schemas.py`).
- **`app/database/`**: Consolidated dataset JSON store (`db.json`).

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
