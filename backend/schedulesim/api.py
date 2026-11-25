"""HTTP API of ScheduleSim (seam B5).

Every scheduling number in a response comes from ``arls_ppo`` (``cek_episode.run`` and the
locked models); this module only checks requests, starts runs and maps results to issues.
"""
from __future__ import annotations

import json
import math
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field

from . import ARLS_PPO, ROOT
from .catalog import GROUP_CUSTOM, TEST_KEYS, Entry, benchmark_key, thesis_entries
from .projection import (at_time_zero, build_project, history_until, issues_at,
                         reopened_until)
from .runner import RunLimit, Runner, _payload_hash, work
from .store import EXAMPLES, Store

GENERATED = ARLS_PPO / "latex" / "TemplateLatexLaporanTesis" / "chapters" / "chapter5" / "generated"
LAMBDAS = [0.1, 0.3, 1.0, 3.0, 10.0, 30.0]
CAPACITIES = [1.0, 1.5, 2.0]
INTENSITIES = [0.05, 0.15, 0.3]
VALIDATION_SEEDS = [5000, 5001]

#: Limits of the public site (``SCHEDULESIM_PUBLIC=1``).
PUBLIC_LIMITS = {"runs_per_client": 2, "pending": 12, "cache_bytes": 2 * 1024 ** 3,
                 "max_tasks": 60, "max_devs": 10, "max_projects": 200}


# ---------------------------------------------------------------------- helpers
def claim(measures: dict) -> str:
    """Claim sentence of ``docs/KUNCI_UJI.md`` section 7 from the 98.75% intervals.

    "lebih baik" only when both measures lie entirely below 0, "lebih buruk" only when both
    lie entirely above 0, otherwise "tidak ditemukan selisih yang tegas".
    """
    lows = [measures[m][1] for m in ("uk1", "uk2")]
    highs = [measures[m][2] for m in ("uk1", "uk2")]
    if all(h < 0 for h in highs):
        return "lebih baik"
    if all(lo > 0 for lo in lows):
        return "lebih buruk"
    return "tidak ditemukan selisih yang tegas"



