import os
import requests
from fastapi import APIRouter
from app.models.schemas import QueryRequest, BookRequest, GenerateSummaryRequest
from app.services.agent_service import graph
from app.repositories.travel_repository import book_item
from app.config.settings import MOCK_API_BASE_URL, USE_LOCAL_MOCK

router = APIRouter()

@router.post("/travelplan")
def get_travel_plan(request: QueryRequest) -> dict:
    user_query = request.query
    thread_id = getattr(request, "thread_id", None) or "default_thread"
    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke({
        "message": user_query,
        "origin_city": "",
        "destination_city": "",
        "travel_date": "",
        "return_date": "",
        "budget": "",
        "flight_state": [],
        "return_flight_state": [],
        "hotel_state": [],
        "activity_state": [],
        "is_valid": True,
        "clarification_message": None
    }, config=config)
    
    origin = result.get("origin_city") or "Origin"
    destination = result.get("destination_city") or "Destination"
    dep_date = result.get("travel_date") or "Not specified"
    ret_date = result.get("return_date") or "Not specified"
    
    clean_msg = f"### 🗺️ EuroTrip Planner: {origin} to {destination}\n\n" \
                f"I found travel options for your trip from **{dep_date}** to **{ret_date}**.\n\n" \
                f"Please follow the step-by-step guide below to configure your trip!"

    flights = [
        {
            "name": f.flightName,
            "id": f.flightID,
            "origin": f.origin,
            "destination": f.destination,
            "price": int(float(f.price))
        } for f in result.get("flight_state", [])
    ]
    
    return_flights = [
        {
            "name": f.flightName,
            "id": f.flightID,
            "origin": f.origin,
            "destination": f.destination,
            "price": int(float(f.price))
        } for f in result.get("return_flight_state", [])
    ]
    
    hotels = [
        {
            "name": h.hotelName,
            "id": h.hotelID,
            "city": h.city,
            "price": int(float(h.pricePerNight))
        } for h in result.get("hotel_state", [])
    ]
    
    activities = [
        {
            "name": a.activityName,
            "id": a.activityID,
            "description": a.description,
            "price": int(float(a.price))
        } for a in result.get("activity_state", [])
    ]
    
    return {
        "query": user_query,
        "response": clean_msg,
        "departure_date": dep_date,
        "return_date": ret_date,
        "flights": flights,
        "return_flights": return_flights,
        "hotels": hotels,
        "activities": activities
    }

@router.get("/health")
def health_check():
    return {"status": "healthy"}

@router.post("/book")
def book_travel_item(request: BookRequest) -> dict:
    return book_item(request.name, request.itemId)

@router.get("/reviews/{item_id}")
def get_item_reviews(item_id: str):
    if USE_LOCAL_MOCK:
        from app.controllers.mock_controller import query_hotels, query_activities, query_flights
        try:
            if item_id.startswith("HTL-"):
                data = query_hotels(hotel_id=item_id)
            elif item_id.startswith("ACT-"):
                data = query_activities(activity_id=item_id)
            else:
                data = query_flights(flight_id=item_id)
            if isinstance(data, list) and len(data) > 0:
                return {"reviews": data[0].get("reviews", [])}
            return {"reviews": []}
        except Exception as e:
            return {"reviews": [], "error": str(e)}

    if item_id.startswith("HTL-"):
        url = f"{MOCK_API_BASE_URL}/hotels/available_hotels"
        params = {"hotelID": item_id}
    elif item_id.startswith("ACT-"):
        url = f"{MOCK_API_BASE_URL}/thingsToDo/available_activities"
        params = {"activityID": item_id}
    else:
        url = f"{MOCK_API_BASE_URL}/flights/available_flights"
        params = {"flightID": item_id}
        
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list) and len(data) > 0:
            return {"reviews": data[0].get("reviews", [])}
        return {"reviews": []}
    except Exception as e:
        return {"reviews": [], "error": str(e)}

def build_fallback_itinerary_summary(guest_name: str, items: list) -> str:
    """
    Generates a structured, professional markdown itinerary summary when LLM generation fails or API key is invalid.
    """
    summary_lines = [
        f"# ✈️ Travel Itinerary Summary for {guest_name}",
        "",
        "Congratulations on booking your upcoming EuroTrip! Here is your detailed itinerary breakdown:",
        ""
    ]

    total_price = 0
    grouped_items = {}
    for item in items:
        item_type = item.type.capitalize()
        if item_type not in grouped_items:
            grouped_items[item_type] = []
        grouped_items[item_type].append(item)
        total_price += item.price

    for category, category_items in grouped_items.items():
        icon = "✈️" if "Flight" in category else "🏨" if "Hotel" in category else "🎟️"
        summary_lines.append(f"### {icon} {category} Reservations")
        for it in category_items:
            details_str = f" - {it.details}" if it.details else ""
            summary_lines.append(f"- **{it.name}** (`{it.id}`): €{it.price / 100:.2f}{details_str}")
        summary_lines.append("")

    summary_lines.extend([
        "---",
        f"### 💳 Total Booking Cost: **€{total_price / 100:.2f}**",
        "",
        "### 💡 Useful Local Travel Tips",
        "- **Public Transit**: Download local transport apps for real-time tram and train schedules.",
        "- **Check-In**: Keep your booking reference IDs handy during check-in.",
        "- **Local Currency & Payments**: Contactless cards are widely accepted across most European destinations."
    ])

    return "\n".join(summary_lines)

@router.post("/generatesummary")
def generate_summary(request: GenerateSummaryRequest):
    from langchain_groq import ChatGroq
    
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key == "your-api-key" or api_key == "your_groq_api_key_here":
        return {"summary": build_fallback_itinerary_summary(request.guestName, request.items)}
        
    items_desc = []
    for item in request.items:
        desc = f"- {item.type.capitalize()}: {item.name} ({item.id}) - Price: €{item.price / 100:.2f}"
        if item.details:
            desc += f" ({item.details})"
        items_desc.append(desc)
        
    items_text = "\n".join(items_desc)
    
    prompt = (
        f"You are a friendly, expert travel agent helper. The guest '{request.guestName}' has just booked the following items for their trip:\n"
        f"{items_text}\n\n"
        f"Please write a beautiful, cohesive, personalized travel itinerary summary for the guest in markdown. "
        f"Group the details logically. Be specific about what activities they will do and on what dates (suggest logical dates or timeline relative to their trip if dates are not fully specified, e.g., Day 1, Day 2, etc.). "
        f"Provide some fun/useful local tips about the destination(s) to make it engaging and professional. "
        f"Do not include greeting or intro fluff like 'Here is the summary you requested' or outro remarks. Start directly with the title and summary."
    )
    
    try:
        llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0.7)
        res = llm.invoke(prompt)
        return {"summary": res.content}
    except Exception as e:
        return {"summary": build_fallback_itinerary_summary(request.guestName, request.items)}
