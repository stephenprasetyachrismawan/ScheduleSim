// Record of one event of one method: the pager moves between events of this method only, the
// status bar between the three steps of this event, and "Bandingkan metode lain" opens the same
// event for another method. Every number has a ↗ to its source.
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Eye, Flag, GitCompareArrows, Pause, Play, Sigma, Undo2, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { LEVEL_NAMES, LEVEL_SHORT, Ladder } from "../../components/atoms";
import type { ViewName } from "../../components/ControlPanel";
import { HistoryList } from "../../components/views/IssueForm";
import type { Move } from "../../components/views/BoardView";
import Workspace from "../../components/Workspace";
import { angka } from "../../format";
import { Info, Tour, type TourStep } from "../../learn/Learn";
import { specLabel, specQuery, type RunSpec } from "../../odoo/runUrl";
import { NumSrc, Src } from "../../odoo/source";
import { ControlBar, Field, Fields, ListTable, Notebook, Pager, Sheet, SmartButton, SmartButtons, Statusbar } from "../../odoo/ui";
import DecisionPanel from "../DecisionPanel";
import NumberLog from "../NumberLog";
import { endHref, eventHref, methodHref, methodLabel, PHASES, RunGate, runHref, taskHref, useSim, type Sim } from "./common";
import { payloadText } from "./RunForm";
import { namesOf, nodeEventJ, nodeEventU, nodeProb, nodeStepTard } from "./sources";

export const EVENT_TOUR: TourStep[] = [
  { target: "crumbs", title: "1. Di mana saya?",
    body: "Breadcrumb menunjukkan jalurnya: Simulasi / run / metode / kejadian. Klik bagian mana pun untuk naik satu tingkat." },
  { target: "pager", title: "2. Pindah kejadian",
    body: "Pager hanya memindah kejadian dari metode yang sama. Di kejadian terakhir tombol › mati, dan muncul tombol Akhir episode." },
  { target: "steps", title: "3. Tiga langkah satu kejadian",
    body: "① jadwal sebelum gangguan, ② gangguan dimasukkan tanpa perbaikan (tingkat 0 / AOR), ③ sesudah metode memilih tingkat perbaikan." },
  { target: "compare", title: "4. Metode lain",
    body: "Buka kejadian yang sama untuk metode lain. Gangguannya sama; jadwalnya bisa berbeda karena keputusan sebelumnya berbeda." },
  { target: "numbers", title: "5. Asal angka",
    body: "Tanda ↗ di samping angka membuka asalnya: rumus, angka yang masuk, daftar tugas yang dijumlah, dan kode yang menghitungnya." },
  { target: "tab-jadwal", title: "6. Jadwal",
    body: "List, Board, atau Timeline. Tugas yang perlu diperhatikan diberi garis tepi. Klik tugas untuk membuka form tugas itu." },
  { target: "tab-log", title: "7. Log hitung",
    body: "Semua angka kejadian ini dari input sampai J, termasuk 38 angka keadaan yang dibaca kebijakan." },
];

const STEP_TEXT: Record<string, string> = {
  "1": "Jadwal tepat sebelum gangguan kejadian ini datang. Pada kejadian pertama ini adalah jadwal awal S0; sesudahnya, jadwal ini hasil keputusan metode pada kejadian-kejadian sebelumnya.",
  "2": "Gangguan sudah dimasukkan, belum diperbaiki: tugas baru ditaruh di akhir antrean pengembangnya dan tugas yang terkena digeser ke kanan seperlunya. Semua metode melewati langkah ini lebih dulu (tingkat 0 / AOR). Kotak putus-putus = posisi di langkah ①.",
  "3": "Jadwal sesudah metode memilih tingkat perbaikan untuk setiap gangguan. Kotak putus-putus = posisi di langkah ②; tugas yang berubah diberi tanda.",
};

function keyId(key: string): number {
  return Number(key.split("-").pop()) - 1;
}

