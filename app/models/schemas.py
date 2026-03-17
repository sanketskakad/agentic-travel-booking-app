from typing import TypedDict, List, Optional
from pydantic import BaseModel

class HotelState(BaseModel):
    hotelName: str
    city: str
    cityCode: str
    country: str
    pricePerNight: str
    rating: str
    availableRooms: str
    hotelID: str

class FlightState(BaseModel):
    flightName: str
    origin: str
    originCode: str
    destination: str
    destinationCode: str
    departureTime: str
    arrivalTime: str
    duration: str
    price: str
    availableSeats: str
    flightID: str

class ActivityState(BaseModel):
    activityName: str
    city: str
    cityCode: str
    country: str
    description: str
    price: str
    duration: str
    activityID: str

class State(TypedDict):
    message: str
    origin_city: str
    destination_city: str
    travel_date: str
    return_date: str
    budget: str
    hotel_state: List[HotelState]
    flight_state: List[FlightState]
    return_flight_state: List[FlightState]
    activity_state: List[ActivityState]
    is_valid: Optional[bool]
    clarification_message: Optional[str]

class QueryRequest(BaseModel):
    query: str
    thread_id: Optional[str] = "default_thread"

class BookRequest(BaseModel):
    name: str
    itemId: str

class ItemDetail(BaseModel):
    id: str
    name: str
    type: str
    price: int
    details: Optional[str] = None

class GenerateSummaryRequest(BaseModel):
    guestName: str
    items: List[ItemDetail]
