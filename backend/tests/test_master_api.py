"""Seam B7: the master data of a project, down to the line of the raw file it came from.

Every task of a thesis instance is one operation of one job in a raw benchmark file
(``data/raw/MK01.json``: ``jobs[j][o]`` is the list of machines that can do operation ``o`` of
job ``j``, each with its processing time). These tests read that file directly and check that
``/api/projects/{key}/master`` gives the same options, and that the efforts it reports are the
ones the episode itself works with (the number log of a real episode, a separate path).
"""
from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from schedulesim import ARLS_PPO
from schedulesim.api import EXAMPLES, create_app

RAW = ARLS_PPO / "exp1" / "dfjsp-ppo-repair" / "data" / "raw"


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    app = create_app(data_dir=tmp_path_factory.mktemp("data"), workers=1)
    with TestClient(app) as c:
        yield c


def test_mk01_has_55_tasks_each_with_the_options_written_in_the_raw_file(client):
    path = RAW / "MK01.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    m = client.get("/api/projects/MK01/master").json()

    assert m["source"]["kind"] == "file"
    assert m["source"]["path"].endswith("data/raw/MK01.json")
    assert m["source"]["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert m["source"]["machines"] == raw["machines"] == len(m["developers"])
    assert m["source"]["scale"] == 1.0
    assert len(m["tasks"]) == 55
    i = 0
    for j, job in enumerate(raw["jobs"]):
        for o, options in enumerate(job):
            t = m["tasks"][i]
            assert (t["id"], t["job"], t["op"]) == (i, j, o)
            assert t["pointer"] == f"jobs[{j}][{o}]"
            assert t["raw"] == options
            assert t["eligible"] == {str(c["machine"]): float(c["processing"]) for c in options}
            i += 1
    # task 55 is not in the file: the first unplanned task of an episode gets that id
    assert m["tasks"][-1]["id"] == 54


def test_the_efforts_of_the_master_are_the_ones_the_episode_works_with(client):
    from arls_ppo.episode import trace_episode

    m = client.get("/api/projects/MK01/master").json()
    ref = trace_episode("MK01", 1.5, 0.15, 5000, "aor", 3.0, explain=True)
    rows = {r["tugas"]: r for r in ref.explain["input"]["tasks"]}
    assert len(rows) == len(m["tasks"])
    for t in m["tasks"]:
        r = rows[t["id"]]
        assert (r["job"], r["op"]) == (t["job"], t["op"])
        assert {str(k): v for k, v in r["layak"].items()} == t["eligible"]
        assert sorted(r["deps"]) == sorted(d["id"] for d in t["deps"])


def test_a_dependency_inside_a_job_is_the_previous_operation_of_that_job(client):
    m = client.get("/api/projects/MK01/master").json()
    by_id = {t["id"]: t for t in m["tasks"]}
    for t in m["tasks"]:
        for d in t["deps"]:
            other = by_id[d["id"]]
            if d["kind"] == "job":
                assert other["job"] == t["job"] and other["op"] == t["op"] - 1
            else:
                assert d["kind"] == "lintas" and other["job"] < t["job"]


def test_a_benchmark_task_is_the_raw_processing_time_times_one_scale_factor(client):
    path = RAW / "benchmark" / "hurink" / "edata" / "la05.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    m = client.get("/api/projects/LA05E/master").json()
    s = m["source"]["scale"]
    assert s > 0
    flat = [opts for job in raw["jobs"] for opts in job]
    assert len(flat) == len(m["tasks"])
    for t, options in zip(m["tasks"], flat):
        assert t["raw"] == options
        for c in options:
            assert t["eligible"][str(c["machine"])] == pytest.approx(c["processing"] * s, rel=1e-12)


def test_a_test_instance_has_no_master_data_on_the_simulator(client):
    r = client.get("/api/projects/MK03/master")
    assert r.status_code == 403


def test_a_user_project_points_to_the_issues_typed_in_its_spec(client):
    spec = json.loads((EXAMPLES / "kopi.json").read_text(encoding="utf-8"))
    m = client.get("/api/projects/KOPI/master").json()
    assert m["source"]["kind"] == "custom"
    typed = [(e, i, issue) for e, epic in enumerate(spec["epics"])
             for i, issue in enumerate(epic["issues"])]
    assert len(m["tasks"]) == len(typed)
    for t, (e, i, issue) in zip(m["tasks"], typed):
        assert t["pointer"] == f"epics[{e}].issues[{i}]"
        assert t["eligible"] == {k: float(v) for k, v in issue["efforts"].items()}
