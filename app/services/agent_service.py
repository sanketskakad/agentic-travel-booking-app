import os
import logging
from pydantic import BaseModel, Field
from typing import Optional, List
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from app.models.schemas import State, FlightState, HotelState, ActivityState
from app.repositories.travel_repository import get_available_flights, get_available_hotels, get_available_activities

import re
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("agent_service")

def parse_details_fallback(message: str) -> dict:
    """
    Regex fallback parser to extract origin, destination, and dates when LLM API is unavailable.
    """
    origin = "Berlin"
    destination = ""
    travel_date = "Not specified"
    return_date = "Not specified"
    budget = "Not specified"

    # Match "from <Origin> to <Destination>"
    match_route = re.search(r'from\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:[\,\.\;\:]|\s+departing|\s+returning|\s+hotels|\s+and|\s+in|\s+on|$)', message, re.IGNORECASE)
    if match_route:
        origin = match_route.group(1).strip().title()
        destination = match_route.group(2).strip().title()
    else:
        # Match "to <Destination>" or "in <Destination>"
        match_dest = re.search(r'(?:to|in)\s+([A-Za-z\s]+?)(?:[\,\.\;\:]|\s+departing|\s+returning|\s+hotels|\s+and|\s+on|$)', message, re.IGNORECASE)
        if match_dest:
            destination = match_dest.group(1).strip().title()

    # Match dates YYYY-MM-DD
    dates = re.findall(r'\b\d{4}-\d{2}-\d{2}\b', message)
    if len(dates) >= 1:
        travel_date = dates[0]
    if len(dates) >= 2:
        return_date = dates[1]

    if not destination:
        destination = "Frankfurt"

    return {
        "origin_city": origin,
        "destination_city": destination,
        "travel_date": travel_date,
        "return_date": return_date,
        "budget": budget
    }

# Pydantic schema for structured output extraction
class TravelDetails(BaseModel):
    origin_city: str = Field(description="The starting city of the travel. Defaults to 'Berlin'.")
    destination_city: str = Field(description="The destination city of the travel. Defaults to 'Frankfurt'.")
    travel_date: Optional[str] = Field(description="The outbound/departure date of travel if mentioned, e.g., '2026-09-01'. Defaults to 'Not specified'.")
    return_date: Optional[str] = Field(description="The return/arrival date of travel if mentioned, e.g., '2026-09-10'. Defaults to 'Not specified'.")
    budget: Optional[str] = Field(description="The budget of travel if mentioned, e.g., '1000', 'cheap'. Defaults to 'Not specified'.")

def extract_travel_details(message: str) -> dict:
    """
    Uses ChatGroq with structured output to extract travel details.
    Falls back to regex parsing if API key is missing or model invocation fails.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key == "your-api-key" or api_key == "your_groq_api_key_here":
        logger.info("GROQ_API_KEY not configured. Using rule-based fallback extraction.")
        return parse_details_fallback(message)

    try:
        llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0)
        structured_llm = llm.with_structured_output(TravelDetails)
        
        prompt = f"Extract travel details from this user query: '{message}'"
        result = structured_llm.invoke(prompt)
        
        return {
            "origin_city": result.origin_city or "Berlin",
            "destination_city": result.destination_city or "Frankfurt",
            "travel_date": result.travel_date or "Not specified",
            "return_date": result.return_date or "Not specified",
            "budget": result.budget or "Not specified"
        }
    except Exception as exc:
        logger.warning(f"ChatGroq structured extraction failed ({exc}). Using rule-based fallback extraction.")
        return parse_details_fallback(message)

from langgraph.checkpoint.memory import MemorySaver

def extraction_node(state: State) -> dict:
    """
    Graph Node: Parses the user request message to populate parameters.
    """
    try:
        details = extract_travel_details(state["message"])
        dest = details.get("destination_city", "").strip()
        is_valid = bool(dest and dest.lower() not in ["unknown", "invalid", "not specified", "none"])
        return {
            "origin_city": details["origin_city"],
            "destination_city": details["destination_city"],
            "travel_date": details["travel_date"],
            "return_date": details["return_date"],
            "budget": details["budget"],
            "is_valid": is_valid,
            "clarification_message": None if is_valid else f"Please provide a valid destination city for your travel query."
        }
    except Exception as e:
        logger.warning(f"Extraction node error: {e}")
        fallback = parse_details_fallback(state.get("message", ""))
        return {
            "origin_city": fallback["origin_city"],
            "destination_city": fallback["destination_city"],
            "travel_date": fallback["travel_date"],
            "return_date": fallback["return_date"],
            "budget": fallback["budget"],
            "is_valid": True if fallback["destination_city"] else False,
            "clarification_message": None
        }

def clarification_node(state: State) -> dict:
    """
    Graph Node: Prompts user for clarification if extracted data is incomplete or invalid.
    """
    msg = state.get("clarification_message") or "Destination city could not be identified. Please specify where you would like to travel."
    return {
        "is_valid": False,
        "clarification_message": msg
    }

def validate_extracted_data(state: State) -> str:
    """
    Conditional edge evaluator: checks if destination_city is valid.
    """
    if state.get("is_valid") is False:
        return "clarification_node"
    dest = (state.get("destination_city") or "").strip()
    if not dest or dest.lower() in ["unknown", "invalid", "not specified", "none"]:
        return "clarification_node"
    return "flight_agent"

def flight_agent(state: State) -> dict:
    """
    Flight Agent node: Fetches flight records using the extracted cities (outbound and return).
    """
    outbound_data = get_available_flights(state["origin_city"], state["destination_city"])
    outbound_flights = [FlightState(**f) for f in outbound_data]
    
    return_data = get_available_flights(state["destination_city"], state["origin_city"])
    return_flights = [FlightState(**f) for f in return_data]
    
    return {
        "flight_state": outbound_flights,
        "return_flight_state": return_flights
    }

def hotel_agent(state: State) -> dict:
    """
    Hotel Agent node: Fetches accommodation records using the extracted city.
    """
    hotels_data = get_available_hotels(state["destination_city"])
    hotels = [HotelState(**h) for h in hotels_data]
    return {
        "hotel_state": hotels
    }

def activity_agent(state: State) -> dict:
    """
    Activity Agent node: Fetches tourist activity records using the extracted city.
    """
    activities_data = get_available_activities(state["destination_city"])
    activities = [ActivityState(**a) for a in activities_data]
    return {
        "activity_state": activities
    }

# Setup state persistence memory checkpointer
memory = MemorySaver()

# Build LangGraph workflow
builder = StateGraph(State)

builder.add_node("extraction_node", extraction_node)
builder.add_node("clarification_node", clarification_node)
builder.add_node("flight_agent", flight_agent)
builder.add_node("hotel_agent", hotel_agent)
builder.add_node("activity_agent", activity_agent)

builder.add_edge(START, "extraction_node")
builder.add_conditional_edges(
    "extraction_node",
    validate_extracted_data,
    {
        "flight_agent": "flight_agent",
        "clarification_node": "clarification_node"
    }
)
builder.add_edge("clarification_node", END)
builder.add_edge("flight_agent", "hotel_agent")
builder.add_edge("hotel_agent", "activity_agent")
builder.add_edge("activity_agent", END)

# Compiled graph ready to be invoked with memory checkpointer
graph = builder.compile(checkpointer=memory)
