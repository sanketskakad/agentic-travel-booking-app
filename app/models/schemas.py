from typing import TypedDict, List, Optional, Any
from pydantic import BaseModel, field_validator

class HotelState(BaseModel):
    hotelName: str = ""
    city: str = ""
    cityCode: Optional[str] = ""
    country: Optional[str] = ""
    pricePerNight: str = ""
    rating: str = ""
    availableRooms: str = ""
    hotelID: str = ""

    @field_validator("pricePerNight", "rating", "availableRooms", mode="before")
    @classmethod
    def stringify_hotel_fields(cls, v: Any) -> str:
        return str(v) if v is not None else ""

class FlightState(BaseModel):
    flightName: str = ""
    origin: str = ""
    originCode: Optional[str] = ""
    destination: str = ""
    destinationCode: Optional[str] = ""
    departureTime: Optional[str] = ""
    arrivalTime: Optional[str] = ""
    duration: Optional[str] = ""
    price: str = ""
    availableSeats: str = ""
    flightID: str = ""

    @field_validator("price", "availableSeats", mode="before")
    @classmethod
    def stringify_flight_fields(cls, v: Any) -> str:
        return str(v) if v is not None else ""

class ActivityState(BaseModel):
    activityName: str = ""
    city: str = ""
    cityCode: Optional[str] = ""
    country: Optional[str] = ""
    description: Optional[str] = ""
    price: str = ""
    duration: Optional[str] = ""
    activityID: str = ""

    @field_validator("price", mode="before")
    @classmethod
    def stringify_activity_fields(cls, v: Any) -> str:
        return str(v) if v is not None else ""

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
