import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PD = {"A": [[-1, -10], [0, -5]], "B": [[-1, 0], [-10, -5]]}


def test_health():
    assert client.get("/health").json() == {"ok": True}


def test_presets():
    data = client.get("/presets").json()
    assert "prisoners-dilemma" in data


@pytest.mark.parametrize("algo", ["support_enumeration", "lemke_howson", "lemke_howson_all"])
def test_solve_prisoners_dilemma(algo):
    r = client.post("/solve", json={**PD, "algorithm": algo})
    assert r.status_code == 200
    body = r.json()
    assert len(body["equilibria"]) == 1
    eq = body["equilibria"][0]
    assert eq["x"] == [0.0, 1.0] and eq["y"] == [0.0, 1.0]
    assert eq["verified"] and eq["pure"]


def test_lemke_howson_returns_trace():
    r = client.post("/solve", json={**PD, "algorithm": "lemke_howson", "label": 1})
    assert r.json()["trace"][0]["entering"] is None
    assert len(r.json()["trace"]) > 1


def test_support_trace_statuses():
    r = client.post("/solve", json={**PD, "algorithm": "support_enumeration"})
    statuses = {t["status"] for t in r.json()["trace"]}
    assert "accepted" in statuses


def test_rejects_ragged_and_oversized():
    assert client.post("/solve", json={"A": [[1, 2], [3]], "B": [[1, 2], [3]]}).status_code == 422
    big = [[0.0] * 9 for _ in range(9)]
    assert client.post("/solve", json={"A": big, "B": big}).status_code == 422
    assert client.post("/solve", json={"A": [[1]], "B": [[1, 2]]}).status_code == 422


def test_label_out_of_range():
    r = client.post("/solve", json={**PD, "algorithm": "lemke_howson", "label": 9})
    assert r.status_code == 422
