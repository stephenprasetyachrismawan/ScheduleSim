// Record of one run: its settings, the methods that ran on it, the disruptions they all met, and
// the input of the episode (S0, due dates, E, capacity).
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ListOrdered, Pencil, Users, Workflow, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { angka, lambdaLabel } from "../../format";
import { Info } from "../../learn/Learn";
import { specLabel } from "../../odoo/runUrl";
import { CodeRef, Formula, NumSrc, type SourceNode } from "../../odoo/source";
import { ControlBar, Field, Fields, ListTable, Notebook, Sheet, SmartButton, SmartButtons } from "../../odoo/ui";
import type { EpisodeLog, MethodSummary } from "../../types";
import { methodHref, methodLabel, RunGate, runHref, useSim, type Sim } from "./common";
import { namesOf, nodeCap, nodeDue, nodeE, TaskLink, type Names } from "./sources";

export function payloadText(type: string, p: Record<string, unknown>, n: Names): ReactNode {
  const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null);
  const task = num("task_id");
  switch (type) {
    case "urgent_task": return <>tugas baru, upaya {angka(num("effort"), 2)} j, prioritas {angka(num("priority"), 2)}</>;
    case "effort_revision": return <>{task !== null && <TaskLink id={task} n={n} />}, upaya × {angka(num("factor"), 2)}</>;
    case "rework_review_fail": return <>{task !== null && <TaskLink id={task} n={n} />}, tambahan {angka(num("extra_effort"), 2)} j</>;
    case "priority_change": return <>{task !== null && <TaskLink id={task} n={n} />}, prioritas baru {angka(num("new_priority") ?? num("priority"), 2)}</>;
    case "developer_unavailable": return <>{num("dev_id") !== null && n.dev(num("dev_id")!)} tidak tersedia {angka(num("duration"), 2)} j</>;
    default: return <span className="mono small">{JSON.stringify(p)}</span>;
  }
}

function nodeSeed(ep: EpisodeLog): SourceNode | null {
  const d = ep.disruptions;
  if (!d) return null;
  return {
    title: "seed gangguan", value: String(d.seed),
    render: () => (
      <>
        <p>Urutan gangguan diundi dari seed ini. Seed dihitung dari proyek, intensitas, dan seed episode, tanpa nama
          metode. Karena itu semua metode dalam satu run mendapat gangguan yang sama persis.</p>
        <Formula rumus={d.seed_rule} isi={<span className="mono">{JSON.stringify(d.seed_inputs)}</span>} hasil={String(d.seed)} />
        <p>Pembangkit: <span className="mono">{d.generator}</span>, {d.n} gangguan sampai horizon {angka(d.horizon, 1)} jam.
          Gangguan yang jatuh dalam satu jendela {angka(d.window, 2)} jam digabung menjadi satu kejadian ({d.window_rule}).</p>
        <p className="muted small">{d.regenerated_equal ? "Dicek: diundi ulang dari seed ini memberi daftar yang sama persis." : ""}</p>
        <CodeRef file="src/arls_ppo/_explain.py" fn="disruption_draw" />
      </>
    ),
  };
}

function MethodTable({ sim, onPick }: { sim: Sim; onPick: (r: MethodSummary) => void }) {
  const rows = sim.allResults;
  const best = Math.min(...rows.map((r) => r.J));
  return (
    <ListTable rows={rows} rowKey={(r) => r.key} onRow={(r) => r.model_seed !== "mean" && onPick(r)}
      caption={<>J dihitung dengan λ = {lambdaLabel(sim.spec.lam)} sampai akhir episode. Klik baris untuk membuka metode itu.</>}
      columns={[
        { label: <>Metode <Info term="methods" /></>, cell: (r) => <><b>{methodLabel(r)}</b>{typeof r.model_seed === "number" && <span className="muted small"> · seed model {r.model_seed}</span>}{r.model_seed === "mean" && <span className="muted small"> · rata-rata 3 seed</span>}</> },
        { label: <>J episode <Info term="J" /></>, num: true, cell: (r) => <span style={{ fontWeight: r.J === best ? 700 : 400 }}>{angka(r.J, 3)}</span> },
        { label: "Tard/E akhir", num: true, cell: (r) => angka(r.tard, 3) },
        { label: "ΣU", num: true, cell: (r) => angka(r.changes, r.model_seed === "mean" ? 1 : 0) },
        { label: "Keputusan", num: true, cell: (r) => r.decisions },
        { label: <>p95 selector (ms) <Info term="p95" /></>, num: true, cell: (r) => (r.ms_selector_p95 === null ? "–" : angka(r.ms_selector_p95, 2)) },
        { label: <>Pelanggaran keras <Info term="hard" /></>, num: true, cell: (r) => r.hard_violations },
      ]} />
  );
}

