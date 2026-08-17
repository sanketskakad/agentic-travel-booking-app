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
    Handles continuous travel date ranges and cleans destination city strings.
    """
    origin = ""
    destination = ""
    travel_date = "Not specified"
    return_date = "Not specified"
    budget = "Not specified"

    # Match "from <Origin> to <Destination>" supporting unicode letters and characters
    match_route = re.search(
        r'from\s+([^\,\.\;\:\?\!\d]+?)\s+to\s+([^\,\.\;\:\?\!\d]+?)(?:[\,\.\;\:]|\s+with|\s+for|\s+having|\s+departing|\s+returning|\s+hotels?|\s+flights?|\s+and|\s+on|$)',
        message,
        re.IGNORECASE
    )
    if match_route:
        origin = match_route.group(1).strip().title()
        destination = match_route.group(2).strip().title()
    else:
        # Match "to <Destination>" or "in <Destination>"
        match_dest = re.search(
            r'(?:to|in)\s+([^\,\.\;\:\?\!\d]+?)(?:[\,\.\;\:]|\s+with|\s+for|\s+having|\s+departing|\s+returning|\s+hotels?|\s+flights?|\s+and|\s+on|$)',
            message,
            re.IGNORECASE
        )
        if match_dest:
            destination = match_dest.group(1).strip().title()

    if destination:
        destination = re.sub(
            r'\s+(with|for|having|departing|returning|on|and|hotels?|flights?|trip|star).*$',
            '',
            destination,
            flags=re.IGNORECASE
        ).strip()

    # Match travel date continuum YYYY-MM-DD
    dates = re.findall(r'\b\d{4}-\d{2}-\d{2}\b', message)
    if len(dates) >= 1:
        travel_date = dates[0]
    if len(dates) >= 2:
        return_date = dates[1]

    if not origin:
        origin = "Berlin"

    return {
        "origin_city": origin,
        "destination_city": destination,
        "travel_date": travel_date,
        "return_date": return_date,
        "budget": budget
    }

# Pydantic schema for structured output extraction
class TravelDetails(BaseModel):
    origin_city: Optional[str] = Field(default=None, description="The starting city of travel if mentioned, e.g., 'Berlin'.")
    destination_city: Optional[str] = Field(default=None, description="The destination city of travel if mentioned. Do NOT guess if unspecified.")
    travel_date: Optional[str] = Field(default=None, description="The outbound date YYYY-MM-DD.")
    return_date: Optional[str] = Field(default=None, description="The return date YYYY-MM-DD.")
    budget: Optional[str] = Field(default=None, description="The travel budget if mentioned.")

def extract_travel_details(message: str) -> dict:
    """
    Uses ChatGroq with structured output to extract travel details.
    Falls back to rule-based parsing if API key is missing or model invocation fails.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key == "your-api-key" or api_key == "your_groq_api_key_here":
        logger.info("GROQ_API_KEY not configured. Using rule-based fallback extraction.")
        return parse_details_fallback(message)

    try:
        model_name = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
        llm = ChatGroq(model_name=model_name, temperature=0, request_timeout=10.0, max_retries=2)
        structured_llm = llm.with_structured_output(TravelDetails)
        
        prompt = f"Extract travel details from this user query: '{message}'"
        result = structured_llm.invoke(prompt)
        
        return {
            "origin_city": result.origin_city or "",
            "destination_city": result.destination_city or "",
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
    Graph Node: Parses the user request message to populate parameters, merging multi-turn state.
    """
    try:
        msg = state.get("message", "")
        details = extract_travel_details(msg)
        
        existing_origin = state.get("origin_city")
        existing_dest = state.get("destination_city")
        existing_travel_date = state.get("travel_date")
        existing_return_date = state.get("return_date")
        existing_budget = state.get("budget")

        origin = details.get("origin_city") or existing_origin or "Berlin"
        dest = (details.get("destination_city") or existing_dest or "").strip()

        travel_date = details.get("travel_date")
        if not travel_date or travel_date == "Not specified":
            travel_date = existing_travel_date or "Not specified"

        return_date = details.get("return_date")
        if not return_date or return_date == "Not specified":
            return_date = existing_return_date or "Not specified"

        budget = details.get("budget")
        if not budget or budget == "Not specified":
            budget = existing_budget or "Not specified"

        is_valid = bool(dest and dest.lower() not in ["unknown", "invalid", "not specified", "none", ""])

        return {
            "origin_city": origin,
            "destination_city": dest,
            "travel_date": travel_date,
            "return_date": return_date,
            "budget": budget,
            "is_valid": is_valid,
            "clarification_message": None if is_valid else "Destination city could not be identified. Please specify where you would like to travel."
        }
    except Exception as e:
        logger.warning(f"Extraction node error: {e}")
        fallback = parse_details_fallback(state.get("message", ""))
        existing_dest = state.get("destination_city")
        dest = fallback.get("destination_city") or existing_dest or ""
        is_valid = bool(dest and dest.lower() not in ["unknown", "invalid", "not specified", "none", ""])
        return {
            "origin_city": fallback.get("origin_city") or state.get("origin_city") or "Berlin",
            "destination_city": dest,
            "travel_date": fallback.get("travel_date") or state.get("travel_date") or "Not specified",
            "return_date": fallback.get("return_date") or state.get("return_date") or "Not specified",
            "budget": fallback.get("budget") or state.get("budget") or "Not specified",
            "is_valid": is_valid,
            "clarification_message": None if is_valid else "Destination city could not be identified. Please specify where you would like to travel."
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
    outbound_data = get_available_flights(state.get("origin_city", ""), state.get("destination_city", ""))
    outbound_flights = []
    for f in outbound_data:
        try:
            outbound_flights.append(FlightState(**f))
        except Exception as e:
            logger.warning(f"Error parsing flight record {f}: {e}")
            
    return_data = get_available_flights(state.get("destination_city", ""), state.get("origin_city", ""))
    return_flights = []
    for f in return_data:
        try:
            return_flights.append(FlightState(**f))
        except Exception as e:
            logger.warning(f"Error parsing return flight record {f}: {e}")

    return {
        "flight_state": outbound_flights,
        "return_flight_state": return_flights
    }

def hotel_agent(state: State) -> dict:
    """
    Hotel Agent node: Fetches accommodation records using the extracted city.
    """
    hotels_data = get_available_hotels(state.get("destination_city", ""))
    hotels = []
    for h in hotels_data:
        try:
            hotels.append(HotelState(**h))
        except Exception as e:
            logger.warning(f"Error parsing hotel record {h}: {e}")
    return {
        "hotel_state": hotels
    }

def activity_agent(state: State) -> dict:
    """
    Activity Agent node: Fetches tourist activity records using the extracted city.
    """
    activities_data = get_available_activities(state.get("destination_city", ""))
    activities = []
    for a in activities_data:
        try:
            activities.append(ActivityState(**a))
        except Exception as e:
            logger.warning(f"Error parsing activity record {a}: {e}")
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
