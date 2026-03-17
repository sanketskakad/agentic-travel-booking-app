import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_travelplan_endpoint():
    payload = {"query": "Find flights from Berlin to Frankfurt", "thread_id": "test_session_1"}
    response = client.post("/api/travelplan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "response" in data
    assert "flights" in data
    assert "hotels" in data
    assert "activities" in data

def test_book_endpoint():
    payload = {"name": "Test User", "itemId": "FL-101"}
    response = client.post("/api/book", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "bookingId" in data or "status" in data or "message" in data

def test_mock_controller_flights():
    response = client.get("/mock-api/flights/available_flights?origin=Berlin&destination=Frankfurt")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
