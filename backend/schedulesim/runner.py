"""Runs episodes in worker processes and keeps their traces.

Each worker calls ``arls_ppo`` (``trace_episode`` or ``manual.run``), the same code that
produced the thesis numbers. ``cek_episode`` keeps loaded models in module globals, so every
episode runs in a worker process and the web server process never runs one itself.
Traces are cached on disk by a hash of the request, so a repeated request is instant.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import pickle
import threading
import uuid
from concurrent.futures import ProcessPoolExecutor
from multiprocessing import get_context
from pathlib import Path

import numpy as np


def _payload_hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:24]


def work(payload: dict) -> dict:
    """Worker: one traced episode as a plain dict, or an ``error`` for a refused move."""
    import os

    os.environ.setdefault("OMP_NUM_THREADS", "1")
    from arls_ppo import custom, episode, manual

    project = payload["project"]
    instance = custom.parse(project) if isinstance(project, dict) else project
    args = (instance, payload["capacity"], payload["intensity"], payload["seed"])
    try:
        if payload.get("manual") is not None:
            m = payload["manual"]
            tr = manual.run(*args, payload["lam"], levels=m.get("levels"),
                            moves=m.get("moves"), guard=bool(m.get("guard")), options=True)
        else:
            tr = episode.trace_episode(*args, payload["method"], payload["lam"],
                                       model_seed=payload.get("model_seed") or 0, options=True)
    except manual.MoveRejected as exc:
        return {"error": {"message": str(exc), "rule": exc.rule, "task": exc.task,
                          "dev": exc.dev}}
    return {"result": tr.result, "events": tr.events, "initial": tr.initial, "meta": tr.meta}


def summary(key: str, trace: dict) -> dict:
    """Numbers shown for one method; all of them come from ``cek_episode.run``."""
    r, meta = trace["result"], trace["meta"]
    selector = r.get("ms_pemilih") or []
    hard = sum(n for k, n in (r.get("periksa") or {}).get("hitung", {}).items()
               if k.endswith(":keras"))
    return {"key": key, "method": meta["method"], "name": meta["method_name"],
            "model_seed": meta["model_seed"], "J": r["J"], "tard": r["telat"],
            "changes": r["ubah"], "decisions": r["keputusan"],
            "ms_selector_p95": float(np.percentile(selector, 95)) if selector else None,
            "ms_decision_mean": r["ms"], "levels": r.get("tingkat"),
            "hard_violations": hard}


class Runner:
    def __init__(self, cache_dir: Path, workers: int = 4):
        self.cache_dir = cache_dir
        cache_dir.mkdir(parents=True, exist_ok=True)
        self._pool = ProcessPoolExecutor(max_workers=workers, mp_context=get_context("forkserver"))
        self._runs: dict[str, dict] = {}
        self._lock = threading.Lock()

    def close(self):
        self._pool.shutdown(wait=False, cancel_futures=True)

    # ------------------------------------------------------------------ cache
    def _cache_path(self, h: str) -> Path:
        return self.cache_dir / f"{h}.pkl.gz"

    def _load(self, h: str):
        p = self._cache_path(h)
        if p.exists():
            with gzip.open(p, "rb") as f:
                return pickle.load(f)
        return None

    def _save(self, h: str, trace: dict) -> None:
        tmp = self._cache_path(h).with_suffix(".tmp")
        with gzip.open(tmp, "wb", compresslevel=3) as f:
            pickle.dump(trace, f)
        tmp.replace(self._cache_path(h))

    # ------------------------------------------------------------------ runs
    def submit(self, base: dict, jobs: list[tuple[str, dict]], context: dict) -> str:
        """Start one run with several method jobs ``[(key, payload), ...]``."""
        run_id = uuid.uuid4().hex[:12]
        run = {"run_id": run_id, "status": "running", "done": 0, "total": len(jobs),
               "context": context, "traces": {}, "results": [], "error": None,
               "keys": [k for k, _ in jobs]}
        with self._lock:
            self._runs[run_id] = run
        for key, payload in jobs:
            h = _payload_hash(payload)
            cached = self._load(h)
            if cached is not None:
                self._finish(run, key, cached, h, save=False)
                continue
            fut = self._pool.submit(work, payload)
            fut.add_done_callback(lambda f, key=key, h=h: self._finish_future(run, key, h, f))
        return run_id

    def _finish_future(self, run, key, h, fut):
        try:
            trace = fut.result()
        except Exception as exc:  # noqa: BLE001  (shown to the user as the run error)
            trace = {"error": {"message": f"{type(exc).__name__}: {exc}", "rule": None}}
        self._finish(run, key, trace, h, save="error" not in trace)

    def _finish(self, run, key, trace, h, save):
        if save:
            self._save(h, trace)
        with self._lock:
            run["done"] += 1
            if "error" in trace:
                run["error"] = trace["error"]
            else:
                run["traces"][key] = trace
            if run["done"] == run["total"]:
                run["status"] = "error" if run["error"] else "done"
                order = {k: i for i, k in enumerate(run["keys"])}
                run["results"] = sorted((summary(k, t) for k, t in run["traces"].items()),
                                        key=lambda s: order[s["key"]])
                run["results"] += _seed_means(run["results"])

    def status(self, run_id: str) -> dict | None:
        with self._lock:
            run = self._runs.get(run_id)
            if run is None:
                return None
            return {k: v for k, v in run.items() if k not in ("traces", "keys")}

    def trace(self, run_id: str, key: str) -> dict | None:
        with self._lock:
            run = self._runs.get(run_id)
            return None if run is None else run["traces"].get(key)

    def context(self, run_id: str) -> dict | None:
        with self._lock:
            run = self._runs.get(run_id)
            return None if run is None else run["context"]


def _seed_means(results: list[dict]) -> list[dict]:
    """Mean over the three PPO model seeds, as the thesis reports ARLS-PPO."""
    out = []
    by_method: dict[str, list[dict]] = {}
    for r in results:
        if r["model_seed"] is not None:
            by_method.setdefault(r["method"], []).append(r)
    for method, rows in by_method.items():
        if sorted(r["model_seed"] for r in rows) == [0, 1, 2]:
            out.append({"key": f"{method}@mean", "method": method,
                        "name": f"{rows[0]['name']} (rata-rata 3 seed)", "model_seed": "mean",
                        "J": float(np.mean([r["J"] for r in rows])),
                        "tard": float(np.mean([r["tard"] for r in rows])),
                        "changes": float(np.mean([r["changes"] for r in rows])),
                        "decisions": rows[0]["decisions"], "ms_selector_p95": None,
                        "ms_decision_mean": None, "levels": None,
                        "hard_violations": sum(r["hard_violations"] for r in rows)})
    return out
