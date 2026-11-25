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
import { Info, Tour, type TourStep } from "../learn/Learn";
import DecisionPanel from "./DecisionPanel";
import NumberLog from "./NumberLog";
import Scene, { methodLabel } from "./Scene";

export const SIM_TOUR: TourStep[] = [
  { target: "setup", title: "1. Atur episode",
    body: "Pilih proyek, kapasitas, intensitas, seed, dan λ. Seed yang sama memberi urutan gangguan yang sama untuk semua metode, jadi metode dibandingkan pada soal yang sama." },
  { target: "run", title: "2. Jalankan",
    body: "Backend menjalankan cek_episode.run, fungsi yang sama dengan pengujian tesis, dengan berkas model yang hash-nya sama dengan kunci uji." },
  { target: "strip", title: "3. Strip kejadian",
    body: "Satu kotak = satu kejadian: jam keputusan, tangga tingkat tertinggi yang dipakai (L0-L3), banyak gangguan (g), dan banyak perubahan (U). Klik untuk pindah kejadian." },
  { target: "methods-switch", title: "4. Jadwal menurut metode",
    body: "Pilih metode untuk melihat jadwal yang dihasilkannya pada kejadian ini. Setiap tombol menunjukkan tingkat yang dipakai metode itu (tangga), banyak perubahan U, dan keterlambatan sesudahnya. Gangguannya sama untuk semua metode; mulai kejadian kedua, jadwal tiap metode bisa berbeda karena keputusan sebelumnya." },
  { target: "phases", title: "5. Tiga langkah dalam satu kejadian",
    body: "① Jadwal sebelum gangguan → ② gangguan dimasukkan dan tugas yang terkena digeser seperlunya, belum diperbaiki (di naskah: tingkat 0 atau AOR) → ③ jadwal sesudah metode memilih perbaikan. Keterangan di bawah tombol menjelaskan langkah yang sedang tampil." },
  { target: "view", title: "6. Papan proyek",
    body: "List, Board, Form, dan Timeline untuk fase yang dipilih. Di Timeline, bayangan abu-abu menunjukkan posisi pada fase sebelumnya, jadi perubahan terlihat." },
  { target: "side", title: "7. Keputusan",
    body: "Ringkasan kejadian ini: gangguan, affected set A_j, peluang setiap tingkat, J setiap tingkat, putusan guard, dan perubahan yang dihitung." },
  { target: "log-tab", title: "8. Log hitung",
    body: "Uraian angka dari Input (S0, tenggat, E, seed gangguan) lewat Proses (langkah ① sampai ⑩ per sub-keputusan) sampai Output (J episode). Setiap angka dicek sama dengan angka kode penelitian." },
  { target: "determinism", title: "9. Deterministik",
    body: "Seed dan hash model menentukan semua angka. Tombol Jalankan ulang menghitung episode yang sama tanpa cache lalu membandingkan semua angkanya; hanya waktu (ms) yang boleh berbeda." },
  { target: "compare", title: "10. Perbandingan seluruh episode",
    body: "J episode, keterlambatan akhir, banyak perubahan, dan waktu selector untuk semua metode pada gangguan yang sama, dihitung sampai akhir episode. Klik baris untuk menampilkan jadwal metode itu." },
];

type Mode = "compare" | "levels" | "drag";


