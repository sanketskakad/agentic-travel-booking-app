import os
import logging
from pydantic import BaseModel, Field
from typing import Optional, List
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from app.models.schemas import State, FlightState, HotelState, ActivityState
from app.repository.travel_client import get_available_flights, get_available_hotels, get_available_activities

logger = logging.getLogger("agent_service")

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
    Raises ValueError or runtime exceptions if key is missing or model invocation fails.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key == "your-api-key":
        raise ValueError("GROQ_API_KEY is not configured in the environment.")

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

def extraction_node(state: State) -> dict:
    """
    Graph Node: Parses the user request message to populate parameters.
    """
    details = extract_travel_details(state["message"])
    return {
        "origin_city": details["origin_city"],
        "destination_city": details["destination_city"],
        "travel_date": details["travel_date"],
        "return_date": details["return_date"],
        "budget": details["budget"]
    }

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

# Build LangGraph workflow
builder = StateGraph(State)

builder.add_node("extraction_node", extraction_node)
builder.add_node("flight_agent", flight_agent)
builder.add_node("hotel_agent", hotel_agent)
builder.add_node("activity_agent", activity_agent)

builder.add_edge(START, "extraction_node")
builder.add_edge("extraction_node", "flight_agent")
builder.add_edge("flight_agent", "hotel_agent")
builder.add_edge("hotel_agent", "activity_agent")
builder.add_edge("activity_agent", END)

# Compiled graph ready to be invoked
graph = builder.compile()