def _finite(value):
    """JSON has no NaN or infinity; show them as null."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _finite(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_finite(v) for v in value]
    return value


class CleanJSON(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(_finite(content), ensure_ascii=False, separators=(",", ":"),
                          default=str).encode("utf-8")


class MethodSpec(BaseModel):
    method: str
    model_seed: int | str | None = 0


class ManualSpec(BaseModel):
    levels: dict[str, int] = Field(default_factory=dict)
    moves: dict[str, list[dict]] = Field(default_factory=dict)
    guard: bool = False


class RunRequest(BaseModel):
    project: str
    capacity: float = 1.5
    intensity: float = 0.15
    seed: int = 5000
    lam: float = 3.0
    methods: list[MethodSpec] = Field(default_factory=list)
    manual: ManualSpec | None = None


def _test_benchmark_keys() -> set[str]:
    from dfjsp.datasets import BENCHMARK_UJI

    return {benchmark_key(n) for n in BENCHMARK_UJI}


def _model_status() -> tuple[list[dict], bool]:
    from arls_ppo import models

    files = []
    for rel, digest in models.LOCKED_HASHES.items():
        actual = models._sha256(models.RUN_DIR / rel)
        files.append({"path": rel, "expected": digest, "actual": actual,
                      "ok": actual == digest})
    return files, all(f["ok"] for f in files)


def _submodule_commit() -> str | None:
    """Commit of the pinned arls-ppo checkout (``ARLS_PPO_COMMIT`` inside Docker)."""
    if os.environ.get("ARLS_PPO_COMMIT"):
        return os.environ["ARLS_PPO_COMMIT"][:12]
    try:
        # vendor/arls-ppo/.git is a file "gitdir: <path>" in a clone and in a worktree alike
        dot_git = ARLS_PPO / ".git"
        gitdir = dot_git
        if dot_git.is_file():
            gitdir = (ARLS_PPO / dot_git.read_text().split(":", 1)[1].strip()).resolve()
        head = (gitdir / "HEAD").read_text().strip()
        if head.startswith("ref:"):
            head = (gitdir / head.split(" ", 1)[1]).read_text().strip()
        return head[:12]
    except (OSError, IndexError):
        return None


# ---------------------------------------------------------------------- app
def _client(request: Request) -> str:
    """Visitor address: Cloudflare puts the real one in ``CF-Connecting-IP``."""
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client
                                                        else "?")


def _owner(request: Request) -> str | None:
    """Hash of the browser token that marks the maker of a user project."""
    import hashlib

    token = request.headers.get("x-owner-token", "")
    if len(token) < 16:
        return None
    return hashlib.sha256(token.encode()).hexdigest()


def create_app(data_dir: str | Path | None = None, workers: int | None = None,
               static_dir: str | Path | None = None, public: bool | None = None) -> FastAPI:
    data_dir = Path(data_dir or os.environ.get("SCHEDULESIM_DATA", ROOT / "data"))
    workers = workers or int(os.environ.get("SCHEDULESIM_WORKERS", "4"))
    if public is None:
        public = os.environ.get("SCHEDULESIM_PUBLIC", "") == "1"
    examples = {json.loads(f.read_text(encoding="utf-8"))["key"]
                for f in EXAMPLES.glob("*.json")}
    static_dir = Path(static_dir or os.environ.get("SCHEDULESIM_STATIC",
                                                   ROOT / "frontend" / "dist"))
    state: dict = {}

    @asynccontextmanager
    async def lifespan(app):
        state["store"] = Store(data_dir / "proyek.sqlite3")
        limits = PUBLIC_LIMITS if public else {}
        state["runner"] = Runner(data_dir / "cache", workers=workers,
                                 max_runs_per_client=limits.get("runs_per_client"),
                                 max_pending=limits.get("pending"),
                                 cache_bytes=limits.get("cache_bytes"))
        state["thesis"] = {e.key: e for e in thesis_entries()}
        state["test_keys"] = TEST_KEYS | _test_benchmark_keys()
        state["initial"] = {}
        yield
        state["runner"].close()

    app = FastAPI(title="ScheduleSim API", version="1.0.0", lifespan=lifespan,
                  default_response_class=CleanJSON)

    @app.exception_handler(PermissionError)
    async def _forbidden(request: Request, exc: PermissionError):
        return CleanJSON({"detail": str(exc)}, status_code=403)

    @app.exception_handler(ValueError)
    async def _invalid(request: Request, exc: ValueError):
        return CleanJSON({"detail": str(exc)}, status_code=422)

    @app.exception_handler(RunLimit)
    async def _busy(request: Request, exc: RunLimit):
        return CleanJSON({"detail": str(exc)}, status_code=429)

    # ---------------------------------------------------------------- projects
    def entry(key: str) -> tuple[Entry, Any]:
        key = key.upper()
        if key in state["test_keys"]:
            raise PermissionError(f"{key} adalah data uji tesis dan tidak dapat dibuka di "
                                  "simulator; hasil ujinya ada di halaman Hasil uji tesis.")
        if key in state["thesis"]:
            e = state["thesis"][key]
            return e, e.source
        spec = state["store"].get(key)
        if spec is None:
            raise HTTPException(404, f"proyek {key} tidak ditemukan")
        spec = {k: v for k, v in spec.items() if k != "_owner"}
        return Entry(key, spec.get("name", key), GROUP_CUSTOM, f"custom:{key}", True), spec

    def changeable(key: str, spec: dict, request: Request) -> bool:
        """Whether this visitor may edit the user project ``key``."""
        if not public:
            return True
        return key not in examples and spec.get("_owner") is not None \
            and spec.get("_owner") == _owner(request)

    def labels_of(source) -> dict:
        if isinstance(source, dict):
            from arls_ppo import custom

            return custom.labels(custom.parse(source))
        return {}

    def run_sync(payload: dict) -> dict:
        runner: Runner = state["runner"]
        h = _payload_hash(payload)
        cached = runner._load(h)
        if cached is None:
            cached = runner._pool.submit(work, payload).result()
            if "error" in cached:
                raise ValueError(cached["error"]["message"])
            runner._save(h, cached)
        return cached

    def initial_of(e: Entry, source, capacity: float) -> dict:
        key = (e.key, capacity, json.dumps(source, sort_keys=True) if isinstance(source, dict)
               else source)
        if key not in state["initial"]:
            trace = run_sync({"project": source, "capacity": capacity, "intensity": 0.05,
                              "seed": 5000, "method": "aor", "lam": 1.0})
            state["initial"][key] = trace["initial"]
        return state["initial"][key]

    def project_view(e: Entry, source, initial: dict):
        return build_project(key=e.key, name=e.name, initial=initial,
                             source=e.source if not e.editable else e.key,
                             labels=labels_of(source))

    @app.get("/api/meta")
    def meta():
        from arls_ppo.episode import (DISRUPTION_TYPES, FEATURE_NAMES, MANUAL_METHODS,
                                      METHODS)

        files, ok = _model_status()
        return {
            "methods": [{"code": c, "name": n, "learned": c.startswith(("ppo_", "il_")),
                         "guard": c.endswith("_g"),
                         "model_seeds": [0, 1, 2] if c.startswith("ppo_") else None}
                        for c, n in METHODS.items()],
            "manual_methods": [{"code": c, "name": n} for c, n in MANUAL_METHODS.items()],
            "lambdas": LAMBDAS, "labelled_lambdas": [0.3, 3.0, 30.0],
            "capacities": CAPACITIES, "intensities": INTENSITIES,
            "validation_seeds": VALIDATION_SEEDS,
            "test_seeds": [[10000, 10009], [11000, 11004]],
            "disruption_types": DISRUPTION_TYPES, "feature_names": list(FEATURE_NAMES),
            "models": files, "models_match_test_lock": ok,
            "arls_ppo_commit": _submodule_commit(), "public": bool(public),
            "limits": PUBLIC_LIMITS if public else None,
        }

    @app.get("/api/projects")
    def projects(request: Request):
        out = [{"key": e.key, "name": e.name, "group": e.group, "editable": False}
               for e in state["thesis"].values()]
        for key, spec in state["store"].all().items():
            n = sum(len(ep.get("issues", [])) for ep in spec.get("epics", []))
            out.append({"key": key, "name": spec.get("name", key), "group": GROUP_CUSTOM,
                        "editable": changeable(key, spec, request), "n_tasks": n,
                        "n_devs": len(spec.get("developers", []))})
        return out

    @app.get("/api/projects/{key}")
    def project(key: str, request: Request, capacity: float = 1.5):
        e, source = entry(key)
        initial = initial_of(e, source, capacity)
        p = project_view(e, source, initial)
        tasks = at_time_zero(initial)
        editable = e.editable and changeable(e.key, state["store"].get(e.key) or {}, request)
        return {"project": {"key": p.key, "name": p.name, "group": e.group, "source": p.source,
                            "editable": editable, "capacity": capacity},
                "epics": p.epics, "assignees": p.assignees,
                "issues": issues_at(p, tasks, initial["entries"]),
                "spec": source if isinstance(source, dict) else None}

    def _check_spec(spec: dict) -> str:
        from arls_ppo import custom

        if public:
            lim = PUBLIC_LIMITS
            n_tasks = sum(len(ep.get("issues", [])) for ep in spec.get("epics", []))
            if n_tasks > lim["max_tasks"]:
                raise ValueError(f"proyek di situs publik paling banyak {lim['max_tasks']} issue "
                                 f"(ada {n_tasks})")
            if len(spec.get("developers", [])) > lim["max_devs"]:
                raise ValueError(f"proyek di situs publik paling banyak {lim['max_devs']} "
                                 f"pengembang (ada {len(spec.get('developers', []))})")
        project = custom.parse(spec)
        custom.build_instance(project)
        return project.key

    def _may_change(key: str, request: Request) -> dict:
        """The stored project, if this visitor may change it (always, off the public site)."""
        spec = state["store"].get(key)
        if spec is None:
            raise HTTPException(404, f"proyek {key} tidak ditemukan atau tidak bisa diubah")
        if public:
            if key in examples:
                raise HTTPException(403, "proyek contoh hanya bisa dibaca di situs publik; "
                                         "buat proyek sendiri untuk mencoba mengubahnya")
            if spec.get("_owner") is None or spec.get("_owner") != _owner(request):
                raise HTTPException(403, "proyek ini dibuat pengunjung lain; hanya pembuatnya "
                                         "yang bisa mengubah atau menghapusnya")
        return spec

    @app.post("/api/projects", status_code=201)
    def create_project(spec: dict, request: Request):
        owner = _owner(request)
        if public and owner is None:
            raise HTTPException(403, "token pembuat tidak ada; muat ulang halaman lalu coba lagi")
        if public and len(state["store"].all()) >= PUBLIC_LIMITS["max_projects"]:
            raise HTTPException(429, "batas banyak proyek di situs publik sudah tercapai")
        key = _check_spec(spec)
        if key in state["thesis"] or key in state["test_keys"] or state["store"].get(key):
            raise HTTPException(409, f"key {key} sudah dipakai")
        state["store"].put(key, {**spec, "key": key, "_owner": owner})
        return {"key": key}

    @app.put("/api/projects/{key}")
    def update_project(key: str, spec: dict, request: Request):
        key = key.upper()
        old = _may_change(key, request)
        _check_spec({**spec, "key": key})
        state["store"].put(key, {**spec, "key": key, "_owner": old.get("_owner")})
        state["initial"] = {k: v for k, v in state["initial"].items() if k[0] != key}
        return {"key": key}

    @app.delete("/api/projects/{key}", status_code=204)
    def delete_project(key: str, request: Request):
        key = key.upper()
        _may_change(key, request)
        state["store"].delete(key)
        return Response(status_code=204)

    # ---------------------------------------------------------------- runs
    @app.post("/api/runs", status_code=202)
    def start_run(req: RunRequest, request: Request):
        from arls_ppo.episode import METHODS, TEST_SEEDS

        e, source = entry(req.project)
        if req.seed in TEST_SEEDS:
            raise PermissionError(f"seed {req.seed} adalah seed episode uji tesis; pakai seed "
                                  "lain, misalnya seed validasi 5000 atau 5001.")
        if not (req.capacity > 0 and req.intensity > 0 and req.lam > 0):
            raise ValueError("kapasitas, intensitas, dan λ harus lebih dari 0")
        base = {"project": source, "capacity": req.capacity, "intensity": req.intensity,
                "seed": req.seed, "lam": req.lam}
        jobs = []
        if req.manual is not None:
            m = req.manual
            jobs.append(("manual_g" if m.guard else "manual",
                         {**base, "manual": {"levels": m.levels, "moves": m.moves,
                                             "guard": m.guard}}))
        for spec in req.methods:
            if spec.method not in METHODS:
                raise ValueError(f"metode {spec.method!r} tidak dilaporkan di tesis")
            if spec.method.startswith("ppo_"):
                seeds = [0, 1, 2] if spec.model_seed == "all" else [int(spec.model_seed or 0)]
                if not set(seeds) <= {0, 1, 2}:
                    raise ValueError("seed model hanya 0, 1, atau 2")
                jobs += [(f"{spec.method}@{s}", {**base, "method": spec.method,
                                                  "model_seed": s}) for s in seeds]
            else:
                jobs.append((spec.method, {**base, "method": spec.method}))
        if not jobs:
            raise ValueError("pilih paling sedikit satu metode")
        context = {"key": e.key, "name": e.name, "group": e.group, "editable": e.editable,
                   "source": source, **{k: v for k, v in base.items() if k != "project"}}
        return {"run_id": state["runner"].submit(base, jobs, context, client=_client(request))}

    @app.get("/api/runs/{run_id}")
    def run_status(run_id: str):
        s = state["runner"].status(run_id)
        if s is None:
            raise HTTPException(404, "run tidak ditemukan")
        return s

    def traced(run_id: str, key: str):
        tr = state["runner"].trace(run_id, key)
        ctx = state["runner"].context(run_id)
        if tr is None or ctx is None:
            raise HTTPException(404, "hasil metode ini tidak ditemukan")
        e = Entry(ctx["key"], ctx["name"], ctx["group"],
                  ctx["source"] if not ctx["editable"] else f"custom:{ctx['key']}",
                  ctx["editable"])
        return tr, ctx, project_view(e, ctx["source"], tr["initial"])

    @app.get("/api/runs/{run_id}/{key}/events")
    def run_events(run_id: str, key: str):
        from arls_ppo.episode import DISRUPTION_TYPES

        tr, ctx, _ = traced(run_id, key)
        out, cum = [], 0
        for ev in tr["events"]:
            cum += ev["changes"]
            out.append({"index": ev["index"], "time": ev["time"],
                        "disruptions": [{"type": d["type"], "label": DISRUPTION_TYPES.get(
                            d["type"], d["type"]), "time": d["time"]} for d in ev["disruptions"]],
                        "levels": [s["used"] for s in ev["subs"]],
                        "outcomes": [s["outcome"] for s in ev["subs"]],
                        "changes": ev["changes"], "changes_total": cum,
                        "tard_before": ev["tard_before"], "tard_aor": ev["tard_aor"],
                        "tard_after": ev["tard_after"], "J_after_batch": ev["J_after_batch"]})
        return out

    @app.get("/api/runs/{run_id}/{key}/frames/{k}/{phase}")
    def run_frame(run_id: str, key: str, k: int, phase: str):
        from arls_ppo.episode import DISRUPTION_TYPES

        if phase not in ("before", "aor", "after"):
            raise HTTPException(422, "phase harus before, aor, atau after")
        tr, ctx, p = traced(run_id, key)
        events = tr["events"]
        if not 0 <= k < len(events):
            raise HTTPException(404, "kejadian tidak ada")
        ev = events[k]
        tasks = ev["before"]["tasks"] if phase == "before" else ev["aor"]["tasks"]
        entries = ev[phase]["entries"]
        ghost_from = {"before": None, "aor": "before", "after": "aor"}[phase]
        ghost = None
        if ghost_from:
            ghost = {p.issue_key(t): v for t, v in ev[ghost_from]["entries"].items()}
        event = {k2: v for k2, v in ev.items() if k2 not in ("before", "aor", "after")}
        event["disruptions"] = [{**d, "label": DISRUPTION_TYPES.get(d["type"], d["type"])}
                                for d in ev["disruptions"]]
        event["affected"] = [{"type": a["type"], "label": DISRUPTION_TYPES.get(a["type"]),
                              "issues": [p.issue_key(t) for t in a["tasks"]]}
                             for a in ev["affected"]]
        return {"t": ev[phase]["t"], "phase": phase, "event": event,
                "issues": issues_at(p, tasks, entries,
                                    reopened=reopened_until(events, k, phase)),
                "history": history_until(p, events, k, phase),
                "pauses": ev[phase]["pauses"], "ghost": ghost,
                "epics": p.epics, "assignees": p.assignees,
                "meta": {**tr["meta"], "lam": ctx["lam"]}}

    # ---------------------------------------------------------------- number log
    def _names(tr, ctx) -> dict:
        e = Entry(ctx["key"], ctx["name"], ctx["group"],
                  ctx["source"] if not ctx["editable"] else f"custom:{ctx['key']}",
                  ctx["editable"])
        p = project_view(e, ctx["source"], tr["initial"])
        return {"project": p.key, "devs": {str(a["id"]): a["name"] for a in p.assignees}}

    @app.get("/api/runs/{run_id}/{key}/log")
    def run_log(run_id: str, key: str):
        from arls_ppo.episode import DISRUPTION_TYPES

        tr, ctx, _ = traced(run_id, key)
        x = tr.get("explain") or {}
        events = []
        for ev in tr["events"]:
            events.append({"index": ev["index"], "time": ev["time"],
                           "disruptions": [d["type"] for d in ev["disruptions"]],
                           "levels": [s["used"] for s in ev["subs"]],
                           "outcomes": [s["outcome"] for s in ev["subs"]],
                           "tard_aor": ev["tard_aor"], "J_after_batch": ev["J_after_batch"],
                           "changes": ev["changes"]})
        meta = tr["meta"]
        dis = x.get("disruptions", {})
        return {"meta": {**meta, "lam": ctx["lam"]}, "names": _names(tr, ctx),
                "disruption_types": DISRUPTION_TYPES, "input": x.get("input"),
                "disruptions": dis, "events": events, "output": x.get("output"),
                "result": {k: v for k, v in tr["result"].items() if not k.startswith("ms")},
                "determinism": {
                    "episode_seed": meta["seed"], "disruption_seed": dis.get("seed"),
                    "rng": dis.get("generator"), "model_seed": meta.get("model_seed"),
                    "model_files": meta.get("model_files", []),
                    "arls_ppo_commit": _submodule_commit(),
                    "cache_key": _payload_hash(state["runner"].payload(run_id, key) or {}),
                    "not_deterministic": ["ms", "ms_keputusan", "ms_pemilih"]}}

    @app.get("/api/runs/{run_id}/{key}/log/{k}")
    def run_event_log(run_id: str, key: str, k: int):
        tr, ctx, _ = traced(run_id, key)
        if not 0 <= k < len(tr["events"]):
            raise HTTPException(404, "kejadian tidak ada")
        ev = tr["events"][k]
        x = ev.get("explain") or {}
        subs = []
        for s in ev["subs"]:
            sx = s.get("explain") or {}
            subs.append({"j": s["j"], "type": s["type"], "affected": s["affected"],
                         "requested": s["requested"], "used": s["used"],
                         "outcome": s["outcome"], "mask": s.get("mask"),
                         "J_before": s["J_before"], "J_after": s["J_after"],
                         "changes_before": s.get("changes_before"),
                         "changes_after": s["changes_after"],
                         "features": sx.get("features"), "selector": sx.get("selector"),
                         "levels": {str(lv): b for lv, b in (sx.get("levels") or {}).items()},
                         "decision": sx.get("decision")})
        return {"index": ev["index"], "time": ev["time"], "tard_before": ev["tard_before"],
                "tard_aor": ev["tard_aor"], "tard_after": ev["tard_after"],
                "J_after_batch": ev["J_after_batch"], "changes": ev["changes"],
                "disruptions": x.get("disruptions", []), "manual": x.get("manual"),
                "change_items": ev.get("change_items", []), "subs": subs,
                "lam": ctx["lam"], "names": _names(tr, ctx)}

    @app.post("/api/runs/{run_id}/{key}/ulang")
    def run_again(run_id: str, key: str, request: Request):
        out = state["runner"].rerun(run_id, key, client=_client(request))
        if out is None:
            raise HTTPException(404, "hasil metode ini tidak ditemukan")
        return out

    # ---------------------------------------------------------------- results
    @app.get("/api/results")
    def results():
        ringkas = json.loads((GENERATED / "bab5_uji_ringkas.json").read_text(encoding="utf-8"))
        extra = {}
        for name in ("bab5_uji_tingkat", "bab5_uji_kuartil", "bab5_uji_aor"):
            f = GENERATED / f"{name}.json"
            if f.exists():
                extra[name.removeprefix("bab5_uji_")] = json.loads(f.read_text(encoding="utf-8"))
        claims = {m: {lam: claim(v) for lam, v in per.items()} for m, per in ringkas["utama"].items()}
        return {"main": ringkas["utama"], "claims": claims, "combined": ringkas["gabungan"],
                "benchmark_only": ringkas["benchmark_saja"], "item1": ringkas["butir1"],
                "stability": ringkas["stabil"], "time": ringkas["waktu"],
                "violations": ringkas["pelanggaran"], **extra,
                "note": "Hasil uji dibaca dari berkas hasil tesis (arls-ppo, Bab V); data uji "
                        "tidak disimulasikan ulang."}

    # ---------------------------------------------------------------- frontend
    if static_dir.is_dir():
        @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
        def spa(path: str):
            target = static_dir / path
            if path and target.is_file():
                return FileResponse(target)
            return FileResponse(static_dir / "index.html")

    return app


app = create_app()
