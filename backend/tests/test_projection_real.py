"""Seam B2 on a real episode: the board shown for every event adds up to the thesis numbers."""
from __future__ import annotations

import pytest

from schedulesim.projection import build_project, history_until, issues_at, reopened_until

pytest.importorskip("torch")


@pytest.fixture(scope="module")
def traced():
    from arls_ppo.episode import trace_episode

    return trace_episode("MK01", 1.5, 0.30, 5001, "ppo_bc_ppo_g", 3.0)


def test_every_frame_shows_every_scheduled_task(traced):
    project = build_project(key="MK01", name="MK01", initial=traced.initial)
    for ev in traced.events:
        for phase, tasks in (("before", ev["before"]["tasks"]), ("aor", ev["aor"]["tasks"]),
                             ("after", ev["aor"]["tasks"])):
            entries = ev[phase]["entries"]
            issues = issues_at(project, tasks, entries,
                               reopened=reopened_until(traced.events, ev["index"], phase))
            assert {i["id"] for i in issues} == set(entries)
            assert {i["status"] for i in issues} <= {"To Do", "In Progress", "Done", "Reopened"}


def test_history_has_exactly_the_changes_of_the_thesis(traced):
    project = build_project(key="MK01", name="MK01", initial=traced.initial)
    last = traced.events[-1]["index"]
    history = history_until(project, traced.events, last, "after")
    changes = [h for h in history if h["kind"] in ("assignee", "rank")]
    assert len(changes) == traced.result["ubah"]
    for ev in traced.events:
        assert sum(1 for h in changes if h["event"] == ev["index"]) == ev["changes"]


def test_every_unplanned_task_has_a_created_entry(traced):
    project = build_project(key="MK01", name="MK01", initial=traced.initial)
    last = traced.events[-1]
    history = history_until(project, traced.events, last["index"], "after")
    created = {h["issue"] for h in history if h["kind"] == "created"}
    unplanned = {i["key"] for i in issues_at(project, last["aor"]["tasks"],
                                             last["after"]["entries"]) if i["unplanned"]}
    assert created == unplanned and unplanned
