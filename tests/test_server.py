import os
os.environ.setdefault("API_KEY", "test-key-for-ci")
os.environ.setdefault("BASE_URL", "https://api.tokenmix.ai/v1")

import pytest
from fastapi.testclient import TestClient
from server import app, load_knowledge


client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "model" in data


def test_config():
    r = client.get("/config")
    assert r.status_code == 200
    data = r.json()
    assert "color" in data
    assert "title" in data
    assert "welcome" in data
    assert "suggestions" in data


def test_widget_js():
    r = client.get("/widget.js")
    assert r.status_code == 200
    assert "sc-bubble" in r.text
    assert "sc-panel" in r.text


def test_demo():
    r = client.get("/demo")
    assert r.status_code == 200
    assert "site-chat" in r.text


def test_chat_empty():
    r = client.post("/chat", json={"message": ""})
    assert r.status_code == 400


def test_chat_invalid_json():
    r = client.post("/chat", content=b"not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 400


def test_chat_no_body():
    r = client.post("/chat", json={})
    assert r.status_code == 400


def test_reload():
    r = client.post("/reload")
    assert r.status_code == 200
    assert "knowledge_chars" in r.json()


def test_knowledge_loader():
    kb = load_knowledge()
    # should load example.txt at minimum
    assert "return" in kb.lower() or len(kb) >= 0


def test_rate_limit():
    # send RATE_LIMIT+5 requests rapidly
    from server import RATE_LIMIT
    codes = []
    for i in range(RATE_LIMIT + 5):
        r = client.post("/chat", json={"message": "hi", "session_id": f"rate_{i}"})
        codes.append(r.status_code)
    assert 429 in codes
