"""Seam B6: the number log over HTTP, the rerun check, and the limits of the public site.

The log endpoints only pass on what ``arls_ppo`` recorded with ``explain=True``; these tests
check that the numbers arrive unchanged, that a rerun without cache reproduces every number
(only times in milliseconds may differ), and that the public mode keeps the shared server
usable: few runs per visitor, read-only examples, and projects only their maker can change.
"""
from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from schedulesim.api import create_app

JOB = {"project": "MK01", "capacity": 1.5, "intensity": 0.15, "seed": 5000, "lam": 3.0}


def _wait(client, run_id, timeout=300):
    end = time.time() + timeout
    while time.time() < end:
        r = client.get(f"/api/runs/{run_id}").json()
        if r["status"] in ("done", "error"):
            return r
        time.sleep(0.2)
    raise TimeoutError(run_id)


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    app = create_app(data_dir=tmp_path_factory.mktemp("data"), workers=2)
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def ppo_run(client):
    r = client.post("/api/runs", json={**JOB, "methods": [{"method": "ppo_bc_ppo_g",
                                                            "model_seed": 0}]})
    run = _wait(client, r.json()["run_id"])
    assert run["status"] == "done"
    return run["run_id"], "ppo_bc_ppo_g@0"


def test_the_episode_log_gives_input_disruptions_and_output_of_the_run(client, ppo_run):
    from arls_ppo.episode import trace_episode

    run_id, key = ppo_run
    log = client.get(f"/api/runs/{run_id}/{key}/log").json()
    ref = trace_episode("MK01", 1.5, 0.15, 5000, "ppo_bc_ppo_g", 3.0, model_seed=0,
                        explain=True)
    assert log["input"]["E"] == ref.explain["input"]["E"]
    assert log["input"]["s0_rebuilt_equal"] is True
    assert log["disruptions"]["seed"] == ref.explain["disruptions"]["seed"]
    assert log["output"]["J"] == ref.result["J"]
    assert len(log["events"]) == len(ref.events)
    assert log["names"]["project"] == "MK01" and log["names"]["devs"]["0"] == "Pengembang 1"
    det = log["determinism"]
    assert det["episode_seed"] == 5000 and det["disruption_seed"] == log["disruptions"]["seed"]
    assert any(f["path"].endswith("e9c_s0/bc_ppo.zip") for f in det["model_files"])


def test_the_event_log_matches_the_worked_example_of_bab_iv(client, ppo_run):
    run_id, key = ppo_run
    ev = client.get(f"/api/runs/{run_id}/{key}/log/0").json()
    assert ev["tard_aor"] == pytest.approx(18.93732062552392, abs=1e-12)
    first = ev["subs"][0]
    assert first["selector"]["logits"][1] == pytest.approx(7.521430015563965, abs=1e-6)
    assert first["selector"]["probs"][1] == pytest.approx(0.9814031982253295, abs=1e-7)
    assert first["levels"]["1"]["J"] == pytest.approx(3.0102052336020075, abs=1e-12)
    assert first["decision"]["rule"] == "guard" and first["decision"]["accepted"] is True
    assert len(first["features"]) == 38
    assert client.get(f"/api/runs/{run_id}/{key}/log/999").status_code == 404


def test_a_rerun_without_cache_reproduces_every_number(client, ppo_run):
    run_id, key = ppo_run
    out = client.post(f"/api/runs/{run_id}/{key}/ulang").json()
    assert out["same"] is True and out["differences"] == []
    assert out["compared"] > 1000


# ---------------------------------------------------------------------- public mode
@pytest.fixture()
def public(tmp_path):
    app = create_app(data_dir=tmp_path, workers=1, public=True)
    with TestClient(app) as c:
        yield c


def test_the_public_site_limits_running_runs_per_visitor(public):
    ip = {"CF-Connecting-IP": "203.0.113.7"}
    body = {**JOB, "project": "MK10", "methods": [{"method": "seq"}]}
    codes = [public.post("/api/runs", json={**body, "seed": s}, headers=ip).status_code
             for s in (5000, 5001, 5002)]
    assert codes[:2] == [202, 202] and codes[2] == 429
    other = public.post("/api/runs", json={**JOB, "methods": [{"method": "aor"}]},
                        headers={"CF-Connecting-IP": "198.51.100.9"})
    assert other.status_code == 202


def test_the_public_site_keeps_examples_read_only_and_projects_to_their_maker(public):
    assert public.delete("/api/projects/TOKO").status_code == 403
    spec = {"key": "MINE", "name": "Proyek uji", "developers": [{"name": "A"}, {"name": "B"}],
            "epics": [{"name": "E", "issues": [{"summary": "x", "efforts": {"0": 2, "1": 3}}]}],
            "links": []}
    me, other = {"X-Owner-Token": "a" * 32}, {"X-Owner-Token": "b" * 32}
    assert public.post("/api/projects", json=spec).status_code == 403      # no token
    assert public.post("/api/projects", json=spec, headers=me).status_code == 201
    assert public.delete("/api/projects/MINE", headers=other).status_code == 403
    assert public.put("/api/projects/MINE", json=spec, headers=other).status_code == 403
    assert public.delete("/api/projects/MINE", headers=me).status_code == 204


def test_the_public_site_refuses_projects_that_are_too_big(public):
    devs = [{"name": f"D{i}"} for i in range(11)]
    spec = {"key": "BIG", "name": "Besar", "developers": devs,
            "epics": [{"name": "E", "issues": [{"summary": "x", "efforts": {"0": 1}}]}],
            "links": []}
    r = public.post("/api/projects", json=spec, headers={"X-Owner-Token": "c" * 32})
    assert r.status_code == 422 and "pengembang" in r.json()["detail"]


def test_pages_answer_head_requests_too(client):
    from schedulesim import ROOT

    if not (ROOT / "frontend" / "dist" / "index.html").exists():
        pytest.skip("frontend not built")
    assert client.head("/").status_code == 200
    assert client.head("/simulasi").status_code == 200