function MethodTable({ rows, current, onPick, lam }: { rows: MethodSummary[]; current: string | null;
                                                     onPick: (k: string) => void; lam: number }) {
  const best = Math.min(...rows.map((r) => r.J));
  return (
    <div className="table-wrap" style={{ marginTop: 12 }} data-tour="compare">
      <table className="grid">
        <thead><tr>
          <th>Metode <Info term="methods" /></th><th className="num" title="J episode = Tard/E akhir + λ·ΣU">J episode <Info term="J" /></th>
          <th className="num">Tard/E akhir</th><th className="num">Perubahan ΣU</th>
          <th className="num">Keputusan</th><th className="num" title="p95 waktu satu panggilan selector">p95 selector (ms) <Info term="p95" /></th>
          <th className="num" title="Pelanggaran keras pemeriksa jadwal dfjsp.verify">Pelanggaran keras <Info term="hard" /></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`row ${current === r.key ? "selected" : ""}`}
                onClick={() => r.model_seed !== "mean" && onPick(r.key)}
                style={{ cursor: r.model_seed === "mean" ? "default" : undefined }}>
              <td><strong>{methodLabel(r)}</strong>{typeof r.model_seed === "number" && <span className="muted small"> · seed model {r.model_seed}</span>}</td>
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
  const [side, setSide] = useState<"decision" | "log">("decision");
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

  // Playback goes step by step: (1) before, (2) disruptions entered, (3) after the repair, then
  // the next event. The speed is the time each step stays on screen.
  const [speed, setSpeed] = useState(3000);
  const pos = useRef({ k, phase });
  pos.current = { k, phase };
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const { k: kk, phase: ph } = pos.current;
      if (ph === "before") setPhase("aor");
      else if (ph === "aor") setPhase("after");
      else if (kk + 1 < n) { setK(kk + 1); setPhase("before"); }
      else setPlaying(false);
    }, speed);
    return () => clearInterval(id);
  }, [playing, n, speed]);
  const togglePlay = () => {
    if (!playing && k >= n - 1 && phase === "after") { setK(0); setPhase("before"); }
    else if (!playing && phase === "after") { setPhase("before"); }
    setPlaying((x) => !x);
  };
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
  // what to look at in the step on screen: the affected tasks in step 2, the changed tasks in step 3
  const affectedKeys = useMemo(() => f ? [...new Set(f.event.affected.flatMap((a) => a.issues))] : [], [f]);
  const marked = useMemo(() => (phase === "aor" ? new Set(affectedKeys) : changed), [phase, affectedKeys, changed]);
  const thesisMethods = meta.data?.methods ?? [];

  return (
    <div className="page--full sim">
      <Tour name="simulasi" steps={SIM_TOUR} />
      <div className="sim__setup" data-tour="setup">
        <label className="field"><span>Proyek <Info term="instance" /></span>
          <select className="select" value={project} onChange={(e) => { setProject(e.target.value); reset(); }}>
            {["Proyek sendiri", "Brandimarte (latih)", "Benchmark (latih)", "Benchmark (validasi)"].map((g) => (
              <optgroup key={g} label={g}>
                {projects.data?.filter((p) => p.group === g).map((p) => <option key={p.key} value={p.key}>{p.key} · {p.name}</option>)}
              </optgroup>
            ))}
          </select></label>
        <label className="field"><span>Kapasitas <Info term="capacity" /></span>
          <select className="select" value={capacity} onChange={(e) => { setCapacity(Number(e.target.value)); reset(); }}>
            {(meta.data?.capacities ?? [1, 1.5, 2]).map((c) => <option key={c} value={c}>{angka(c)}</option>)}
          </select></label>
        <label className="field"><span>Intensitas gangguan <Info term="intensity" /></span>
          <select className="select" value={intensity} onChange={(e) => { setIntensity(Number(e.target.value)); reset(); }}>
            {(meta.data?.intensities ?? [0.05, 0.15, 0.3]).map((c) => <option key={c} value={c}>{angka(c, 2)}</option>)}
          </select></label>
        <label className="field"><span title="Seed validasi tesis 5000 dan 5001; seed uji 10000-10009 dan 11000-11004 ditolak">Seed episode <Info term="seed" /></span>
          <input className="input mono" type="number" value={seed} style={{ width: 96 }}
                 onChange={(e) => { setSeed(Number(e.target.value)); reset(); }} /></label>
        <label className="field"><span>λ (change penalty) <Info term="lambda" /></span>
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
            Pakai guard (tolak pilihan yang menaikkan J) <Info term="guard" /></label>
        )}
        <button className="btn btn--primary" onClick={() => start()} disabled={run.data?.status === "running"} data-tour="run">
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
            <button className="btn btn--ghost btn--sm" onClick={togglePlay} aria-label={playing ? "Jeda" : "Putar langkah demi langkah"}
                    title="Putar langkah demi langkah: ① → ② → ③ untuk setiap kejadian">
              {playing ? <Pause size={16} /> : <Play size={16} />}</button>
            <select className="select select--sm" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                    aria-label="Kecepatan putar" title="Lama setiap langkah tampil">
              <option value={6000}>sangat pelan</option><option value={3000}>pelan</option>
              <option value={1500}>sedang</option><option value={700}>cepat</option>
            </select>
            <button className="btn btn--ghost btn--sm" onClick={() => setK((x) => Math.min(n - 1, x + 1))} disabled={k >= n - 1} aria-label="Kejadian berikutnya"><ChevronRight size={16} /></button>
            <span className="strip__label">Kejadian<br /><span>tangga = tingkat {results.find((r) => r.key === current)?.name ?? ""}</span></span>
            <Info term="event" />
            <div className="events" ref={strip} role="listbox" aria-label="Kejadian" data-tour="strip">
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
          </>
        )}
      </div>

      <div className={`sim__body ${done && f && side === "log" ? "sim__body--wide" : ""}`}>
        <div className="sim__view" data-tour="view">
          {!viewRun && (
            <div className="prose" style={{ maxWidth: 720 }}>
              <h2 className="page__title" style={{ marginBottom: 8 }}>Simulasi penjadwalan ulang</h2>
              <p>Satu episode memutar gangguan dari model TAWOS pada proyek terpilih. Setiap kejadian punya tiga langkah:
                ① jadwal sebelum gangguan; ② gangguan dimasukkan dan tugas yang terkena digeser seperlunya, belum
                diperbaiki; ③ metode memilih tingkat perbaikan untuk setiap gangguan: L0 biarkan seperti langkah ②,
                L1 resequence, L2 reassign, atau L3 partial rescheduling.</p>
              <p>Pilih <strong>Bandingkan metode</strong> untuk melihat delapan metode tesis pada gangguan yang sama,
                atau salah satu mode Manual untuk menjadi selector-nya sendiri dan membandingkan J Anda dengan ARLS-PPO.</p>
              <p>Tab <strong>Log hitung</strong> di panel kanan menguraikan setiap angka, dari input sampai output. Nyalakan
                {" "}<strong>Mode belajar</strong> di bilah atas untuk penjelasan istilah (ⓘ) dan tur halaman ini.</p>
              <p className="muted">Model yang dipakai adalah berkas yang sama dengan pengujian tesis (dicek dengan
                SHA-256 terhadap dokumen kunci uji). Data uji tesis tidak dapat disimulasikan.</p>
            </div>
          )}
          {done && f && (
            <>
              <Scene runId={viewRun!} results={results} current={current!} onPick={setCurrent} k={k} total={n}
                     phase={phase} onPhase={(ph) => { setPlaying(false); setPhase(ph); }} event={f.event}
                     focus={[...marked]} playing={playing} />
              {mode === "drag" && phase !== "after" && (
                <div className="notice">Pindah ke langkah ③ "Sesudah perbaikan" untuk menggeser kartu pada kejadian ini.</div>
              )}
              {mode === "drag" && phase === "after" && current === manualKey && (
                <div className="notice">Geser kartu To Do ke pengembang lain atau ke posisi lain di antrean.
                  Setiap geseran diperiksa dengan aturan kelayakan tesis, lalu J dihitung ulang.</div>
              )}
              <Workspace issues={f.issues} assignees={f.assignees} epics={f.epics} history={f.history}
                         view={view} onView={setView} selected={selected} onSelect={setSelected}
                         pauses={f.pauses} ghost={f.ghost}
                         ghostLabel={phase === "after" ? "posisi di langkah ② (gangguan masuk)" : "posisi di langkah ① (sebelum gangguan)"}
                         t={f.t} event={f.event} changed={marked}
                         dragEnabled={mode === "drag" && phase === "after" && current === manualKey}
                         onMove={onMove} />
              <h2 className="section-title">Perbandingan metode untuk seluruh episode</h2>
              <MethodTable rows={results} current={current} onPick={(key) => setCurrent(key)} lam={lam} />
            </>
          )}
        </div>
        {done && f && (
          <div className="side">
            <div className="side__tabs" role="tablist" aria-label="Panel kanan" data-tour="side">
              <button role="tab" aria-selected={side === "decision"} className={side === "decision" ? "on" : ""}
                      onClick={() => setSide("decision")}>Keputusan</button>
              <button role="tab" aria-selected={side === "log"} className={side === "log" ? "on" : ""}
                      onClick={() => setSide("log")} data-tour="log-tab">Log hitung</button>
            </div>
            {side === "decision" ? (
              <DecisionPanel frame={f} total={n} onOpenIssue={(key) => { setSelected(key); setView("form"); }}
                             manualLevels={mode === "levels" && current === manualKey ? {
                               pending, busy: run.data?.status !== "done",
                               onChoose: (j, lv) => setPending((p) => ({ ...p, [j]: lv })), onApply: applyLevels,
                             } : undefined} />
            ) : (
              <NumberLog runId={viewRun!} methodKey={current!} k={k} />
            )}
          </div>
        )}
      </div>
      {meta.data && !meta.data.models_match_test_lock && (
        <div className="notice notice--error">Berkas model berbeda dari kunci uji; lihat <Link to="/metode">Tentang metode</Link>.</div>
      )}
    </div>
  );
}
