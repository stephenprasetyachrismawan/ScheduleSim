"""The thesis schedule shown as a project-management board (seam B2).

Mapping, one to one with the thesis model:

* job -> Epic "Fitur NN"; tasks created by unplanned work -> Epic "Pekerjaan tidak terencana";
* operation (task) -> Issue ``KEY-n`` (n = task number + 1);
* machine -> Assignee "Pengembang n" (origin ``Mn``);
* effort on the assigned developer -> Original estimate (hours);
* due date d_i -> Due (hours, model time as is);
* task status at time t -> To Do / In Progress / Done, and Reopened after a failed review;
* position among the waiting tasks of a developer -> Rank;
* disruptions and the counted changes of each decision -> History.

Nothing here computes scheduling values. Every number comes from a snapshot recorded by
``arls_ppo.episode.trace_episode`` (or the initial schedule of a project).
"""
from __future__ import annotations

from dataclasses import dataclass, field

UNPLANNED_EPIC = "Pekerjaan tidak terencana"
STATUS = {"not_started": "To Do", "in_progress": "In Progress", "completed": "Done"}


def angka(value: float, digits: int = 1) -> str:
    """Number with a decimal comma, as in the thesis (2.5 -> "2,5")."""
    text = f"{value:,.{digits}f}"
    return text.replace(",", "_").replace(".", ",").replace("_", ".")


def priority_label(value: float) -> str:
    if value >= 0.75:
        return "Highest"
    if value >= 0.5:
        return "High"
    if value >= 0.25:
        return "Medium"
    return "Low"


@dataclass
class Project:
    """Names and fixed facts of one project; built once from its initial schedule."""

    key: str
    name: str
    source: str
    epics: list[dict]
    assignees: list[dict]
    original_jobs: set[int]
    max_original_task: int
    labels: dict = field(default_factory=dict)

    # ------------------------------------------------------------------ names
    def issue_key(self, task_id: int) -> str:
        return f"{self.key}-{task_id + 1}"

    def dev_name(self, dev_id: int) -> str:
        return self.labels.get("devs", {}).get(dev_id, f"Pengembang {dev_id + 1}")

    def dev_origin(self, dev_id: int) -> str:
        return f"M{dev_id + 1}"

    def is_unplanned(self, task: dict) -> bool:
        return task["id"] > self.max_original_task

    def epic_name(self, task: dict) -> str:
        if self.is_unplanned(task):
            return UNPLANNED_EPIC
        return self.labels.get("epics", {}).get(task["job"], f"Fitur {task['job'] + 1:02d}")

    def summary(self, task: dict) -> str:
        if self.is_unplanned(task):
            return f"{UNPLANNED_EPIC} #{task['id'] - self.max_original_task}"
        custom = self.labels.get("tasks", {}).get(task["id"])
        return custom or f"{self.epic_name(task)} / Tugas {task['op'] + 1}"


def build_project(*, key: str, name: str, initial: dict, source: str | None = None,
                  labels: dict | None = None) -> Project:
    """Epics and assignees from the initial schedule (tasks and developers)."""
    labels = labels or {}
    jobs = sorted({t["job"] for t in initial["tasks"]})
    epic_names = labels.get("epics", {})
    epics = [{"id": j, "key": f"{key}-E{j + 1}", "name": epic_names.get(j, f"Fitur {j + 1:02d}"),
              "color": k % 12} for k, j in enumerate(jobs)]
    project = Project(key=key, name=name, source=source or key, epics=epics, assignees=[],
                      original_jobs=set(jobs),
                      max_original_task=max(t["id"] for t in initial["tasks"]), labels=labels)
    project.assignees = [{"id": d["id"], "name": project.dev_name(d["id"]),
                          "short": "".join(w[0] for w in project.dev_name(d["id"]).split()[:2])
                          .upper() if d["id"] in labels.get("devs", {}) else f"P{d['id'] + 1}",
                          "origin": project.dev_origin(d["id"]), "capacity": d["capacity"]}
                         for d in initial["developers"]]
    return project


