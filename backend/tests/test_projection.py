"""Seam B2: the thesis schedule shown as a project-management board.

A tiny hand-made project with known answers: two features (jobs), two developers, one event
with an unplanned task, a rework, and two counted changes.
"""
from __future__ import annotations

import pytest

from schedulesim.projection import build_project, history_until, issues_at, reopened_until


def _task(i, job, op, eligible, due, status="not_started", deps=(), priority=0.5):
    return {"id": i, "job": job, "op": op, "eligible": eligible, "deps": list(deps),
            "due": due, "priority": priority, "status": status, "progress": 0.0}


INITIAL = {
    "t": 2.0,
    "tasks": [_task(0, 0, 0, {0: 4.0, 1: 6.0}, 5.0, "in_progress"),
              _task(1, 0, 1, {0: 3.0}, 6.0, deps=[0]),
              _task(2, 1, 0, {1: 3.0}, 10.0, "in_progress", priority=0.9)],
    "developers": [{"id": 0, "capacity": 20.0, "available": True},
                   {"id": 1, "capacity": 20.0, "available": True}],
    "entries": {0: {"dev": 0, "start": 0.0, "end": 4.0}, 1: {"dev": 0, "start": 4.0, "end": 7.0},
                2: {"dev": 1, "start": 0.0, "end": 3.0}},
    "pauses": {},
}

AOR_TASKS = [_task(0, 0, 0, {0: 4.0, 1: 6.0}, 5.0, "in_progress"),
             _task(1, 0, 1, {0: 3.0}, 6.0, deps=[0]),
             _task(2, 1, 0, {1: 3.0}, 10.0, "in_progress", priority=0.9),
             _task(3, 2, 0, {1: 2.0, 0: 2.5}, 6.0, priority=1.0)]

EVENT = {
    "index": 0, "time": 2.0, "type": "batch",
    "disruptions": [{"type": "urgent_task", "time": 1.5,
                     "payload": {"dev_id": 1, "eligible": {1: 2.0, 0: 2.5}, "effort": 2.0,
                                 "priority": 1.0}},
                    {"type": "developer_unavailable", "time": 2.0,
                     "payload": {"dev_id": 1, "duration": 3.0}}],
    "before": INITIAL,
    "aor": {"t": 2.0, "tasks": AOR_TASKS, "pauses": {1: [[2.0, 5.0]]},
            "entries": {0: {"dev": 0, "start": 0.0, "end": 4.0},
                        1: {"dev": 0, "start": 4.0, "end": 7.0},
                        2: {"dev": 1, "start": 0.0, "end": 6.0},
                        3: {"dev": 1, "start": 6.0, "end": 8.0}}},
    "after": {"t": 2.0, "pauses": {1: [[2.0, 5.0]]},
              "entries": {0: {"dev": 0, "start": 0.0, "end": 4.0},
                          3: {"dev": 0, "start": 4.0, "end": 6.5},
                          1: {"dev": 0, "start": 6.5, "end": 9.5},
                          2: {"dev": 1, "start": 0.0, "end": 6.0}}},
    "subs": [{"j": 0, "type": "urgent_task", "requested": 2, "used": 2, "outcome": "dipakai"},
             {"j": 1, "type": "developer_unavailable", "requested": 0, "used": 0,
              "outcome": "tingkat_0"}],
    "changes": 1,
    "change_items": [{"task": 3, "kind": "assignee", "from_dev": 1, "to_dev": 0}],
}

REWORK = {
    "index": 1, "time": 9.0, "type": "rework_review_fail",
    "disruptions": [{"type": "rework_review_fail", "time": 9.0,
                     "payload": {"task_id": 0, "extra_effort": 1.5}}],
    "before": {**EVENT["after"], "t": 9.0,
               "tasks": [{**AOR_TASKS[0], "status": "completed"}, *AOR_TASKS[1:]]},
    "aor": {"t": 9.0, "pauses": {},
            "tasks": [{**AOR_TASKS[0], "status": "not_started", "eligible": {0: 5.5, 1: 7.5}},
                      {**AOR_TASKS[1], "status": "in_progress"}, AOR_TASKS[2],
                      {**AOR_TASKS[3], "status": "completed"}],
            "entries": {0: {"dev": 0, "start": 9.5, "end": 15.0},
                        3: {"dev": 0, "start": 4.0, "end": 6.5},
                        1: {"dev": 0, "start": 6.5, "end": 9.5},
                        2: {"dev": 1, "start": 0.0, "end": 6.0}}},
    "after": {"t": 9.0, "pauses": {},
              "entries": {0: {"dev": 0, "start": 9.5, "end": 15.0},
                          3: {"dev": 0, "start": 4.0, "end": 6.5},
                          1: {"dev": 0, "start": 6.5, "end": 9.5},
                          2: {"dev": 1, "start": 0.0, "end": 6.0}}},
    "subs": [{"j": 0, "type": "rework_review_fail", "requested": 0, "used": 0,
              "outcome": "tingkat_0"}],
    "changes": 0, "change_items": [],
}


