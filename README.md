# ✈️ Agentic Travel Planner

**Agentic Travel Planner** is an advanced, enterprise-grade AI travel planning ecosystem powered by a stateful multi-agent orchestration workflow built on FastAPI, LangGraph, and LangChain. The system automatically parses natural language travel queries, extracts structured itineraries (origin, destination, travel dates, budget), and coordinates a network of specialized AI agents to inspect, compare, and coordinate flights, hotel accommodations, and local activities. 

Featuring built-in JSON database-backed booking capabilities, real-time customer reviews retrieval, and automated LLM-generated travel itinerary summaries, it showcases the future of stateful, autonomous agentic service orchestration.

---

## ✨ Core Capabilities

*   **Natural Language Processing**: Translates unstructured user prompts (e.g., *"Plan a 5-day cheap trip to Paris starting Sep 1st"*) into structured parameters using LLM-backed schema extraction.
*   **Stateful Agentic Orchestration**: Uses LangGraph to compile a workflow graph that executes parallel and sequential searches using dedicated Flight, Hotel, and Activity agents.
*   **Layered Database Abstraction**: Connects to either external HTTP APIs or executes optimized direct-query local resolution against a static JSON database layer.
*   **Automated Summarization**: Uses generative AI completion to compile booked items (flights, hotels, activities) into a cohesive, highly personalized travel itinerary with markdown formatting and local destination tips.

---

## 📂 Architecture and Codebase Structure

The project follows a clean, decoupled directory structure separating route handling, business logic, data models, and database clients:

```
multi-agents-travel-booking-app/
├── app/
│   ├── __init__.py
│   ├── main.py                     # Primary FastAPI application bootloader & middleware
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py             # Environment configuration & settings variables
│   ├── controllers/
│   │   ├── __init__.py
│   │   ├── agent_controller.py     # Main travel planning, review, & summary endpoints
│   │   └── mock_controller.py      # Integrated dataset mock API endpoints
│   ├── database/
│   │   ├── __init__.py
│   │   └── db.json                 # Core dataset store containing flights, hotels, and active bookings
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py              # Pydantic validation and LangGraph state schemas
│   ├── repositories/
│   │   ├── __init__.py
│   │   └── travel_repository.py    # Database access layer abstraction (local and remote resolution)
│   └── services/
│       ├── __init__.py
│       └── agent_service.py        # LangGraph workflow compiler and agent nodes
├── frontend/                       # React SPA client code
├── static/                         # Production static assets served by FastAPI
├── Dockerfile                      # Optimized production multi-stage build config
├── README.md                       # Professional documentation
├── pyproject.toml                  # Project packaging and lock settings
├── requirements.txt                # Static dependencies lockfile
├── start.sh                        # Production runtime runner script
└── uv.lock                         # Fast Python package resolution lockfile
```

---

## 🛠️ Step-by-Step Local Setup

### 1. Prerequisites
*   Python 3.12 or higher.
*   A Groq API Key (Sign up and get one for free on the [Groq Console](https://console.groq.com/)).

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=8000
USE_LOCAL_MOCK=true
```

### 3. Install Dependencies
Run the following command using the fast `uv` package manager:
```bash
# Install uv if you haven't already
pip install uv

# Sync project dependencies
uv sync
```
*(Alternatively, you can run `pip install -r requirements.txt`)*

### 4. Start the Application
Run the Python entrypoint script:
```bash
uv run python app.py
```
The server will start on `http://localhost:8000`.

---

## 🔌 API Endpoints Reference

### 🚀 Travel Agent Workflow API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/travelplan` | Submits natural language queries to the compiled LangGraph workflow. |
| `POST` | `/api/book` | Makes a database reservation booking for a flight, hotel, or activity. |
| `GET` | `/api/reviews/{item_id}` | Retrieves real-time customer reviews for a flight, hotel, or activity. |
| `POST` | `/api/generatesummary` | Compiles a structured markdown summary itinerary of the booked selections. |
| `GET` | `/api/health` | Service health status check. |

---

### 🗄️ Integrated Database Mock API

These endpoints execute local JSON queries against `app/database/db.json` when `USE_LOCAL_MOCK=true` is set:

| Method | Endpoint | Query Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/mock-api/flights/available_flights` | `origin`, `destination`, `minPrice`, `maxPrice` | Filters and retrieves available flight entries. |
| `GET` | `/mock-api/hotels/available_hotels` | `city`, `rating`, `minPrice`, `maxPrice` | Filters and retrieves hotel accommodations. |
| `GET` | `/mock-api/thingsToDo/available_activities` | `city` | Retrieves destination activities. |
| `GET` | `/mock-api/bookings/active_bookings` | None | Lists all active client bookings. |
| `POST` | `/mock-api/book` | None *(Payload: `name`, `itemId`)* | Submits a reservation booking to the database. |

---

## 🐳 Production Deployment

### Container Run via Docker
```bash
docker run -d \
  -p 8000:8000 \
  -e GROQ_API_KEY="your_groq_api_key" \
  -e USE_LOCAL_MOCK="true" \
  --name travel-planner \
  sanketkakad/agentic-travel-planner:latest
```