def issues_at(project: Project, tasks: list[dict], entries: dict, *,
              reopened: set[int] | None = None) -> list[dict]:
    """Every issue at one moment: task facts from ``tasks``, placement from ``entries``."""
    reopened = reopened or set()
    by_id = {t["id"]: t for t in tasks}
    waiting: dict[int, list[int]] = {}
    for t in tasks:
        e = entries.get(t["id"])
        if e is not None and t["status"] == "not_started":
            waiting.setdefault(e["dev"], []).append(t["id"])
    rank = {}
    for dev, ids in waiting.items():
        ids.sort(key=lambda i: (entries[i]["start"], i))
        rank.update({i: k + 1 for k, i in enumerate(ids)})
    blocks: dict[int, list[int]] = {}
    for t in tasks:
        for d in t["deps"]:
            blocks.setdefault(d, []).append(t["id"])

    out = []
    for t in sorted(tasks, key=lambda x: x["id"]):
        e = entries.get(t["id"])
        if e is None:
            continue
        dev = e["dev"]
        status = STATUS[t["status"]]
        if t["status"] == "not_started" and t["id"] in reopened:
            status = "Reopened"
        estimate = float(t["eligible"].get(dev, e["end"] - e["start"]))
        lateness = max(0.0, e["end"] - t["due"])
        unplanned = project.is_unplanned(t)
        out.append({
            "id": t["id"], "key": project.issue_key(t["id"]), "summary": project.summary(t),
            "epic": project.epic_name(t), "epic_id": None if unplanned else t["job"],
            "unplanned": unplanned, "status": status, "status_code": t["status"],
            "assignee": project.dev_name(dev), "assignee_id": dev,
            "estimate": estimate, "progress": float(t.get("progress", 0.0)),
            "remaining": estimate * (1.0 - float(t.get("progress", 0.0))),
            "start": e["start"], "end": e["end"], "due": t["due"],
            "late": e["end"] > t["due"] + 1e-9, "lateness": lateness if lateness > 1e-9 else 0.0,
            "rank": rank.get(t["id"]),
            "priority": priority_label(t["priority"]), "priority_value": t["priority"],
            "blocked_by": [project.issue_key(d) for d in t["deps"] if d in by_id],
            "blocks": [project.issue_key(b) for b in sorted(blocks.get(t["id"], []))],
            "origin": {"instance": project.source,
                       "job": None if unplanned else t["job"] + 1,
                       "operation": None if unplanned else t["op"] + 1,
                       "machine": project.dev_origin(dev),
                       "eligible": {project.dev_origin(d): float(x)
                                    for d, x in sorted(t["eligible"].items())}},
        })
    return out


def reopened_until(events: list[dict], k: int, phase: str = "aor") -> set[int]:
    """Tasks sent back by a failed review in the events up to event ``k``."""
    out: set[int] = set()
    last = k if phase in ("aor", "after") else k - 1
    for ev in events[: last + 1]:
        for d in ev["disruptions"]:
            if d["type"] == "rework_review_fail" and d["payload"].get("task_id") is not None:
                out.add(int(d["payload"]["task_id"]))
    return out


def _estimate(tasks_by_id, entries, task_id):
    t, e = tasks_by_id.get(task_id), entries.get(task_id)
    if t is None or e is None:
        return None
    return float(t["eligible"].get(e["dev"], e["end"] - e["start"]))


