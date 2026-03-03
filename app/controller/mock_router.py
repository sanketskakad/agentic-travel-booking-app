import os
import json
import random
from datetime import datetime
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

mock_router = APIRouter()

# Load db.json
db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "mock-backend", "database", "db.json")

def load_db():
    if not os.path.exists(db_path):
        return {}
    try:
        with open(db_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_db(data):
    try:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        with open(db_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Failed to save db.json: {e}")

# Load database cache on startup
db = load_db()

# Helper function to filter array of dictionaries
def filter_data(data_list, query_params):
    if not isinstance(data_list, list):
        return data_list

    # Extract price filters
    min_price = query_params.get("minPrice") or query_params.get("minprice")
    max_price = query_params.get("maxPrice") or query_params.get("maxprice")

    # Build standard query keys to match
    standard_query = {}
    for k, v in query_params.items():
        if k.lower() not in ["minprice", "maxprice"]:
            standard_query[k] = v

    filtered = data_list

    # Standard filters
    if standard_query:
        for k, val in standard_query.items():
            if not val:
                continue
            if k.lower() == "date":
                continue # Skip date filtering as daily frequency is simulated
            
            # Map aliases
            target_keys = [k]
            if k.lower() == "source":
                target_keys = ["originCode", "origin", "source", "from"]
            elif k.lower() in ["dest", "destination"]:
                target_keys = ["destinationCode", "destination", "dest", "to"]
            
            new_filtered = []
            for item in filtered:
                match = False
                for tk in target_keys:
                    item_key = next((key for key in item.keys() if key.lower() == tk.lower()), None)
                    if item_key is not None:
                        if val.lower() in str(item[item_key]).lower():
                            match = True
                            break
                if match:
                    new_filtered.append(item)
            filtered = new_filtered

    # Price range filters
    if min_price is not None or max_price is not None:
        try:
            min_p = float(min_price) if min_price else -float("inf")
        except ValueError:
            min_p = -float("inf")
        try:
            max_p = float(max_price) if max_price else float("inf")
        except ValueError:
            max_p = float("inf")
        
        new_filtered = []
        for item in filtered:
            price_key = next((key for key in item.keys() if key.lower() in ["price", "pricepernight"]), None)
            if price_key is not None:
                try:
                    price_val = float(item[price_key])
                    if min_p <= price_val <= max_p:
                        new_filtered.append(item)
                except ValueError:
                    pass
        filtered = new_filtered

    return filtered

# Direct Python query functions to prevent self-calling HTTP deadlocks in Uvicorn
def query_flights(origin: str = None, destination: str = None, flight_id: str = None) -> list:
    global db
    flights_list = db.get("flights", {}).get("available_flights", [])
    if flight_id:
        return [f for f in flights_list if f.get("flightID") == flight_id]
    
    params = {}
    if origin:
        params["origin"] = origin
    if destination:
        params["destination"] = destination
    return filter_data(flights_list, params)

def query_hotels(city: str = None, hotel_id: str = None, rating: float = None) -> list:
    global db
    hotels_list = db.get("hotels", {}).get("available_hotels", [])
    if hotel_id:
        return [h for h in hotels_list if h.get("hotelID") == hotel_id]
        
    params = {}
    if city:
        params["city"] = city
    if rating is not None:
        params["rating"] = rating
    return filter_data(hotels_list, params)

def query_activities(city: str = None, activity_id: str = None) -> list:
    global db
    activities_list = db.get("thingsToDo", {}).get("available_activities", [])
    if activity_id:
        return [a for a in activities_list if a.get("activityID") == activity_id]
        
    params = {}
    if city:
        params["city"] = city
    return filter_data(activities_list, params)

def query_active_bookings() -> list:
    global db
    return db.get("bookings", {}).get("active_bookings", [])

def perform_booking(name: str, item_id: str, item_type: str = "general", item_data: dict = None, date: str = None) -> dict:
    global db
    if not item_data:
        item_data = {}
    if not date:
        date = item_data.get("date") or datetime.now().strftime("%Y-%m-%d")
        
    booking_id = f"BKG-{random.randint(100000, 999999)}"
    new_booking = {
        "bookingId": booking_id,
        "name": name,
        "itemType": item_type,
        "itemId": item_id,
        "itemData": item_data,
        "date": date,
        "bookedAt": datetime.utcnow().isoformat() + "Z"
    }

    if "bookings" not in db:
        db["bookings"] = {}
    if "active_bookings" not in db["bookings"]:
        db["bookings"]["active_bookings"] = []

    db["bookings"]["active_bookings"].append(new_booking)
    save_db(db)
    return new_booking

# HTTP route handlers for external API consumers
@mock_router.get("/health")
def mock_health():
    return {"status": "ok"}

@mock_router.get("/flights/available_flights")
def get_flights(request: Request):
    global db
    query_params = dict(request.query_params)
    flights_list = db.get("flights", {}).get("available_flights", [])
    
    flight_id = query_params.get("flightID")
    if flight_id:
        return [f for f in flights_list if f.get("flightID") == flight_id]
        
    return filter_data(flights_list, query_params)

@mock_router.get("/hotels/available_hotels")
def get_hotels(request: Request):
    global db
    query_params = dict(request.query_params)
    hotels_list = db.get("hotels", {}).get("available_hotels", [])
    
    hotel_id = query_params.get("hotelID")
    if hotel_id:
        return [h for h in hotels_list if h.get("hotelID") == hotel_id]
        
    return filter_data(hotels_list, query_params)

@mock_router.get("/thingsToDo/available_activities")
def get_activities(request: Request):
    global db
    query_params = dict(request.query_params)
    activities_list = db.get("thingsToDo", {}).get("available_activities", [])
    
    activity_id = query_params.get("activityID")
    if activity_id:
        return [a for a in activities_list if a.get("activityID") == activity_id]
        
    return filter_data(activities_list, query_params)

@mock_router.get("/bookings/active_bookings")
def get_active_bookings_endpoint():
    return query_active_bookings()

@mock_router.post("/book")
async def post_book(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    name = body.get("name")
    item_id = body.get("itemId")
    item_type = body.get("itemType", "general")
    item_data = body.get("itemData", {})
    date = body.get("date")

    if not name or not item_id:
        return JSONResponse(status_code=400, content={"error": "Guest name and Item ID are required."})

    res = perform_booking(name, item_id, item_type, item_data, date)
    return JSONResponse(status_code=201, content=res)