@pytest.fixture
def project():
    return build_project(key="MK01", name="MK01 (Brandimarte)", initial=INITIAL)


def _by_key(issues):
    return {i["key"]: i for i in issues}


def test_jobs_become_epics_and_machines_become_assignees(project):
    assert [e["name"] for e in project.epics] == ["Fitur 01", "Fitur 02"]
    assert [a["name"] for a in project.assignees] == ["Pengembang 1", "Pengembang 2"]
    assert [a["origin"] for a in project.assignees] == ["M1", "M2"]


def test_issues_at_the_initial_schedule(project):
    issues = _by_key(issues_at(project, INITIAL["tasks"], INITIAL["entries"]))
    assert list(issues) == ["MK01-1", "MK01-2", "MK01-3"]
    first, second, third = issues["MK01-1"], issues["MK01-2"], issues["MK01-3"]
    assert first["summary"] == "Fitur 01 / Tugas 1" and first["epic"] == "Fitur 01"
    assert third["epic"] == "Fitur 02"
    assert first["status"] == "In Progress" and second["status"] == "To Do"
    assert first["assignee"] == "Pengembang 1" and third["assignee"] == "Pengembang 2"
    assert first["estimate"] == 4.0 and third["estimate"] == 3.0
    assert second["rank"] == 1 and first["rank"] is None
    assert second["late"] is True and second["lateness"] == pytest.approx(1.0)
    assert first["late"] is False and first["lateness"] == 0.0
    assert second["blocked_by"] == ["MK01-1"] and first["blocks"] == ["MK01-2"]
    assert third["priority"] == "Highest" and second["priority"] == "High"
    assert first["origin"] == {"instance": "MK01", "job": 1, "operation": 1,
                               "machine": "M1", "eligible": {"M1": 4.0, "M2": 6.0}}


def test_an_unplanned_task_is_a_new_issue_in_its_own_epic(project):
    issues = _by_key(issues_at(project, AOR_TASKS, EVENT["after"]["entries"]))
    new = issues["MK01-4"]
    assert new["epic"] == "Pekerjaan tidak terencana"
    assert new["summary"] == "Pekerjaan tidak terencana #1"
    assert new["unplanned"] is True
    assert new["assignee"] == "Pengembang 1" and new["estimate"] == 2.5
    assert issues["MK01-2"]["rank"] == 2 and new["rank"] == 1


def test_a_reworked_task_is_reopened(project):
    reopened = reopened_until([EVENT, REWORK], 1)
    assert reopened == {0}
    issues = _by_key(issues_at(project, REWORK["aor"]["tasks"], REWORK["aor"]["entries"],
                               reopened=reopened))
    assert issues["MK01-1"]["status"] == "Reopened"
    assert issues["MK01-4"]["status"] == "Done"
    assert issues["MK01-1"]["estimate"] == 5.5


def test_history_lists_disruptions_then_exactly_the_counted_changes(project):
    events = [EVENT, REWORK]
    aor = history_until(project, events, 0, "aor")
    assert [h["kind"] for h in aor] == ["created", "unavailable"]
    assert aor[0]["issue"] == "MK01-4" and "pekerjaan tidak terencana" in aor[0]["text"]
    assert aor[1]["assignee"] == "Pengembang 2" and "2,0" in aor[1]["text"]

    after = history_until(project, events, 0, "after")
    changes = [h for h in after if h["kind"] in ("assignee", "rank")]
    assert len(changes) == EVENT["changes"]
    assert changes[0]["issue"] == "MK01-4"
    assert changes[0]["text"] == "Assignee: Pengembang 2 → Pengembang 1"

    later = history_until(project, events, 1, "aor")
    reopened = [h for h in later if h["kind"] == "reopened"]
    assert reopened and reopened[0]["issue"] == "MK01-1" and "1,5 jam" in reopened[0]["text"]
