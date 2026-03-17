import pytest
from unittest.mock import patch, MagicMock
from app.models.schemas import State
from app.services.agent_service import (
    extract_travel_details,
    extraction_node,
    flight_agent,
    hotel_agent,
    activity_agent,
    clarification_node,
    validate_extracted_data,
    graph
)

def test_extract_travel_details_missing_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(ValueError, match="GROQ_API_KEY is not configured"):
        extract_travel_details("Plan a trip to Paris")

@patch("app.services.agent_service.ChatGroq")
def test_extract_travel_details_success(mock_chat_groq, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    
    mock_instance = MagicMock()
    mock_structured_llm = MagicMock()
    
    mock_result = MagicMock()
    mock_result.origin_city = "Berlin"
    mock_result.destination_city = "Paris"
    mock_result.travel_date = "2026-09-01"
    mock_result.return_date = "2026-09-10"
    mock_result.budget = "1000"
    
    mock_structured_llm.invoke.return_value = mock_result
    mock_instance.with_structured_output.return_value = mock_structured_llm
    mock_chat_groq.return_value = mock_instance
    
    details = extract_travel_details("Trip from Berlin to Paris on 2026-09-01")
    assert details["origin_city"] == "Berlin"
    assert details["destination_city"] == "Paris"
    assert details["travel_date"] == "2026-09-01"

def test_nodes_output():
    state: State = {
        "message": "Trip from Berlin to Frankfurt",
        "origin_city": "Berlin",
        "destination_city": "Frankfurt",
        "travel_date": "2026-09-01",
        "return_date": "2026-09-10",
        "budget": "Not specified",
        "flight_state": [],
        "return_flight_state": [],
        "hotel_state": [],
        "activity_state": [],
        "is_valid": True,
        "clarification_message": None
    }
    
    flight_res = flight_agent(state)
    assert "flight_state" in flight_res
    assert "return_flight_state" in flight_res
    assert isinstance(flight_res["flight_state"], list)

    hotel_res = hotel_agent(state)
    assert "hotel_state" in hotel_res
    assert isinstance(hotel_res["hotel_state"], list)

    act_res = activity_agent(state)
    assert "activity_state" in act_res
    assert isinstance(act_res["activity_state"], list)

def test_validate_extracted_data():
    valid_state = {"is_valid": True, "destination_city": "Paris"}
    assert validate_extracted_data(valid_state) == "flight_agent"

    invalid_state = {"is_valid": False, "destination_city": ""}
    assert validate_extracted_data(invalid_state) == "clarification_node"

def test_clarification_node():
    state = {"clarification_message": "Invalid destination city"}
    res = clarification_node(state)
    assert res["is_valid"] is False
    assert res["clarification_message"] == "Invalid destination city"

def test_graph_compilation_and_memory():
    assert graph is not None
    assert hasattr(graph, "invoke")