def _disruption_entries(project: Project, ev: dict) -> list[dict]:
    before = {t["id"]: t for t in ev["before"]["tasks"]}
    after = {t["id"]: t for t in ev["aor"]["tasks"]}
    created = iter(sorted(set(after) - set(before)))
    base = {"event": ev["index"], "phase": "aor", "t": ev["time"]}
    out = []
    for d in ev["disruptions"]:
        p, kind = d["payload"], d["type"]
        if kind == "urgent_task":
            tid = next(created, None)
            if tid is None:
                continue
            task = after[tid]
            est = _estimate(after, ev["aor"]["entries"], tid)
            out.append({**base, "kind": "created", "issue": project.issue_key(tid),
                        "assignee": None,
                        "text": f"Issue dibuat: pekerjaan tidak terencana, estimasi "
                                f"{angka(est if est is not None else p.get('effort', 0.0))} jam, "
                                f"prioritas {priority_label(task['priority'])}"})
        elif kind == "effort_revision":
            tid = p.get("task_id")
            old = _estimate(before, ev["before"]["entries"], tid)
            new = _estimate(after, ev["aor"]["entries"], tid)
            text = "Estimasi direvisi"
            if old is not None and new is not None:
                text += f": {angka(old)} jam → {angka(new)} jam"
            out.append({**base, "kind": "estimate", "issue": project.issue_key(tid),
                        "assignee": None, "text": text})
        elif kind == "rework_review_fail":
            tid = p.get("task_id")
            out.append({**base, "kind": "reopened", "issue": project.issue_key(tid),
                        "assignee": None,
                        "text": f"Dibuka lagi: review gagal, tambahan "
                                f"{angka(p.get('extra_effort', 0.0))} jam"})
        elif kind == "priority_change":
            tid = p.get("task_id")
            old, new = before.get(tid), after.get(tid)
            text = "Prioritas berubah"
            if old is not None and new is not None:
                text += f": {priority_label(old['priority'])} → {priority_label(new['priority'])}"
                if abs(new["due"] - old["due"]) > 1e-9:
                    text += f", tenggat jam ke-{angka(old['due'])} → jam ke-{angka(new['due'])}"
            out.append({**base, "kind": "priority", "issue": project.issue_key(tid),
                        "assignee": None, "text": text})
        elif kind == "developer_unavailable":
            dev = p.get("dev_id")
            name = project.dev_name(dev)
            out.append({**base, "kind": "unavailable", "issue": None, "assignee": name,
                        "text": f"{name} tidak tersedia mulai jam ke-{angka(d['time'])} selama "
                                f"{angka(p.get('duration', 0.0))} jam"})
    return out


def _change_entries(project: Project, ev: dict) -> list[dict]:
    base = {"event": ev["index"], "phase": "after", "t": ev["time"]}
    out = []
    for item in ev.get("change_items", []):
        key = project.issue_key(item["task"])
        if item["kind"] == "assignee":
            out.append({**base, "kind": "assignee", "issue": key,
                        "assignee": project.dev_name(item["to_dev"]),
                        "text": f"Assignee: {project.dev_name(item['from_dev'])} → "
                                f"{project.dev_name(item['to_dev'])}"})
        else:
            out.append({**base, "kind": "rank", "issue": key,
                        "assignee": project.dev_name(item["dev"]),
                        "text": f"Rank di antrean {project.dev_name(item['dev'])}: "
                                f"{item['from_pos']} → {item['to_pos']}"})
    return out


def history_until(project: Project, events: list[dict], k: int, phase: str) -> list[dict]:
    """History up to event ``k``: ``before`` (nothing of event k), ``aor`` (its disruptions),
    or ``after`` (its disruptions and its counted changes)."""
    out = []
    for ev in events[: k + 1]:
        i = ev["index"]
        if i == k and phase == "before":
            break
        out += _disruption_entries(project, ev)
        if i < k or phase == "after":
            out += _change_entries(project, ev)
    return out


def at_time_zero(snapshot: dict) -> list[dict]:
    """Task statuses of the initial schedule S0 at time 0.

    Same rule as ``dfjsp.env.task_status.advance_statuses`` at t = 0: a task that starts at 0
    is in progress, every other task has not started (nothing can be finished at t = 0).
    """
    entries = snapshot["entries"]
    out = []
    for t in snapshot["tasks"]:
        e = entries.get(t["id"])
        running = e is not None and e["start"] <= 0.0 < e["end"]
        out.append({**t, "status": "in_progress" if running else "not_started",
                    "progress": 0.0})
    return out
