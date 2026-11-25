"""Master data of a project: every task back to the place it was written down.

A thesis instance comes from a raw benchmark file. In ``data/raw/MK01.json``, ``jobs[j][o]`` is
the list of machines that can do operation ``o`` of job ``j``, each with a processing time. The
loader of the thesis (``instans_acak.load_any``, the same one the episodes use) turns that file
into a software project: a job becomes an epic, an operation a task, a machine a developer, and
a processing time the effort of that developer on that task. Benchmark files outside the
training range of efforts are first multiplied by one scale factor.

A user project comes from the issues typed into its spec instead (``epics[e].issues[i]``).

Task ids count the operations in file order from 0. Unplanned tasks created during an episode
get the next ids (55, 56, ... for MK01); they are not in the master data.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from . import ARLS_PPO

GITHUB = "https://github.com/stephenprasetyachrismawan/arls-ppo/blob"


def _deps(task, by_id) -> list[dict]:
    out = []
    for d in sorted(task.deps):
        other = by_id[d]
        same_job = other.job_id == task.job_id and other.op_index == task.op_index - 1
        out.append({"id": int(d), "kind": "job" if same_job else "lintas"})
    return out


def _raw_file(name: str) -> Path:
    from dfjsp.datasets._brandimarte import _PROJECT_ROOT

    raw = Path(_PROJECT_ROOT) / "data" / "raw"
    return raw / "benchmark" / f"{name}.json" if "/" in name else raw / f"{name}.json"


def master_of(source, commit: str | None = None) -> dict:
    """Master data of ``source``: an instance name of the thesis, or the spec of a user project."""
    if isinstance(source, dict):
        from arls_ppo import custom

        inst = custom.build_instance(custom.parse(source))
        written = [(f"epics[{e}].issues[{i}]", issue)
                   for e, epic in enumerate(source.get("epics", []))
                   for i, issue in enumerate(epic.get("issues", []))]
        src = {"kind": "custom", "path": None, "sha256": None, "url": None, "scale": 1.0,
               "machines": len(source.get("developers", [])),
               "n_jobs": len(source.get("epics", []))}
    else:
        import instans_acak

        inst = instans_acak.load_any(source)
        path = _raw_file(source)
        obj = json.loads(path.read_text(encoding="utf-8"))
        written = [(f"jobs[{j}][{o}]", options)
                   for j, job in enumerate(obj["jobs"]) for o, options in enumerate(job)]
        rel = path.resolve().relative_to(ARLS_PPO.resolve()).as_posix()
        src = {"kind": "file", "path": rel,
               "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
               "url": f"{GITHUB}/{commit}/{rel}" if commit else None,
               "scale": float(inst.meta.get("skala_upaya", 1.0)),
               "machines": int(obj["machines"]), "n_jobs": len(obj["jobs"])}
    tasks = sorted(inst.tasks, key=lambda t: t.task_id)
    if len(tasks) != len(written):
        raise RuntimeError(f"{len(tasks)} tugas, tetapi {len(written)} baris sumber")
    by_id = {t.task_id: t for t in tasks}
    rows = []
    for t, (pointer, raw) in zip(tasks, written):
        rows.append({"id": int(t.task_id), "job": int(t.job_id), "op": int(t.op_index),
                     "pointer": pointer, "raw": raw,
                     "eligible": {str(k): float(v) for k, v in sorted(t.eligible_devs.items())},
                     "deps": _deps(t, by_id)})
    devs = [{"id": int(d.dev_id), "machine": int(d.dev_id),
             "n_tasks": sum(1 for t in tasks if d.dev_id in t.eligible_devs)}
            for d in inst.developers]
    meta = {k: v for k, v in inst.meta.items() if isinstance(v, (int, float, str, bool))}
    return {"source": src, "tasks": rows, "developers": devs, "transform": meta}
