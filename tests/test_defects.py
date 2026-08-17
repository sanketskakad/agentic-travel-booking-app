import pytest
import concurrent.futures
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.controllers.mock_controller import perform_booking, filter_data
from app.services.agent_service import (
    parse_details_fallback,
    flight_agent,
    hotel_agent,
    activity_agent,
    extraction_node,
    validate_extracted_data,
    graph
)
from app.models.schemas import State

client = TestClient(app)

def test_concurrent_booking_safety():
    """Defect 1: Test concurrent booking requests to verify no thread race condition or corruption."""
    def make_booking(i):
        return perform_booking(name=f"User {i}", item_id=f"FLT-{i}", item_type="flights")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(make_booking, i) for i in range(20)]
        results = [f.result() for f in futures]

    assert len(results) == 20
    assert all("bookingId" in r for r in results)

def test_price_unit_filtering_euros():
    """Defect 2: Test price filter in Euros against items with price stored in cents (e.g. 8700 cents = €87.00)."""
    items = [
        {"flightID": "F1", "price": "8700"},   # €87.00
        {"flightID": "F2", "price": "15000"},  # €150.00
        {"flightID": "F3", "price": "25000"},  # €250.00
    ]
    # Filter for maxPrice = 200 Euros (should match €87.00 and €150.00)
    filtered = filter_data(items, {"maxPrice": "200"})
    assert len(filtered) == 2
    assert [f["flightID"] for f in filtered] == ["F1", "F2"]

def test_multi_turn_memory_preservation():
    """Defect 3: Test multi-turn conversations retain origin and destination across requests."""
    thread_id = "test_memory_thread_1"
    
    # Turn 1: Specify origin and destination
    resp1 = client.post("/api/travelplan", json={"query": "Fly from Berlin to Paris on 2026-09-01", "thread_id": thread_id})
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "Paris" in data1["response"] or data1.get("departure_date") == "2026-09-01"

    # Turn 2: Follow-up query without destination
    resp2 = client.post("/api/travelplan", json={"query": "Show me hotels", "thread_id": thread_id})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert "Paris" in data2["response"]

def test_malformed_schema_unpacking():
    """Defect 4: Test error boundaries when raw items contain invalid or unexpected fields."""
    state: State = {
        "message": "Trip to Paris",
        "origin_city": "Berlin",
        "destination_city": "Paris",
        "travel_date": "Not specified",
        "return_date": "Not specified",
        "budget": "Not specified",
        "flight_state": [],
        "return_flight_state": [],
        "hotel_state": [],
        "activity_state": [],
        "is_valid": True,
        "clarification_message": None
    }
    
    # Mock repository returning bad items
    with patch("app.services.agent_service.get_available_hotels") as mock_hotels:
        mock_hotels.return_value = [
            {"hotelName": "Good Hotel", "city": "Paris", "hotelID": "HTL-1", "pricePerNight": 10000, "rating": 4.5},
            {"invalid": "data"}
        ]
        res = hotel_agent(state)
        assert "hotel_state" in res
        assert len(res["hotel_state"]) == 2  # Handled safely via field_validators / try-except

def test_non_ascii_parsing_and_clarification_node():
    """Defect 5: Test non-ASCII city extraction and routing to clarification node when query is vague."""
    # Non-ASCII extraction
    parsed = parse_details_fallback("Fly from München to Zürich")
    assert parsed["origin_city"] == "München"
    assert parsed["destination_city"] == "Zürich"

    # Vague greeting query routing to clarification node
    state = {"message": "Hello", "is_valid": False}
    extracted = extraction_node(state)
    assert extracted["is_valid"] is False
    assert validate_extracted_data(extracted) == "clarification_node"

def test_groq_timeout_parameters():
    """Defect 6: Test ChatGroq is called with request_timeout and max_retries."""
    with patch.dict("os.environ", {"GROQ_API_KEY": "fake_test_key"}), patch("langchain_groq.ChatGroq") as mock_groq:
        mock_instance = MagicMock()
        mock_instance.invoke.return_value = MagicMock(content="Summary")
        mock_groq.return_value = mock_instance

        client.post("/api/generatesummary", json={
            "guestName": "John Doe",
            "items": [{"id": "FL-1", "name": "Flight", "type": "flight", "price": 10000}]
        })
        assert mock_groq.called
        _, kwargs = mock_groq.call_args
        assert kwargs.get("request_timeout") == 10.0
        assert kwargs.get("max_retries") == 2

def test_empty_travel_options_header():
    """QA ERR-01: Test empty results return 'No Travel Options Found' header message."""
    resp = client.post("/api/travelplan", json={"query": "Fly from Berlin to Tokyo", "thread_id": "test_empty_1"})
    assert resp.status_code == 200
    data = resp.json()
    assert "No Travel Options Found" in data["response"]

def test_clarification_message_in_response():
    """QA ERR-02: Test clarification message and is_valid are returned in response payload."""
    resp = client.post("/api/travelplan", json={"query": "Hello", "thread_id": "test_clarify_1"})
    assert resp.status_code == 200
    data = resp.json()
    assert "is_valid" in data
    assert data["is_valid"] is False
    assert "clarification_message" in data
    assert "Destination city could not be identified" in data["clarification_message"]

def test_flight_id_categorization():
    """Audit CRIT-04: Test flight route code IDs (e.g. MUM-SIN-001) are categorized as flights."""
    from app.repositories.travel_repository import book_item
    booking = book_item("Test Guest", "MUM-SIN-001")
    assert booking.get("itemType") == "flights"

def test_invalid_item_booking():
    """Audit HIGH-04: Test booking non-existent item ID returns 400 error."""
    resp = client.post("/api/book", json={"name": "Test Guest", "itemId": "INVALID-FLIGHT-9999"})
    assert resp.status_code == 400
    data = resp.json()
    assert "error" in data
