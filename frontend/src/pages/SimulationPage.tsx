import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError, type ManualRequest, type MethodRequest } from "../api";
import { Ladder, Spinner } from "../components/atoms";
import type { ViewName } from "../components/ControlPanel";
import type { Move } from "../components/views/BoardView";
import Workspace from "../components/Workspace";
import { angka, lambdaLabel } from "../format";
import type { MethodSummary, Phase } from "../types";
import DecisionPanel from "./DecisionPanel";

type Mode = "compare" | "levels" | "drag";

const PHASES: { value: Phase; label: string }[] = [
  { value: "before", label: "Sebelum gangguan" },
  { value: "aor", label: "Sesudah AOR" },
  { value: "after", label: "Sesudah perbaikan" },
];

function MethodTable({ rows, current, onPick, lam }: { rows: MethodSummary[]; current: string | null;
                                                     onPick: (k: string) => void; lam: number }) {
  const best = Math.min(...rows.map((r) => r.J));
  return (
    <div className="table-wrap" style={{ marginTop: 12 }}>
      <table className="grid">
        <thead><tr>
          <th>Metode</th><th className="num" title="J episode = Tard/E akhir + λ·ΣU">J episode</th>
          <th className="num">Tard/E akhir</th><th className="num">Perubahan ΣU</th>
          <th className="num">Keputusan</th><th className="num" title="p95 waktu satu panggilan pemilih">p95 pemilih (ms)</th>
          <th className="num" title="Pelanggaran keras pemeriksa jadwal dfjsp.verify">Pelanggaran keras</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`row ${current === r.key ? "selected" : ""}`}
                onClick={() => r.model_seed !== "mean" && onPick(r.key)}
                style={{ cursor: r.model_seed === "mean" ? "default" : undefined }}>
              <td><strong>{r.name}</strong>{typeof r.model_seed === "number" && <span className="muted small"> · seed model {r.model_seed}</span>}</td>
              <td className="num" style={{ fontWeight: r.J === best ? 700 : 400 }}>{angka(r.J, 3)}</td>
              <td className="num">{angka(r.tard, 3)}</td>
              <td className="num">{angka(r.changes, r.model_seed === "mean" ? 1 : 0)}</td>
              <td className="num">{r.decisions}</td>
              <td className="num">{r.ms_selector_p95 === null ? "–" : angka(r.ms_selector_p95, 2)}</td>
              <td className="num">{r.hard_violations}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small" style={{ padding: "6px 10px" }}>
        J dihitung dengan λ = {lambdaLabel(lam)}. Semua angka berasal dari <span className="mono">cek_episode.run</span>,
        fungsi yang sama dengan pengujian tesis.
      </div>
    </div>
  );
}

