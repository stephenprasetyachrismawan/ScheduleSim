"""Seam B5: the HTTP contract of the backend, through FastAPI's TestClient."""
from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from schedulesim.api import create_app

TOKO = {
    "key": "SHOP", "name": "Toko uji API",
    "developers": [{"name": "Ayu (backend)"}, {"name": "Budi (backend)"},
                   {"name": "Citra (frontend)"}],
    "epics": [
        {"name": "Login", "issues": [{"summary": "Rancang API", "efforts": {"0": 3, "1": 4}},
                                     {"summary": "Halaman masuk", "efforts": {"2": 3}}]},
        {"name": "Pembayaran", "issues": [
            {"summary": "Integrasi gateway", "efforts": {"0": 5, "1": 6}},
            {"summary": "Uji pembayaran", "efforts": {"1": 2, "2": 2.5}}]},
    ],
    "links": [{"from": [0, 0], "to": [1, 0]}],
}


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    app = create_app(data_dir=tmp_path_factory.mktemp("data"), workers=2)
    with TestClient(app) as c:
        yield c


def _wait(client, run_id, timeout=300):
    end = time.time() + timeout
    while time.time() < end:
        r = client.get(f"/api/runs/{run_id}").json()
        if r["status"] in ("done", "error"):
            return r
        time.sleep(0.2)
    raise TimeoutError(run_id)


def test_meta_lists_the_thesis_settings_and_the_checked_models(client):
    m = client.get("/api/meta").json()
    assert [x["name"] for x in m["methods"]][:1] == ["ARLS-PPO"]
    assert {x["code"] for x in m["methods"]} >= {"ppo_bc_ppo_g", "seq", "fix3_g", "aor"}
    assert m["lambdas"] == [0.1, 0.3, 1.0, 3.0, 10.0, 30.0]
    assert m["capacities"] == [1.0, 1.5, 2.0] and m["intensities"] == [0.05, 0.15, 0.3]
    assert m["validation_seeds"] == [5000, 5001]
    assert len(m["feature_names"]) == 38
    assert all(f["ok"] for f in m["models"]) and len(m["models"]) == 11
    assert m["models_match_test_lock"] is True


def test_projects_hold_training_instances_but_no_test_instances(client):
    keys = {p["key"]: p for p in client.get("/api/projects").json()}
    assert {"MK01", "MK02", "MK05", "MK06", "MK07", "MK08", "MK10"} <= set(keys)
    assert not {"MK03", "MK04", "MK09"} & set(keys)
    assert keys["MK01"]["group"] == "Brandimarte (latih)"
    assert any(p["group"] == "Benchmark (validasi)" for p in keys.values())


def test_a_project_shows_its_initial_board(client):
    p = client.get("/api/projects/MK01", params={"capacity": 1.5}).json()
    assert p["project"]["key"] == "MK01"
    assert len(p["issues"]) == 55 and len(p["assignees"]) == 6
    assert {i["status"] for i in p["issues"]} <= {"To Do", "In Progress"}


def test_test_data_is_refused(client):
    assert client.get("/api/projects/MK03").status_code == 403
    r = client.post("/api/runs", json={"project": "MK01", "capacity": 1.5, "intensity": 0.15,
                                       "seed": 10000, "lam": 3.0,
                                       "methods": [{"method": "aor"}]})
    assert r.status_code == 403 and "seed" in r.json()["detail"]
    r = client.post("/api/runs", json={"project": "MK04", "capacity": 1.5, "intensity": 0.15,
                                       "seed": 5000, "lam": 3.0,
                                       "methods": [{"method": "aor"}]})
    assert r.status_code == 403


def test_an_unknown_method_is_refused(client):
    r = client.post("/api/runs", json={"project": "MK01", "capacity": 1.5, "intensity": 0.15,
                                       "seed": 5000, "lam": 3.0, "methods": [{"method": "b1"}]})
    assert r.status_code == 422


def test_a_run_gives_the_thesis_numbers_and_frames(client):
    from arls_ppo.episode import run_episode

    r = client.post("/api/runs", json={"project": "MK01", "capacity": 1.5, "intensity": 0.15,
                                       "seed": 5000, "lam": 3.0,
                                       "methods": [{"method": "ppo_bc_ppo_g", "model_seed": 0},
                                                   {"method": "fix3_g"}]})
    assert r.status_code == 202
    run = _wait(client, r.json()["run_id"])
    assert run["status"] == "done"
    plain = run_episode("MK01", 1.5, 0.15, 5000, "ppo_bc_ppo_g", 3.0)
    res = {x["key"]: x for x in run["results"]}
    assert res["ppo_bc_ppo_g@0"]["J"] == plain["J"]
    assert res["ppo_bc_ppo_g@0"]["changes"] == plain["ubah"]
    assert res["ppo_bc_ppo_g@0"]["name"] == "ARLS-PPO"

    events = client.get(f"/api/runs/{run['run_id']}/ppo_bc_ppo_g@0/events").json()
    assert len(events) == plain["keputusan"]
    frame = client.get(f"/api/runs/{run['run_id']}/ppo_bc_ppo_g@0/frames/0/after").json()
    assert frame["event"]["index"] == 0 and frame["issues"]
    changes = [h for h in frame["history"] if h["kind"] in ("assignee", "rank")]
    assert len(changes) == events[0]["changes"]


def test_a_custom_project_can_be_created_run_and_deleted(client):
    r = client.post("/api/projects", json=TOKO)
    assert r.status_code == 201
    p = client.get("/api/projects/SHOP").json()
    assert [i["summary"] for i in p["issues"]][:2] == ["Rancang API", "Halaman masuk"]
    assert p["assignees"][0]["name"] == "Ayu (backend)"
    run = client.post("/api/runs", json={"project": "SHOP", "capacity": 1.5, "intensity": 0.3,
                                         "seed": 5000, "lam": 3.0,
                                         "methods": [{"method": "ppo_bc_ppo_g"}]}).json()
    assert _wait(client, run["run_id"])["status"] == "done"
    assert client.delete("/api/projects/SHOP").status_code == 204
    assert client.get("/api/projects/SHOP").status_code == 404


def test_an_invalid_custom_project_is_refused_with_its_reason(client):
    bad = {**TOKO, "key": "BAD", "links": [{"from": [0, 0], "to": [1, 0]},
                                           {"from": [1, 0], "to": [0, 0]}]}
    r = client.post("/api/projects", json=bad)
    assert r.status_code == 422 and "siklus" in r.json()["detail"]


def test_a_rejected_card_move_answers_with_the_rule(client):
    run = client.post("/api/runs", json={"project": "MK01", "capacity": 1.5, "intensity": 0.15,
                                         "seed": 5000, "lam": 3.0,
                                         "manual": {"moves": {"0": [{"task": 0, "to_dev": 99}]}}})
    assert run.status_code == 202
    out = _wait(client, run.json()["run_id"])
    assert out["status"] == "error"
    assert out["error"]["rule"] in ("A1", "A3", "status")


def test_test_results_are_served_read_only(client):
    r = client.get("/api/results").json()
    assert r["main"]["acak_g"]["0.3"]["uk1"][0] == pytest.approx(-24.0119, abs=1e-3)
    assert r["violations"]["ppo_bc_ppo_g"]["keras"] == 0
