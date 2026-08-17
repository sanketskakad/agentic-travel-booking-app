import logging
import requests
from app.config.settings import MOCK_API_BASE_URL, USE_LOCAL_MOCK

logger = logging.getLogger("travel_repository")

def get_available_flights(origin: str, destination: str) -> list:
    if USE_LOCAL_MOCK:
        from app.controllers.mock_controller import query_flights
        logger.info(f"Querying local flights: {origin} -> {destination}")
        return query_flights(origin=origin, destination=destination)
        
    url = f"{MOCK_API_BASE_URL}/flights/available_flights"
    params = {"origin": origin, "destination": destination}
    try:
        logger.info(f"Querying flights: {origin} -> {destination}")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching flights: {e}")
        return []

def get_available_hotels(city: str, rating: float = None) -> list:
    if USE_LOCAL_MOCK:
        from app.controllers.mock_controller import query_hotels
        logger.info(f"Querying local hotels in {city}")
        return query_hotels(city=city, rating=rating)

    url = f"{MOCK_API_BASE_URL}/hotels/available_hotels"
    params = {"city": city}
    if rating is not None:
        params["rating"] = rating
    try:
        logger.info(f"Querying hotels in {city}")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching hotels: {e}")
        return []

def get_available_activities(city: str) -> list:
    if USE_LOCAL_MOCK:
        from app.controllers.mock_controller import query_activities
        logger.info(f"Querying local activities in {city}")
        return query_activities(city=city)

    url = f"{MOCK_API_BASE_URL}/thingsToDo/available_activities"
    params = {"city": city}
    try:
        logger.info(f"Querying activities in {city}")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching activities: {e}")
        return []

def book_item(name: str, item_id: str) -> dict:
    item_type = "general"
    if item_id.startswith("HTL-"):
        item_type = "hotels"
    elif item_id.startswith("ACT-"):
        item_type = "activities"
    else:
        item_type = "flights"

    if USE_LOCAL_MOCK:
        from app.controllers.mock_controller import perform_booking
        logger.info(f"Booking local item {item_id} ({item_type}) for guest {name}")
        return perform_booking(name=name, item_id=item_id, item_type=item_type)

    url = f"{MOCK_API_BASE_URL}/book"
    payload = {"name": name, "itemId": item_id, "itemType": item_type}
    try:
        logger.info(f"Booking item {item_id} for guest {name}")
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error making booking: {e}")
        return {"status": "error", "message": str(e)}

def get_active_bookings() -> list:
    if USE_LOCAL_MOCK:
        from app.controllers.mock_controller import query_active_bookings
        logger.info("Fetching local active bookings")
        return query_active_bookings()

    url = f"{MOCK_API_BASE_URL}/bookings/active_bookings"
    try:
        logger.info("Fetching all active bookings")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching active bookings: {e}")
        return []
