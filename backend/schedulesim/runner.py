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
import time
import uuid
from concurrent.futures import ProcessPoolExecutor
from multiprocessing import get_context
from pathlib import Path

import numpy as np


#: Version of what a cached trace holds; 2 = traces with the number log (arls-ppo v1.1.0).
TRACE_VERSION = 2


def _payload_hash(payload: dict) -> str:
    body = {**payload, "_trace_version": TRACE_VERSION}
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()[:24]


class RunLimit(RuntimeError):
    """The public site is busy for this visitor or for everyone (HTTP 429)."""


def compare(a, b, path="", out=None, counter=None):
    """Every number of two traces, except times in milliseconds; returns (count, differences)."""
    out = [] if out is None else out
    counter = [0] if counter is None else counter
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b), key=str):
            if str(k).startswith("ms"):
                continue
            if k not in a or k not in b:
                out.append(f"{path}/{k}: hanya ada di salah satu run")
                continue
            compare(a[k], b[k], f"{path}/{k}", out, counter)
    elif isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        if len(a) != len(b):
            out.append(f"{path}: panjang {len(a)} lawan {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            compare(x, y, f"{path}/{i}", out, counter)
    else:
        if isinstance(a, (int, float)) and not isinstance(a, bool):
            counter[0] += 1
        if a != b and not (a != a and b != b):          # NaN equals NaN here
            out.append(f"{path}: {a!r} lawan {b!r}")
    return counter[0], out


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
                            moves=m.get("moves"), guard=bool(m.get("guard")), options=True,
                            explain=True)
        else:
            tr = episode.trace_episode(*args, payload["method"], payload["lam"],
                                       model_seed=payload.get("model_seed") or 0, options=True,
                                       explain=True)
    except manual.MoveRejected as exc:
        return {"error": {"message": str(exc), "rule": exc.rule, "task": exc.task,
                          "dev": exc.dev}}
    return {"result": tr.result, "events": tr.events, "initial": tr.initial, "meta": tr.meta,
            "explain": tr.explain}


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
    """Worker pool, run records, disk cache, and (on the public site) limits.

    Parameters
    ----------
    cache_dir : Path
        Folder of the cached traces.
    workers : int
        Worker processes.
    max_runs_per_client : int or None
        Runs one visitor may have running at once; None = no limit.
    max_pending : int or None
        Episodes waiting or running for everyone together; None = no limit.
    cache_bytes : int or None
        Size of the cache folder; the least recently used traces are removed beyond it.
    """

    def __init__(self, cache_dir: Path, workers: int = 4, *, max_runs_per_client=None,
                 max_pending=None, cache_bytes=None):
        self.cache_dir = cache_dir
        cache_dir.mkdir(parents=True, exist_ok=True)
        self._pool = ProcessPoolExecutor(max_workers=workers, mp_context=get_context("forkserver"))
        self._runs: dict[str, dict] = {}
        self._lock = threading.Lock()
        self.max_runs_per_client = max_runs_per_client
        self.max_pending = max_pending
        self.cache_bytes = cache_bytes
        self._pending = 0

    def close(self):
        procs = list(getattr(self._pool, "_processes", {}).values())
        self._pool.shutdown(wait=False, cancel_futures=True)
        for p in procs:                 # a long Sequential Lookahead must not outlive the server
            p.terminate()

    def _admit(self, client, n_new):
        """Refuse a run when the visitor or the server is busy (public site only)."""
        if self.max_runs_per_client is not None and client is not None:
            mine = sum(1 for r in self._runs.values()
                       if r["status"] == "running" and r.get("client") == client)
            if mine >= self.max_runs_per_client:
                raise RunLimit(f"Anda masih punya {mine} simulasi yang berjalan. Tunggu sampai "
                               "selesai, lalu coba lagi.")
        if self.max_pending is not None and n_new and self._pending + n_new > self.max_pending:
            raise RunLimit("Server sedang menjalankan banyak simulasi dari pengunjung lain. "
                           "Coba lagi sebentar lagi; hasil yang sudah pernah dihitung tetap "
                           "langsung tampil.")

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
        self._trim()

    def _trim(self) -> None:
        """Keep the cache under ``cache_bytes`` by removing the least recently used traces."""
        if self.cache_bytes is None:
            return
        files = sorted(self.cache_dir.glob("*.pkl.gz"), key=lambda p: p.stat().st_atime)
        total = sum(p.stat().st_size for p in files)
        for p in files:
            if total <= self.cache_bytes:
                break
            total -= p.stat().st_size
            p.unlink(missing_ok=True)

    # ------------------------------------------------------------------ runs
    def submit(self, base: dict, jobs: list[tuple[str, dict]], context: dict,
               client: str | None = None) -> str:
        """Start one run with several method jobs ``[(key, payload), ...]``.

        Raises :class:`RunLimit` when the visitor ``client`` or the server is busy.
        """
        run_id = uuid.uuid4().hex[:12]
        run = {"run_id": run_id, "status": "running", "done": 0, "total": len(jobs),
               "context": context, "traces": {}, "results": [], "error": None,
               "keys": [k for k, _ in jobs], "payloads": dict(jobs), "client": client}
        hashed = [(key, payload, _payload_hash(payload)) for key, payload in jobs]
        fresh = [x for x in hashed if not self._cache_path(x[2]).exists()]
        with self._lock:
            self._admit(client, len(fresh))
            self._runs[run_id] = run
            self._pending += len(fresh)
        for key, payload, h in hashed:
            cached = self._load(h)
            if cached is not None:
                if (key, payload, h) in fresh:      # written meanwhile by another run
                    with self._lock:
                        self._pending -= 1
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
        with self._lock:
            self._pending -= 1
        self._finish(run, key, trace, h, save="error" not in trace)

    def rerun(self, run_id: str, key: str, client: str | None = None) -> dict | None:
        """Run one method of a finished run again without the cache and compare every number."""
        with self._lock:
            run = self._runs.get(run_id)
            if run is None or key not in run["traces"]:
                return None
            payload, old = run["payloads"][key], run["traces"][key]
            self._admit(client, 1)
            self._pending += 1
        try:
            t0 = time.perf_counter()
            new = self._pool.submit(work, payload).result()
            seconds = time.perf_counter() - t0
        finally:
            with self._lock:
                self._pending -= 1
        if "error" in new:
            return {"same": False, "compared": 0, "differences": [new["error"]["message"]],
                    "seconds": seconds}
        n, diffs = compare(old, new)
        return {"same": not diffs, "compared": n, "differences": diffs[:50],
                "n_differences": len(diffs), "seconds": seconds}

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
            return {k: v for k, v in run.items()
                    if k not in ("traces", "keys", "payloads", "client")}

    def trace(self, run_id: str, key: str) -> dict | None:
        with self._lock:
            run = self._runs.get(run_id)
            return None if run is None else run["traces"].get(key)

    def payload(self, run_id: str, key: str) -> dict | None:
        with self._lock:
            run = self._runs.get(run_id)
            return None if run is None else run["payloads"].get(key)

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