export default function SimulationPage() {
  const [params, setParams] = useSearchParams();
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Infinity });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const [project, setProject] = useState(params.get("project") ?? "MK01");
  const [capacity, setCapacity] = useState(Number(params.get("cap") ?? 1.5));
  const [intensity, setIntensity] = useState(0.15);
  const [seed, setSeed] = useState(5000);
  const [lam, setLam] = useState(3);
  const [mode, setMode] = useState<Mode>("compare");
  const [guard, setGuard] = useState(false);
  const [methods, setMethods] = useState<string[]>(["ppo_bc_ppo_g", "fix3_g", "acak_g", "aor"]);
  const [modelSeed, setModelSeed] = useState<number | "all">(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [k, setK] = useState(0);
  const [phase, setPhase] = useState<Phase>("after");
  const [view, setView] = useState<ViewName>("gantt");
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Record<number, number>>({});
  const [moves, setMoves] = useState<Record<string, Move[]>>({});
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => { setParams({ project, cap: String(capacity) }, { replace: true }); }, [project, capacity, setParams]);

  const run = useQuery({
    queryKey: ["run", runId], queryFn: () => api.run(runId!), enabled: !!runId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 400 : false),
  });
  // the run on screen is the last one that finished; a refused move keeps the board as it was
  const [viewRun, setViewRun] = useState<string | null>(null);
  useEffect(() => { if (run.data?.status === "done") setViewRun(runId); }, [run.data?.status, runId]);
  const shown = useQuery({ queryKey: ["run", viewRun], queryFn: () => api.run(viewRun!),
                           enabled: !!viewRun, staleTime: Infinity });
  const done = !!viewRun && shown.data?.status === "done";
  const results = shown.data?.results ?? [];
  const manualKey = mode === "compare" ? null : guard ? "manual_g" : "manual";

  useEffect(() => {
    if (!done || results.length === 0) return;
    if (!current || !results.some((r) => r.key === current))
      setCurrent(manualKey && results.some((r) => r.key === manualKey) ? manualKey
        : results.find((r) => r.model_seed !== "mean")?.key ?? null);
  }, [done, results, current, manualKey]);

  const events = useQuery({ queryKey: ["events", viewRun, current], queryFn: () => api.events(viewRun!, current!),
                            enabled: done && !!current });
  const n = events.data?.length ?? 0;
  const frame = useQuery({ queryKey: ["frame", viewRun, current, k, phase],
                           queryFn: () => api.frame(viewRun!, current!, k, phase),
                           enabled: done && !!current && k < Math.max(n, 1), placeholderData: (p) => p });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setK((x) => { if (x + 1 >= n) { setPlaying(false); return x; } return x + 1; });
    }, 1300);
    return () => clearInterval(id);
  }, [playing, n]);
  useEffect(() => {
    strip.current?.querySelector(".ev.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [k]);
  useEffect(() => { setPending({}); }, [k, viewRun]);

  const start = async (extra?: { levels?: Record<string, number>; moves?: Record<string, Move[]> }) => {
    setStartError(null);
    const list: MethodRequest[] = mode === "compare"
      ? methods.map((m) => ({ method: m, model_seed: m.startsWith("ppo_") ? modelSeed : undefined }))
      : [{ method: "ppo_bc_ppo_g", model_seed: 0 }, { method: "aor" }];
    const manual: ManualRequest | undefined = mode === "compare" ? undefined
      : { levels: extra?.levels ?? levels, moves: extra?.moves ?? moves, guard };
    try {
      const r = await api.startRun({ project, capacity, intensity, seed, lam, methods: list, manual });
      setRunId(r.run_id);
      if (!extra) { setK(0); setCurrent(null); setPhase("after"); }
    } catch (e) {
      setStartError((e as ApiError).message);
    }
  };

  const reset = () => { setLevels({}); setMoves({}); setRunId(null); setViewRun(null); setCurrent(null); setK(0); };
  const applyLevels = () => {
    const next = { ...levels };
    for (const [j, lv] of Object.entries(pending)) next[`${k}:${j}`] = lv;
    setLevels(next);
    start({ levels: next });
  };
  const onMove = (m: Move) => {
    const next = { ...moves, [String(k)]: [...(moves[String(k)] ?? []), m] };
    setMoves(next);
    start({ moves: next });
  };

  // a refused card move: drop it and show why
  useEffect(() => {
    if (run.data?.status === "error" && mode === "drag" && moves[String(k)]?.length) {
      setMoves((ms) => ({ ...ms, [String(k)]: ms[String(k)].slice(0, -1) }));
    }
  }, [run.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const f = frame.data;
  const changed = useMemo(() => new Set(
    phase === "after" && f ? f.history.filter((h) => h.event === k && h.issue && (h.kind === "assignee" || h.kind === "rank"))
      .map((h) => h.issue!) : []), [f, k, phase]);
  const thesisMethods = meta.data?.methods ?? [];

  return (
    <div className="page--full sim">
      <div className="sim__setup">
        <label className="field"><span>Proyek</span>
          <select className="select" value={project} onChange={(e) => { setProject(e.target.value); reset(); }}>
            {["Proyek sendiri", "Brandimarte (latih)", "Benchmark (latih)", "Benchmark (validasi)"].map((g) => (
              <optgroup key={g} label={g}>
                {projects.data?.filter((p) => p.group === g).map((p) => <option key={p.key} value={p.key}>{p.key} · {p.name}</option>)}
              </optgroup>
            ))}
          </select></label>
        <label className="field"><span>Kapasitas</span>
          <select className="select" value={capacity} onChange={(e) => { setCapacity(Number(e.target.value)); reset(); }}>
            {(meta.data?.capacities ?? [1, 1.5, 2]).map((c) => <option key={c} value={c}>{angka(c)}</option>)}
          </select></label>
        <label className="field"><span>Intensitas gangguan</span>
          <select className="select" value={intensity} onChange={(e) => { setIntensity(Number(e.target.value)); reset(); }}>
            {(meta.data?.intensities ?? [0.05, 0.15, 0.3]).map((c) => <option key={c} value={c}>{angka(c, 2)}</option>)}
          </select></label>
        <label className="field"><span title="Seed validasi tesis 5000 dan 5001; seed uji 10000-10009 dan 11000-11004 ditolak">Seed episode</span>
          <input className="input mono" type="number" value={seed} style={{ width: 96 }}
                 onChange={(e) => { setSeed(Number(e.target.value)); reset(); }} /></label>
        <label className="field"><span>λ (harga satu perubahan)</span>
          <select className="select" value={lam} onChange={(e) => { setLam(Number(e.target.value)); reset(); }}>
            {(meta.data?.lambdas ?? [0.1, 0.3, 1, 3, 10, 30]).map((l) => (
              <option key={l} value={l}>{lambdaLabel(l)}{meta.data?.labelled_lambdas.includes(l) ? " (berlabel)" : ""}</option>))}
          </select></label>
        <label className="field"><span>Mode</span>
          <div className="segmented">
            {([["compare", "Bandingkan metode"], ["levels", "Manual: pilih tingkat"], ["drag", "Manual: geser kartu"]] as [Mode, string][]).map(([m, label]) => (
              <button key={m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); reset(); if (m === "drag") setView("board"); }}>{label}</button>
            ))}
          </div></label>
        {mode === "compare" ? (
          <div className="field"><span>Metode (nama sesuai naskah)</span>
            <div className="methods">
              {thesisMethods.map((m) => (
                <label key={m.code} className="check small">
                  <input type="checkbox" checked={methods.includes(m.code)}
                         onChange={() => setMethods((xs) => xs.includes(m.code) ? xs.filter((x) => x !== m.code) : [...xs, m.code])} />
                  {m.name}
                </label>
              ))}
              <label className="who small">seed model PPO
                <select className="select" value={String(modelSeed)} style={{ height: 26 }}
                        onChange={(e) => setModelSeed(e.target.value === "all" ? "all" : Number(e.target.value))}>
                  <option value="0">0</option><option value="1">1</option><option value="2">2</option>
                  <option value="all">0, 1, 2 dan rata-rata</option>
                </select></label>
            </div></div>
        ) : (
          <label className="check small" style={{ alignSelf: "center" }}>
            <input type="checkbox" checked={guard} onChange={(e) => { setGuard(e.target.checked); reset(); }} />
            Pakai penjaga (tolak pilihan yang menaikkan J)</label>
        )}
        <button className="btn btn--primary" onClick={() => start()} disabled={run.data?.status === "running"}>
          {run.data?.status === "running" ? <Spinner /> : <Play size={15} />}Jalankan</button>
        {mode !== "compare" && runId && <button className="btn btn--ghost" onClick={reset}><RotateCcw size={15} />Ulang</button>}
      </div>

      <div className="sim__strip">
        {!runId && <span className="muted">Atur episode lalu tekan Jalankan. Gangguan sama untuk semua metode pada seed yang sama.</span>}
        {run.data?.status === "running" && (
          <span className="who"><Spinner />Menjalankan {run.data.done}/{run.data.total} metode
            <span className="progress"><i style={{ width: `${(100 * run.data.done) / run.data.total}%` }} /></span></span>
        )}
        {startError && <span className="notice notice--warn" style={{ margin: 0 }}><Lock size={15} />{startError}</span>}
        {run.data?.status === "error" && run.data.error && (
          <span className="notice notice--error" style={{ margin: 0 }}>
            {run.data.error.rule ? `Ditolak (aturan ${run.data.error.rule}): ` : ""}{run.data.error.message}
          </span>
        )}
        {done && events.data && (
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => setK((x) => Math.max(0, x - 1))} disabled={k === 0} aria-label="Kejadian sebelumnya"><ChevronLeft size={16} /></button>
            <button className="btn btn--ghost btn--sm" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Jeda" : "Putar"}>
              {playing ? <Pause size={16} /> : <Play size={16} />}</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setK((x) => Math.min(n - 1, x + 1))} disabled={k >= n - 1} aria-label="Kejadian berikutnya"><ChevronRight size={16} /></button>
            <div className="events" ref={strip} role="listbox" aria-label="Kejadian">
              {events.data.map((e) => {
                const top = Math.max(0, ...e.levels.map((l) => l ?? 0));
                return (
                  <button key={e.index} role="option" aria-selected={e.index === k}
                          className={`ev ${e.index === k ? "on" : ""} ${e.changes > 0 ? "changed" : ""}`}
                          onClick={() => setK(e.index)}
                          title={`${e.disruptions.map((d) => d.label).join(", ")}; U = ${e.changes}`}>
                    <span className="ev__t">{angka(e.time)}</span>
                    <Ladder level={e.outcomes.every((o) => o === "aor") ? null : top} />
                    <span className="ev__n">{e.disruptions.length}g · U{e.changes}</span>
                  </button>
                );
              })}
            </div>
            <div className="segmented">
              {PHASES.map((p) => <button key={p.value} className={phase === p.value ? "on" : ""} onClick={() => setPhase(p.value)}>{p.label}</button>)}
            </div>
          </>
        )}
      </div>

      <div className="sim__body">
        <div className="sim__view">
          {!viewRun && (
            <div className="prose" style={{ maxWidth: 720 }}>
              <h2 className="page__title" style={{ marginBottom: 8 }}>Simulasi penjadwalan ulang</h2>
              <p>Satu episode memutar gangguan dari model TAWOS pada proyek terpilih. Pada setiap kejadian,
                gangguan diserap dulu oleh AOR, lalu metode memilih tingkat perbaikan untuk setiap gangguan:
                L0 pertahankan AOR, L1 resequence, L2 reassign, atau L3 partial rescheduling.</p>
              <p>Pilih <strong>Bandingkan metode</strong> untuk melihat delapan metode tesis pada gangguan yang sama,
                atau salah satu mode Manual untuk menjadi pemilihnya sendiri dan membandingkan J Anda dengan ARLS-PPO.</p>
              <p className="muted">Model yang dipakai adalah berkas yang sama dengan pengujian tesis (dicek dengan
                SHA-256 terhadap dokumen kunci uji). Data uji tesis tidak dapat disimulasikan.</p>
            </div>
          )}
          {done && f && (
            <>
              {mode === "drag" && phase !== "after" && (
                <div className="notice">Pindah ke fase "Sesudah perbaikan" untuk menggeser kartu pada kejadian ini.</div>
              )}
              {mode === "drag" && phase === "after" && current === manualKey && (
                <div className="notice">Geser kartu To Do ke pengembang lain atau ke posisi lain di antrean.
                  Setiap geseran diperiksa dengan aturan kelayakan tesis, lalu J dihitung ulang.</div>
              )}
              <Workspace issues={f.issues} assignees={f.assignees} epics={f.epics} history={f.history}
                         view={view} onView={setView} selected={selected} onSelect={setSelected}
                         pauses={f.pauses} ghost={f.ghost}
                         ghostLabel={phase === "after" ? "posisi sesudah AOR" : "posisi sebelum gangguan"}
                         t={f.t} event={f.event} changed={changed}
                         dragEnabled={mode === "drag" && phase === "after" && current === manualKey}
                         onMove={onMove} />
              <h2 className="section-title">Perbandingan metode pada episode ini</h2>
              <MethodTable rows={results} current={current} onPick={(key) => setCurrent(key)} lam={lam} />
            </>
          )}
        </div>
        {done && f && (
          <DecisionPanel frame={f} total={n} onOpenIssue={(key) => { setSelected(key); setView("form"); }}
                         manualLevels={mode === "levels" && current === manualKey ? {
                           pending, busy: run.data?.status !== "done",
                           onChoose: (j, lv) => setPending((p) => ({ ...p, [j]: lv })), onApply: applyLevels,
                         } : undefined} />
        )}
      </div>
      {meta.data && !meta.data.models_match_test_lock && (
        <div className="notice notice--error">Berkas model berbeda dari kunci uji; lihat <Link to="/metode">Tentang metode</Link>.</div>
      )}
    </div>
  );
}