function Body({ sim }: { sim: Sim }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const first = sim.results[0];
  const log = useQuery({ queryKey: ["log", sim.runId, first?.key], queryFn: () => api.log(sim.runId!, first.key),
                         enabled: !!first, staleTime: Infinity });
  const ep = log.data;
  const tab = params.get("tab") ?? "metode";
  const n = ep ? namesOf(ep.names, { q: sim.q, mk: first.key }) : null;
  const dis = ep?.disruptions;
  const inp = ep?.input;
  const href = (t: string) => `${runHref(sim.q)}&tab=${t}`;
  return (
    <div className="o-page">
      <ControlBar crumbs={[{ label: "Simulasi", to: "/simulasi" }, { label: specLabel(sim.spec) }]}
        right={<Link className="btn" to={`/simulasi/baru?${sim.q}`}><Pencil size={14} />Ubah pengaturan</Link>} />
      <Sheet title={<>Run <span className="mono">{specLabel(sim.spec)}</span></>}
        subtitle="Semua metode di run ini mendapat proyek, jadwal awal, dan gangguan yang sama. Perbedaan hasil hanya datang dari keputusan perbaikan masing-masing metode."
        smart={
          <SmartButtons>
            <SmartButton icon={CalendarClock} value={ep?.events.length ?? "…"} label="Kejadian"
                         to={first ? methodHref(sim.q, first.key, "kejadian") : undefined} />
            <SmartButton icon={Zap} value={dis?.n ?? "…"} label="Gangguan" to={href("gangguan")} />
            <SmartButton icon={ListOrdered} value={inp?.n_tasks ?? "…"} label="Tugas awal" to={`/proyek/${sim.spec.p}?tab=tugas`} />
            <SmartButton icon={Users} value={inp?.n_devs ?? "…"} label="Pengembang" to={`/proyek/${sim.spec.p}?tab=pengembang`} />
            <SmartButton icon={Workflow} value={sim.results.length} label="Metode" to={href("metode")} />
          </SmartButtons>
        }>
        <Fields cols={3}>
          <Field label="Proyek"><Link to={`/proyek/${sim.spec.p}`}>{sim.run?.context.name ?? sim.spec.p}</Link></Field>
          <Field label="Kapasitas"><span className="mono">{angka(sim.spec.cap)}</span></Field>
          <Field label="Intensitas gangguan"><span className="mono">{angka(sim.spec.int, 2)}</span></Field>
          <Field label="Seed episode"><span className="mono">{sim.spec.seed}</span></Field>
          <Field label="Seed gangguan">{ep ? <NumSrc node={() => nodeSeed(ep)}>{dis?.seed ?? "–"}</NumSrc> : "…"}</Field>
          <Field label="λ (change penalty)"><span className="mono">{lambdaLabel(sim.spec.lam)}</span></Field>
        </Fields>
        <Notebook current={tab} hrefOf={href} tabs={[
          { id: "metode", label: "Metode", count: sim.allResults.length },
          { id: "gangguan", label: "Gangguan", count: dis?.n },
          { id: "input", label: "Input episode" },
        ]}>
          {tab === "metode" && <MethodTable sim={sim} onPick={(r) => navigate(methodHref(sim.q, r.key))} />}
          {tab === "gangguan" && dis && n && (
            <ListTable rows={dis.events.flatMap((e, k) => e.members.map((m, i) => ({ k, i, at: e.time, ...m })))}
              rowKey={(r) => `${r.k}-${r.i}`}
              caption="Gangguan yang sama untuk semua metode, dikelompokkan per kejadian."
              columns={[
                { label: "Kejadian", cell: (r) => (r.i === 0 ? <b>Kejadian {r.k + 1}</b> : "") },
                { label: "Jam keputusan", num: true, cell: (r) => (r.i === 0 ? angka(r.at, 2) : "") },
                { label: "Jam gangguan", num: true, cell: (r) => angka(r.time, 2) },
                { label: "Jenis", cell: (r) => ep!.disruption_types[r.type] ?? r.type },
                { label: "Rincian", cell: (r) => payloadText(r.type, r.payload, n) },
              ]} />
          )}
          {tab === "input" && inp && n && ep && (
            <>
              <Fields cols={3}>
                <Field label={<>E (rata-rata upaya) <Info term="E" /></>}><NumSrc node={() => nodeE(ep, n)}>{angka(inp.E.value, 4)}</NumSrc></Field>
                <Field label={<>Kapasitas per pengembang <Info term="capacity" /></>}><NumSrc node={() => nodeCap(ep)}>{angka(inp.capacity.value, 4)}</NumSrc></Field>
                <Field label="Ukuran">{inp.n_tasks} tugas, {inp.n_jobs} job (epic), {inp.n_devs} pengembang</Field>
              </Fields>
              <p className="muted small">Jadwal awal S0: {inp.s0_rule}. {inp.s0_rebuilt_equal ? "Dicek: S0 dibangun ulang memberi jadwal yang sama." : ""}
                {" "}Tenggat: {inp.due_rule}.</p>
              <ListTable rows={inp.tasks} rowKey={(r) => r.tugas}
                columns={[
                  { label: "Tugas", cell: (r) => <TaskLink id={r.tugas} n={n} /> },
                  { label: "Job", cell: (r) => <Link to={`/proyek/${sim.spec.p}/job/${r.job}`}>Job {r.job + 1}</Link> },
                  { label: "Pengembang di S0", cell: (r) => n.dev(r.pengembang) },
                  { label: "Mulai S", num: true, cell: (r) => angka(r.S, 2) },
                  { label: "Selesai C", num: true, cell: (r) => angka(r.C, 2) },
                  { label: "Upaya", num: true, cell: (r) => angka(r.upaya, 2) },
                  { label: "Tenggat d", num: true, cell: (r) => <NumSrc node={() => nodeDue(ep, r.tugas, n)}>{angka(r.d, 2)}</NumSrc> },
                ]}
                footer={[`${inp.n_tasks} tugas`, "", "", "", "Σ upaya", <NumSrc key="e" node={() => nodeE(ep, n)}>{angka(inp.E.sum, 2)}</NumSrc>, ""]} />
            </>
          )}
          {tab !== "metode" && !ep && <div className="o-empty">Memuat log run…</div>}
        </Notebook>
      </Sheet>
    </div>
  );
}

export default function RunForm() {
  const sim = useSim();
  return <RunGate sim={sim}>{() => <Body sim={sim!} />}</RunGate>;
}

