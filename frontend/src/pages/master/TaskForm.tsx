// Record of one task: its id in the code and the manuscript next to its number on screen, the
// job and operation it is, the line of the raw file it was read from, and, when opened from a
// run, what happened to it in that run.
import { useQuery } from "@tanstack/react-query";
import { FileCode2 } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { Lozenge } from "../../components/atoms";
import { HistoryList } from "../../components/views/IssueForm";
import { angka } from "../../format";
import { specLabel } from "../../odoo/runUrl";
import { NumSrc } from "../../odoo/source";
import { ControlBar, Field, Fields, ListTable, Pager, Sheet, type Crumb } from "../../odoo/ui";
import { eventHref, methodHref, methodLabel, PHASES, runHref, taskHref, useSim } from "../sim/common";
import { namesOf, nodeDue } from "../sim/sources";
import { devHref, devName, jobHref, jobName, MasterGate, projectHref, useMaster, whereWritten } from "./common";

export default function TaskForm() {
  const { key = "MK01", id: idParam = "0" } = useParams();
  const id = Number(idParam);
  const [params] = useSearchParams();
  const sim = useSim();                                   // set when the task was opened from a run
  const mk = params.get("mk");
  const kParam = params.get("k");
  const k = kParam ? Number(kParam) - 1 : null;
  const langkah = params.get("langkah") ?? "3";
  const phase = PHASES.find((p) => p.id === langkah)?.phase ?? "after";
  const m = useMaster(key, sim?.spec.cap ?? 1.5);
  const runReady = !!sim && sim.run?.status === "done" && !!mk;
  const events = useQuery({ queryKey: ["events", sim?.runId, mk], enabled: runReady,
                            queryFn: () => api.events(sim!.runId!, mk!), staleTime: Infinity });
  const nEv = events.data?.length ?? 0;
  const at = k ?? nEv - 1;
  const atPhase = k === null ? "after" : phase;
  const frame = useQuery({ queryKey: ["frame", sim?.runId, mk, at, atPhase], enabled: runReady && nEv > 0 && at >= 0,
                           queryFn: () => api.frame(sim!.runId!, mk!, at, atPhase), staleTime: Infinity });
  const endFrame = useQuery({ queryKey: ["frame", sim?.runId, mk, nEv - 1, "after"], enabled: runReady && nEv > 0,
                              queryFn: () => api.frame(sim!.runId!, mk!, nEv - 1, "after"), staleTime: Infinity });
  const log = useQuery({ queryKey: ["log", sim?.runId, mk], enabled: runReady,
                         queryFn: () => api.log(sim!.runId!, mk!), staleTime: Infinity });

  return (
    <MasterGate m={m}>{(master, board) => {
      const t = master.tasks.find((x) => x.id === id);
      const screen = `${key}-${id + 1}`;
      const s0 = board.issues.find((i) => i.id === id);
      const inRun = frame.data?.issues.find((i) => i.id === id);
      const created = endFrame.data?.history.find((h) => h.kind === "created" && h.issue === screen);
      const r = sim?.results.find((x) => x.key === mk);
      const ctx = sim && mk ? { q: sim.q, mk, k: k ?? undefined, langkah } : undefined;
      const crumbs: Crumb[] = sim && mk && r
        ? [{ label: "Simulasi", to: "/simulasi" }, { label: specLabel(sim.spec), to: runHref(sim.q) },
           { label: methodLabel(r), to: methodHref(sim.q, mk) },
           ...(k !== null ? [{ label: `Kejadian ${k + 1}`, to: eventHref(sim.q, mk, k, `&langkah=${langkah}`) }] : []),
           { label: screen }]
        : [{ label: "Proyek", to: "/" }, { label: key, to: projectHref(key) }, { label: "Tugas", to: projectHref(key, "tugas") }, { label: screen }];
      const names = log.data && ctx ? namesOf(log.data.names, ctx) : null;
      const history = (frame.data?.history ?? []).filter((h) => h.issue === screen);
      const prev = t && id > 0 ? taskHref(key, id - 1, ctx) : null;
      const next = t && id + 1 < master.tasks.length ? taskHref(key, id + 1, ctx) : null;
      return (
        <div className="o-page">
          <ControlBar crumbs={crumbs}
            right={t ? <Pager index={id} total={master.tasks.length} label="Tugas" prev={prev} next={next} /> : undefined} />
          <Sheet title={<span className="mono">{screen}</span>}
            badge={t ? <span className="o-badge">tugas asli</span> : <span className="o-badge o-badge--warn">tugas tidak terencana</span>}
            subtitle={s0?.summary ?? inRun?.summary}>
            <Fields cols={3}>
              <Field label="Nomor di layar"><span className="mono">{screen}</span></Field>
              <Field label="id di kode dan naskah" hint="nomor di layar = id + 1"><span className="mono">{id}</span></Field>
              {t ? <Field label="Job (epic)"><Link to={jobHref(key, t.job)}>{jobName(board, t.job)}</Link> · operasi ke-{t.op + 1} dari {master.tasks.filter((x) => x.job === t.job).length}</Field>
                 : <Field label="Job (epic)">Pekerjaan tidak terencana</Field>}
            </Fields>

            {t ? (
              <>
                <h3 className="o-h3"><FileCode2 size={16} /> Asal data: {whereWritten(master)}</h3>
                <Fields>
                  <Field label="Letak di sumber"><span className="mono">{t.pointer}</span></Field>
                  {master.source.path && <Field label="Berkas">
                    {master.source.url ? <a href={master.source.url} target="_blank" rel="noreferrer" className="mono">{master.source.path}</a> : <span className="mono">{master.source.path}</span>}</Field>}
                </Fields>
                <pre className="o-raw" aria-label="Isi sumber apa adanya"><code>{`${t.pointer} = ${JSON.stringify(t.raw, null, 1).replace(/\n\s*/g, " ")}`}</code></pre>
                <p className="muted small">
                  {master.source.kind === "file"
                    ? <>Urutan id mengikuti urutan di berkas: job 1 operasi 1 = id 0, lalu seterusnya. Setiap <span className="mono">machine</span>
                      {" "}menjadi pengembang dengan nomor yang sama, dan <span className="mono">processing</span> menjadi upaya
                      {master.source.scale !== 1 ? <> setelah dikali faktor skala {angka(master.source.scale, 4)}</> : " tanpa diubah"}.</>
                    : <>Upaya per pengembang diketik langsung di proyek ini.</>}
                </p>
                <ListTable rows={Object.entries(t.eligible).map(([d, v]) => ({ d: Number(d), v }))} rowKey={(x) => x.d}
                  caption="Pengembang yang bisa mengerjakan tugas ini."
                  columns={[
                    { label: "Pengembang", cell: (x) => <Link to={devHref(key, x.d)}>{devName(board, x.d)}</Link> },
                    { label: master.source.kind === "file" ? "Di berkas" : "Di spec", cell: (x) => <span className="mono small">{master.source.kind === "file" ? `machine ${x.d}` : `efforts["${x.d}"]`}</span> },
                    { label: "Upaya (jam)", num: true, cell: (x) => angka(x.v, 2) },
                  ]} />
                <h3 className="o-h3">Dependensi</h3>
                {t.deps.length === 0 ? <p className="muted">Tidak menunggu tugas lain.</p> : (
                  <ul className="o-deps">{t.deps.map((d) => (
                    <li key={d.id}>menunggu <Link className="mono" to={taskHref(key, d.id, ctx)}>{key}-{d.id + 1}</Link>{" "}
                      <span className="muted small">({d.kind === "job" ? "operasi sebelumnya di job yang sama" : "lintas job"})</span></li>))}</ul>
                )}
                {s0 && (
                  <>
                    <h3 className="o-h3">Di jadwal awal S0</h3>
                    <Fields cols={3}>
                      <Field label="Pengembang"><Link to={devHref(key, s0.assignee_id)}>{s0.assignee}</Link></Field>
                      <Field label="Mulai – selesai"><span className="mono">{angka(s0.start, 2)} – {angka(s0.end, 2)}</span></Field>
                      <Field label="Tenggat d" hint="d = C + 0,5 × (C − S), dari S0">{log.data && names ? <NumSrc node={() => nodeDue(log.data!, id, names)}>{angka(s0.due, 2)}</NumSrc>
                        : <span className="mono">{angka(s0.due, 2)}</span>}</Field>
                    </Fields>
                  </>
                )}
              </>
            ) : (
              <div className="o-look"><span>
                Tugas ini tidak ada di data master. {key} punya {master.tasks.length} tugas asli (id 0 sampai {master.tasks.length - 1}),
                jadi tugas tidak terencana pertama dalam satu episode mendapat id {master.tasks.length} dan tampil sebagai {key}-{master.tasks.length + 1}.{" "}
                {created && sim && mk
                  ? <>Tugas ini dibuat oleh gangguan pada <Link to={eventHref(sim.q, mk, created.event, "&langkah=2")}>kejadian {created.event + 1}</Link>{" "}
                    (jam ke-{angka(created.t, 1)}): {created.text}</>
                  : !sim ? "Buka tugas ini dari halaman simulasi untuk melihat gangguan yang membuatnya." : ""}
              </span></div>
            )}

            {sim && mk && inRun && (
              <>
                <h3 className="o-h3">Di run ini{k !== null ? `, kejadian ${k + 1} langkah ${PHASES.find((p) => p.id === langkah)?.label}` : ", akhir episode"}</h3>
                <Fields cols={3}>
                  <Field label="Status"><Lozenge status={inRun.status} /></Field>
                  <Field label="Pengembang"><Link to={devHref(key, inRun.assignee_id)}>{inRun.assignee}</Link></Field>
                  <Field label="Upaya"><span className="mono">{angka(inRun.estimate, 2)} j</span></Field>
                  <Field label="Mulai – selesai"><span className="mono">{angka(inRun.start, 2)} – {angka(inRun.end, 2)}</span></Field>
                  <Field label="Tenggat"><span className="mono">{angka(inRun.due, 2)}</span></Field>
                  <Field label="Terlambat">{inRun.late ? <span className="mono">{angka(inRun.end - inRun.due, 2)} j</span> : "tidak"}</Field>
                </Fields>
                <h3 className="o-h3">Riwayat sampai titik ini</h3>
                <HistoryList entries={history} empty="Belum ada yang terjadi pada tugas ini." />
              </>
            )}
          </Sheet>
        </div>
      );
    }}</MasterGate>
  );
}