function Body({ sim, mk, k }: { sim: Sim; mk: string; k: number }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const langkah = ["1", "2", "3"].includes(params.get("langkah") ?? "") ? params.get("langkah")! : "3";
  const phase = PHASES.find((p) => p.id === langkah)!.phase;
  const tab = params.get("tab") ?? "jadwal";
  const view = (params.get("view") as ViewName) ?? "gantt";
  const banding = params.get("banding") === "1";
  const idx = sim.results.findIndex((r) => r.key === mk);
  const r = sim.results[idx];
  const events = useQuery({ queryKey: ["events", sim.runId, mk], queryFn: () => api.events(sim.runId!, mk),
                            enabled: !!r, staleTime: Infinity });
  const n = events.data?.length ?? 0;
  const frame = useQuery({ queryKey: ["frame", sim.runId, mk, k, phase], enabled: !!r && n > 0 && k < n,
                           queryFn: () => api.frame(sim.runId!, mk, k, phase), staleTime: Infinity,
                           placeholderData: (p) => p });
  const evLog = useQuery({ queryKey: ["log", sim.runId, mk, k], enabled: !!r && n > 0 && k < n,
                           queryFn: () => api.logEvent(sim.runId!, mk, k), staleTime: Infinity });
  const epLog = useQuery({ queryKey: ["log", sim.runId, mk], enabled: !!r, queryFn: () => api.log(sim.runId!, mk),
                           staleTime: Infinity });
  const others = useQueries({ queries: sim.results.map((o) => ({
    queryKey: ["events", sim.runId, o.key], queryFn: () => api.events(sim.runId!, o.key), staleTime: Infinity,
    enabled: banding })) });

  // keep everything except what is changed
  const extra = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = { langkah, tab, view: params.get("view"), banding: banding ? "1" : null, ...patch };
    for (const [key, v] of Object.entries(cur)) if (v !== null && v !== undefined) p.set(key, v);
    return `&${p.toString()}`;
  };
  const here = (patch: Record<string, string | null>) => eventHref(sim.q, mk, k, extra(patch));

  // slow playback: ① → ② → ③, then the next event
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3000);
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      if (langkah !== "3") navigate(here({ langkah: String(Number(langkah) + 1) }), { replace: true });
      else if (k + 1 < n) navigate(eventHref(sim.q, mk, k + 1, extra({ langkah: "1" })), { replace: true });
      else setPlaying(false);
    }, speed);
    return () => clearTimeout(id);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const f = frame.data;
  const ev = evLog.data;
  const ep = epLog.data;
  const names = ev ? namesOf(ev.names, { q: sim.q, mk, k, langkah }) : null;
  const affected = useMemo(() => (f ? [...new Set(f.event.affected.flatMap((a) => a.issues))] : []), [f]);
  const changed = useMemo(() => (f && phase === "after"
    ? [...new Set(f.history.filter((h) => h.event === k && h.issue && (h.kind === "assignee" || h.kind === "rank")).map((h) => h.issue!))]
    : []), [f, k, phase]);
  const marked = phase === "aor" ? affected : changed;

  // manual runs: the choices live in the URL too
  const manualKey = sim.spec.mode === "compare" ? null : sim.spec.guard ? "manual_g" : "manual";
  const isManual = manualKey !== null && mk === manualKey;
  const [pending, setPending] = useState<Record<number, number>>({});
  useEffect(() => { setPending({}); }, [k, sim.runId]);
  const withManual = (s: RunSpec) => eventHref(specQuery(s), mk, k, extra({}));
  const applyLevels = () => {
    const levels = { ...(sim.spec.man.levels ?? {}) };
    for (const [j, lv] of Object.entries(pending)) levels[`${k}:${j}`] = lv;
    navigate(withManual({ ...sim.spec, man: { ...sim.spec.man, levels } }));
  };
  const onMove = (m: Move) => {
    const moves = { ...(sim.spec.man.moves ?? {}) };
    moves[String(k)] = [...(moves[String(k)] ?? []), m];
    navigate(withManual({ ...sim.spec, man: { ...sim.spec.man, moves } }));
  };
  const manualHere = Object.keys(sim.spec.man.levels ?? {}).some((x) => x.startsWith(`${k}:`)) || (sim.spec.man.moves?.[String(k)]?.length ?? 0) > 0;
  const clearManual = () => {
    const levels = Object.fromEntries(Object.entries(sim.spec.man.levels ?? {}).filter(([x]) => !x.startsWith(`${k}:`)));
    const moves = { ...(sim.spec.man.moves ?? {}) };
    delete moves[String(k)];
    navigate(withManual({ ...sim.spec, man: { levels, moves } }));
  };

  if (!r) return <div className="o-page"><div className="o-empty">Metode {mk} tidak ada di run ini. <Link to={runHref(sim.q)}>Kembali ke run</Link>.</div></div>;
  if (events.data && (k < 0 || k >= n)) {
    return <div className="o-page"><div className="o-empty">Kejadian {k + 1} tidak ada; metode ini punya {n} kejadian.{" "}
      <Link to={methodHref(sim.q, mk)}>Lihat daftar kejadian</Link> atau <Link to={endHref(sim.q, mk)}>akhir episode</Link>.</div></div>;
  }
  const last = n > 0 && k === n - 1;
  const crumbs = [{ label: "Simulasi", to: "/simulasi" }, { label: specLabel(sim.spec), to: runHref(sim.q) },
                  { label: methodLabel(r), to: methodHref(sim.q, mk) }, { label: `Kejadian ${k + 1}` }];
  const prevHref = k > 0 ? eventHref(sim.q, mk, k - 1, extra({ langkah: "3" })) : null;
  return (
    <div className="o-page">
      <Tour name="kejadian" steps={EVENT_TOUR} />
      <div data-tour="crumbs">
        <ControlBar crumbs={crumbs}
          right={<span data-tour="pager"><Pager index={k} total={n || 1} label="Kejadian"
                   prev={k > 0 ? eventHref(sim.q, mk, k - 1, extra({})) : null}
                   next={k + 1 < n ? eventHref(sim.q, mk, k + 1, extra({})) : null} /></span>}>
          <div className="o-actions">
            <Link className={`btn ${banding ? "btn--on" : ""}`} to={here({ banding: banding ? null : "1" })} replace data-tour="compare">
              <GitCompareArrows size={15} />Bandingkan metode lain</Link>
            <button className="btn" onClick={() => setPlaying((x) => !x)} title="Putar langkah demi langkah: ① → ② → ③, lalu kejadian berikutnya">
              {playing ? <Pause size={15} /> : <Play size={15} />}{playing ? "Jeda" : "Putar"}</button>
            <select className="select select--sm" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Kecepatan putar">
              <option value={6000}>sangat pelan</option><option value={3000}>pelan</option>
              <option value={1500}>sedang</option><option value={700}>cepat</option>
            </select>
            {last && <Link className="btn btn--primary" to={endHref(sim.q, mk)}><Flag size={15} />Akhir episode<ArrowRight size={15} /></Link>}
          </div>
          <span data-tour="steps">
            <Statusbar label="Langkah dalam kejadian" current={langkah} hrefOf={(id) => here({ langkah: id })}
                       steps={PHASES.map((p) => ({ id: p.id, label: p.label }))} />
          </span>
        </ControlBar>
      </div>

      {banding && (
        <div className="o-related">
          <div className="o-related__title">Kejadian {k + 1} pada setiap metode (gangguan sama). Klik untuk pindah metode.</div>
          <ListTable rows={sim.results} rowKey={(o) => o.key} selected={(o) => o.key === mk}
            onRow={(o) => navigate(eventHref(sim.q, o.key, k, extra({})))}
            columns={[
              { label: "Metode", cell: (o) => <b>{methodLabel(o)}{typeof o.model_seed === "number" && <span className="muted small"> · seed {o.model_seed}</span>}</b> },
              { label: "Tingkat dipakai", cell: (o) => { const e = others[sim.results.indexOf(o)]?.data?.[k];
                  return e ? <span className="o-ladders">{e.levels.map((l, j) => <Ladder key={j} level={o.method === "aor" ? null : l} />)}</span> : "…"; } },
              { label: "U", num: true, cell: (o) => others[sim.results.indexOf(o)]?.data?.[k]?.changes ?? "…" },
              { label: "Tard/E ③", num: true, cell: (o) => angka(others[sim.results.indexOf(o)]?.data?.[k]?.tard_after, 3) },
              { label: "J", num: true, cell: (o) => angka(others[sim.results.indexOf(o)]?.data?.[k]?.J_after_batch, 3) },
            ]} />
        </div>
      )}

      {!f ? <div className="o-empty o-empty--wait">Memuat kejadian {k + 1}…</div> : (
        <Sheet title={<>Kejadian {k + 1} <span className="o-sheet__of">dari {n}</span></>}
          subtitle={<>{methodLabel(r)} · jam ke-{angka(f.event.time, 1)} · {f.event.disruptions.length} gangguan: {f.event.disruptions.map((d) => d.label).join(", ")}</>}
          badge={last ? <span className="o-badge o-badge--end">kejadian terakhir</span> : undefined}
          smart={
            <SmartButtons>
              <SmartButton icon={Zap} value={f.event.disruptions.length} label="Gangguan" to={here({ tab: "gangguan" })} />
              <SmartButton icon={Users} value={affected.length} label="Tugas terkena" to={here({ tab: "jadwal", langkah: "2" })}
                           title="Tugas yang terkena gangguan (A_j), ditandai di langkah ②" />
              <SmartButton icon={Sigma} value={f.event.changes} label="Perubahan U" to={here({ tab: "perubahan" })} />
              <SmartButton icon={CalendarClock} value={n} label="Kejadian" to={methodHref(sim.q, mk)} />
            </SmartButtons>
          }>
          <div data-tour="numbers">
            <Fields cols={3}>
              <Field label={<>Tard/E ① sebelum <Info term="J" /></>}>
                {ev && names ? <NumSrc node={() => nodeStepTard(ev, "1", ep, names, prevHref)}>{angka(f.event.tard_before, 3)}</NumSrc> : angka(f.event.tard_before, 3)}
              </Field>
              <Field label="Tard/E ② gangguan masuk">
                {ev && names ? <NumSrc node={() => nodeStepTard(ev, "2", ep, names, prevHref)}>{angka(f.event.tard_aor, 3)}</NumSrc> : angka(f.event.tard_aor, 3)}
              </Field>
              <Field label="Tard/E ③ sesudah perbaikan">
                {ev && names ? <NumSrc node={() => nodeStepTard(ev, "3", ep, names, prevHref)}>{angka(f.event.tard_after, 3)}</NumSrc> : angka(f.event.tard_after, 3)}
              </Field>
              <Field label={<>Tingkat dipakai <Info term="ladder" /></>}>
                <span className="o-levels">{f.event.subs.map((s) => (
                  <span key={s.j} className="o-level"><Ladder level={r.method === "aor" ? null : s.used} />
                    {s.used === null || r.method === "aor" ? "tanpa perbaikan" : `${LEVEL_SHORT[s.used]} ${LEVEL_NAMES[s.used]}`}</span>))}</span>
              </Field>
              <Field label={<>Perubahan U <Info term="U" /></>}>
                {ev && names ? <NumSrc node={() => nodeEventU(ev, names)}>{f.event.changes}</NumSrc> : f.event.changes}
              </Field>
              <Field label="J = Tard/E + λ × U">
                {ev && names ? <NumSrc node={() => nodeEventJ(ev, ep, names)}>{angka(f.event.J_after_batch, 3)}</NumSrc> : angka(f.event.J_after_batch, 3)}
              </Field>
            </Fields>
          </div>

          <div className="o-step">
            <p className="o-step__text"><b>{PHASES.find((p) => p.id === langkah)!.label}.</b> {STEP_TEXT[langkah]}</p>
            {langkah !== "1" && (
              <div className="o-look" aria-live="polite"><Eye size={15} />
                <span><b>Perhatikan:</b>{" "}
                  {marked.length === 0
                    ? (langkah === "2" ? "tidak ada tugas yang terkena." : `${methodLabel(r)} tidak mengubah tugas apa pun pada kejadian ini.`)
                    : (langkah === "2" ? "tugas yang terkena gangguan, diberi garis tepi di jadwal: " : `tugas yang diubah ${methodLabel(r)}: `)}
                  {marked.map((key) => <Link key={key} className="chip" to={taskHref(sim.spec.p, keyId(key), { q: sim.q, mk, k, langkah })}>{key}</Link>)}
                </span>
              </div>
            )}
            {last && langkah === "3" && (
              <div className="o-look o-look--end"><Flag size={15} /><span>Ini kejadian terakhir. Sesudahnya tidak ada gangguan lagi;{" "}
                <Link to={endHref(sim.q, mk)}>buka Akhir episode</Link> untuk jadwal sampai semua tugas selesai dan J episode.</span></div>
            )}
            {isManual && sim.spec.mode === "drag" && langkah === "3" && view === "board" && (
              <div className="notice">Geser kartu To Do ke pengembang lain atau ke posisi lain. Setiap geseran diperiksa dengan aturan kelayakan tesis, lalu J dihitung ulang.</div>
            )}
            {isManual && sim.spec.mode === "drag" && !(langkah === "3" && view === "board") && (
              <div className="notice">Untuk menggeser kartu: pilih langkah ③ dan tampilan Board. <Link to={here({ langkah: "3", view: "board", tab: "jadwal" })} replace>Buka</Link></div>
            )}
            {isManual && manualHere && (
              <button className="btn btn--sm" onClick={clearManual}><Undo2 size={14} />Hapus pilihan manual kejadian ini</button>
            )}
          </div>

          <Notebook current={tab} hrefOf={(t) => here({ tab: t })} tabs={[
            { id: "jadwal", label: "Jadwal" },
            { id: "gangguan", label: "Gangguan", count: f.event.disruptions.length },
            { id: "keputusan", label: "Keputusan", count: f.event.subs.length },
            { id: "perubahan", label: "Perubahan", count: f.event.changes },
            { id: "log", label: "Log hitung" },
          ]}>
            {tab === "jadwal" && (
              <Workspace issues={f.issues} assignees={f.assignees} epics={f.epics} history={f.history}
                         view={view} onView={(v) => navigate(here({ view: v }), { replace: true })}
                         selected={null} onSelect={() => {}} pauses={f.pauses} ghost={f.ghost}
                         ghostLabel={langkah === "3" ? "posisi di langkah ②" : "posisi di langkah ①"}
                         t={f.t} event={f.event} changed={new Set(marked)}
                         onOpenIssue={(key) => navigate(taskHref(sim.spec.p, keyId(key), { q: sim.q, mk, k, langkah }))}
                         dragEnabled={isManual && sim.spec.mode === "drag" && langkah === "3"} onMove={onMove} />
            )}
            {tab === "gangguan" && names && (
              <ListTable rows={f.event.disruptions.map((d, j) => ({ d, j }))} rowKey={(x) => x.j}
                columns={[
                  { label: "Jam", num: true, cell: (x) => angka(x.d.time, 2) },
                  { label: "Jenis", cell: (x) => <b>{x.d.label}</b> },
                  { label: "Rincian", cell: (x) => payloadText(x.d.type, x.d.payload, names) },
                  { label: <>Tugas terkena A_j <Info term="affected" /></>, cell: (x) => (
                    <span className="o-chips">{(f.event.affected[x.j]?.issues ?? []).map((key) => (
                      <Link key={key} className="chip" to={taskHref(sim.spec.p, keyId(key), { q: sim.q, mk, k, langkah })}>{key}</Link>))}
                      {(f.event.affected[x.j]?.issues.length ?? 0) === 0 && <span className="muted">kosong</span>}</span>) },
                ]} />
            )}
            {tab === "keputusan" && (
              <>
                {isManual && sim.spec.mode === "levels" && (
                  <div className="notice">Pilih satu tingkat untuk setiap gangguan, lalu tekan Terapkan. J dihitung ulang dengan kode penelitian.</div>
                )}
                <DecisionPanel frame={f} total={n} only="subs"
                  onOpenIssue={(key) => navigate(taskHref(sim.spec.p, keyId(key), { q: sim.q, mk, k, langkah }))}
                  subExtra={(j) => { const s = ev?.subs.find((x) => x.j === j); const node = s ? nodeProb(s) : null;
                    return node ? <span className="small muted">peluang <Src node={() => node} /></span> : null; }}
                  manualLevels={isManual && sim.spec.mode === "levels" ? {
                    pending, busy: false, onChoose: (j, lv) => setPending((p) => ({ ...p, [j]: lv })), onApply: applyLevels,
                  } : undefined} />
              </>
            )}
            {tab === "perubahan" && (
              <>
                <p className="muted small">U = {f.event.changes}{ev && names && <> <Src node={() => nodeEventU(ev, names)} /></>}.
                  Dihitung terhadap jadwal langkah ②: pindah pengembang dan pindah posisi antrean.</p>
                <HistoryList entries={f.history.filter((h) => h.event === k && (h.kind === "assignee" || h.kind === "rank"))}
                             empty="Tidak ada perubahan pada kejadian ini." />
              </>
            )}
            {tab === "log" && <NumberLog runId={sim.runId!} methodKey={mk} k={k} />}
          </Notebook>
        </Sheet>
      )}
    </div>
  );
}

export default function EventForm() {
  const sim = useSim();
  const { mk = "", k = "1" } = useParams();
  return <RunGate sim={sim} undo={sim ? undoLastManual(sim.spec) : null}>{() => <Body sim={sim!} mk={mk} k={Number(k) - 1} />}</RunGate>;
}

/** URL of the run without its last manual choice (used when that choice was refused). */
function undoLastManual(s: RunSpec): string | null {
  if (s.mode === "compare") return null;
  const moves = { ...(s.man.moves ?? {}) };
  const ks = Object.keys(moves).map(Number).sort((a, b) => b - a);
  if (ks.length) {
    const kk = String(ks[0]);
    moves[kk] = moves[kk].slice(0, -1);
    if (!moves[kk].length) delete moves[kk];
    return `/simulasi/run?${specQuery({ ...s, man: { ...s.man, moves } })}`;
  }
  return null;
}

