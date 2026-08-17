import os
import json
import random
import threading
import tempfile
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

mock_router = APIRouter()

# Path to embedded db.json and separate bookings.json within the app package
db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "db.json")
bookings_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "bookings.json")

db_lock = threading.Lock()

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
        db_dir = os.path.dirname(db_path)
        os.makedirs(db_dir, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", dir=db_dir, delete=False, encoding="utf-8") as tf:
            json.dump(data, tf, indent=2, ensure_ascii=False)
            temp_name = tf.name
        os.replace(temp_name, db_path)
    except Exception as e:
        print(f"Failed to save db.json: {e}")

# Load database cache on startup
db = load_db()

def load_bookings():
    if os.path.exists(bookings_path):
        try:
            with open(bookings_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("active_bookings", [])
        except Exception:
            pass
    return db.get("bookings", {}).get("active_bookings", [])

def save_bookings(active_bookings):
    try:
        b_dir = os.path.dirname(bookings_path)
        os.makedirs(b_dir, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", dir=b_dir, delete=False, encoding="utf-8") as tf:
            json.dump({"active_bookings": active_bookings}, tf, indent=2, ensure_ascii=False)
            temp_name = tf.name
        os.replace(temp_name, bookings_path)
    except Exception as e:
        print(f"Failed to save bookings.json: {e}")

# Helper function to filter array of dictionaries
def filter_data(data_list, query_params):
    if not isinstance(data_list, list):
        return data_list

    min_price = query_params.get("minPrice") or query_params.get("minprice")
    max_price = query_params.get("maxPrice") or query_params.get("maxprice")

    standard_query = {}
    for k, v in query_params.items():
        if k.lower() not in ["minprice", "maxprice"]:
            standard_query[k] = v

    filtered = data_list

    if standard_query:
        for k, val in standard_query.items():
            if not val:
                continue
            if k.lower() == "date":
                continue
            
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
                    price_in_euros = price_val / 100.0
                    if min_p <= price_in_euros <= max_p:
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
    return load_bookings()

def find_item_by_id(item_id: str):
    global db
    for f in db.get("flights", {}).get("available_flights", []):
        if f.get("flightID") == item_id:
            return f, "flights"
    for h in db.get("hotels", {}).get("available_hotels", []):
        if h.get("hotelID") == item_id:
            return h, "hotels"
    for a in db.get("thingsToDo", {}).get("available_activities", []):
        if a.get("activityID") == item_id:
            return a, "activities"
    return None, None

def perform_booking(name: str, item_id: str, item_type: str = "general", item_data: dict = None, date: str = None) -> dict:
    global db
    if not item_data:
        item_data = {}
    if not date:
        date = item_data.get("date") or datetime.now().strftime("%Y-%m-%d")
        
    found_item, detected_type = find_item_by_id(item_id)
    if found_item:
        if detected_type and item_type == "general":
            item_type = detected_type
        # Check and decrement available inventory
        if "availableSeats" in found_item:
            try:
                seats = int(found_item["availableSeats"])
                if seats <= 0:
                    return {"error": f"Item {item_id} has no available seats."}
                found_item["availableSeats"] = str(seats - 1)
            except ValueError:
                pass
        elif "availableRooms" in found_item:
            try:
                rooms = int(found_item["availableRooms"])
                if rooms <= 0:
                    return {"error": f"Item {item_id} has no available rooms."}
                found_item["availableRooms"] = str(rooms - 1)
            except ValueError:
                pass
        if not item_data:
            item_data = {k: v for k, v in found_item.items() if k != "reviews"}
    elif item_id and not (item_id.startswith("FL") or item_id.startswith("HTL") or item_id.startswith("ACT") or item_id.startswith("BKG")):
        return {"error": f"Item ID '{item_id}' not found in database."}

    booking_id = f"BKG-{uuid.uuid4().hex[:8].upper()}"
    new_booking = {
        "bookingId": booking_id,
        "name": name,
        "itemType": item_type,
        "itemId": item_id,
        "itemData": item_data,
        "date": date,
        "bookedAt": datetime.now(timezone.utc).isoformat() + "Z"
    }

    with db_lock:
        active_bookings = load_bookings()
        active_bookings.append(new_booking)
        save_bookings(active_bookings)
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
    if isinstance(res, dict) and "error" in res:
        return JSONResponse(status_code=400, content=res)
    return JSONResponse(status_code=201, content=res)
