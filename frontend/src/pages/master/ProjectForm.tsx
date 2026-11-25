// Record of a project (master data): the initial schedule S0, its tasks, developers and jobs,
// and the raw file or typed spec they all come from.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCode2, FlaskConical, Layers, ListOrdered, Pencil, Trash2, Users } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import type { ViewName } from "../../components/ControlPanel";
import Workspace from "../../components/Workspace";
import { angka } from "../../format";
import { ControlBar, Field, Fields, ListTable, Notebook, Sheet, SmartButton, SmartButtons } from "../../odoo/ui";
import { devHref, devName, jobHref, MasterGate, projectHref, useMaster, whereWritten } from "./common";

const STEPS: [string, string][] = [
  ["Mesin menjadi pengembang", "mesin M1, M2, … di berkas menjadi Pengembang 1, 2, …; waktu proses menjadi upaya (jam)."],
  ["Kapasitas", "cap_j = pengali kapasitas × (Σ upaya nominal / banyak pengembang). Pengali dipilih di run."],
  ["Dependensi", "operasi ke-k sebuah job menunggu operasi ke-(k−1) job yang sama; sebagian kecil job juga menunggu job sebelumnya (lintas job)."],
  ["Tenggat bawaan", "tenggat TWK dari data; episode menggantinya dengan tenggat dari S0 (d = C + 0,5 × (C − S))."],
  ["Prioritas", "dibagi per kuantil upaya."],
  ["Pemeriksaan", "dependensi tidak boleh membentuk lingkaran (DAG)."],
];

export default function ProjectForm() {
  const { key = "MK01" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const capacity = Number(params.get("cap") ?? 1.5);
  const m = useMaster(key, capacity);
  const del = useMutation({ mutationFn: () => api.deleteProject(key),
                            onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); navigate("/"); } });
  const tab = params.get("tab") ?? "jadwal";
  const view = (params.get("view") as ViewName) ?? "list";
  const href = (t: string) => `${projectHref(key, t)}${capacity !== 1.5 ? `&cap=${capacity}` : ""}`;
  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    setParams(p, { replace: true });
  };
  return (
    <MasterGate m={m}>{(master, board) => {
      const keyOf = (id: number) => board.issues.find((i) => i.id === id)?.key ?? `${key}-${id + 1}`;
      return (
        <div className="o-page">
          <ControlBar crumbs={[{ label: "Proyek", to: "/" }, { label: board.project.group }, { label: key }]}
            right={<span className="o-actions">
              {board.project.editable && <>
                <Link to={`/proyek/${key}/ubah`} className="btn"><Pencil size={15} />Ubah</Link>
                <button className="btn btn--danger" onClick={() => {
                  if (confirm(`Hapus proyek ${key}? Tindakan ini tidak bisa dibatalkan.`)) del.mutate();
                }}><Trash2 size={15} />Hapus</button></>}
              <Link to={`/simulasi/baru?p=${key}&cap=${capacity}`} className="btn btn--primary"><FlaskConical size={15} />Simulasikan gangguan</Link>
            </span>} />
          <Sheet title={board.project.name}
            subtitle={<>Data master proyek. Setiap tugas berasal dari {whereWritten(master)}; buka satu tugas untuk melihat
              baris aslinya. Tugas dengan id {master.tasks.length} ke atas tidak ada di sini: tugas itu dibuat oleh gangguan
              selama simulasi.</>}
            smart={
              <SmartButtons>
                <SmartButton icon={ListOrdered} value={master.tasks.length} label="Tugas" to={href("tugas")} />
                <SmartButton icon={Users} value={master.developers.length} label="Pengembang" to={href("pengembang")} />
                <SmartButton icon={Layers} value={board.epics.length} label="Job (epic)" to={href("job")} />
                <SmartButton icon={FileCode2} value={master.source.kind === "file" ? "Berkas" : "Spec"} label="Sumber data" to={href("sumber")} />
              </SmartButtons>
            }>
            <Notebook current={tab} hrefOf={href} tabs={[
              { id: "jadwal", label: "Jadwal awal S0" },
              { id: "tugas", label: "Tugas", count: master.tasks.length },
              { id: "pengembang", label: "Pengembang", count: master.developers.length },
              { id: "job", label: "Job", count: board.epics.length },
              { id: "sumber", label: "Sumber data" },
            ]}>
              {tab === "jadwal" && (
                <>
                  <p className="muted small">Jadwal awal S0 pada t = 0 dengan kapasitas {angka(capacity)}. Tenggat diturunkan dari S0,
                    jadi di S0 tidak ada tugas yang terlambat.</p>
                  <Workspace issues={board.issues} assignees={board.assignees} epics={board.epics} history={[]}
                    view={view} onView={(v) => set({ view: v })} selected={null} onSelect={() => {}} t={0}
                    onOpenIssue={(k) => navigate(`/proyek/${key}/tugas/${Number(k.split("-").pop()) - 1}`)}
                    panelExtra={
                      <label className="who small">Kapasitas
                        <select className="select" value={capacity} onChange={(e) => set({ cap: e.target.value })}>
                          {[1.0, 1.5, 2.0].map((c) => <option key={c} value={c}>{angka(c)}</option>)}
                        </select></label>} />
                </>
              )}
              {tab === "tugas" && (
                <ListTable rows={master.tasks} rowKey={(t) => t.id} onRow={(t) => navigate(`/proyek/${key}/tugas/${t.id}`)}
                  caption={<>Nomor di layar = id + 1. Kode dan naskah memakai id mulai dari 0.</>}
                  columns={[
                    { label: "Tugas", cell: (t) => <span className="mono">{keyOf(t.id)}</span> },
                    { label: "id", num: true, cell: (t) => t.id },
                    { label: "Job", cell: (t) => `Job ${t.job + 1}` },
                    { label: "Operasi", num: true, cell: (t) => t.op + 1 },
                    { label: "Pengembang layak: upaya (jam)", cell: (t) => <span className="small">{Object.entries(t.eligible).map(([d, v]) => `${devName(board, Number(d))}: ${angka(v, 2)}`).join(" · ")}</span> },
                    { label: "Sumber", cell: (t) => <span className="mono small">{t.pointer}</span> },
                  ]} />
              )}
              {tab === "pengembang" && (
                <ListTable rows={master.developers} rowKey={(d) => d.id} onRow={(d) => navigate(devHref(key, d.id))}
                  columns={[
                    { label: "Pengembang", cell: (d) => devName(board, d.id) },
                    { label: "id", num: true, cell: (d) => d.id },
                    { label: master.source.kind === "file" ? "Mesin di berkas" : "Urutan di spec", cell: (d) => (master.source.kind === "file" ? `M${d.machine + 1} (machine ${d.machine})` : `developers[${d.id}]`) },
                    { label: "Tugas yang bisa dikerjakan", num: true, cell: (d) => d.n_tasks },
                    { label: `Kapasitas (pengali ${angka(capacity)})`, num: true, cell: (d) => angka(board.assignees.find((a) => a.id === d.id)?.capacity, 2) },
                  ]} />
              )}
              {tab === "job" && (
                <ListTable rows={board.epics} rowKey={(e) => e.id} onRow={(e) => navigate(jobHref(key, e.id))}
                  columns={[
                    { label: "Job (epic)", cell: (e) => e.name },
                    { label: "id", num: true, cell: (e) => e.id },
                    { label: "Banyak operasi", num: true, cell: (e) => master.tasks.filter((t) => t.job === e.id).length },
                  ]} />
              )}
              {tab === "sumber" && (
                <>
                  <Fields>
                    <Field label="Jenis sumber">{master.source.kind === "file" ? "Berkas benchmark mentah" : "Proyek yang diketik pengguna"}</Field>
                    {master.source.path && <Field label="Berkas">
                      {master.source.url ? <a href={master.source.url} target="_blank" rel="noreferrer" className="mono">{master.source.path}</a> : <span className="mono">{master.source.path}</span>}</Field>}
                    {master.source.sha256 && <Field label="SHA-256"><span className="mono small">{master.source.sha256}</span></Field>}
                    <Field label="Ukuran di sumber">{master.source.n_jobs} job, {master.source.machines} {master.source.kind === "file" ? "mesin" : "pengembang"}, {master.tasks.length} operasi</Field>
                    <Field label="Faktor skala upaya" hint={master.source.scale === 1 ? "upaya = waktu proses di berkas, tanpa diubah" : "waktu proses di berkas dikali faktor ini supaya rata-rata upaya masuk rentang data latih"}>
                      <span className="mono">{angka(master.source.scale, 4)}</span></Field>
                  </Fields>
                  <h3 className="o-h3">Dari berkas ke proyek: enam langkah loader tesis</h3>
                  <ol className="o-steps">{STEPS.map(([t, d]) => <li key={t}><b>{t}.</b> {d}</li>)}</ol>
                  <p className="muted small">Parameter yang dipakai: {Object.entries(master.transform).map(([k, v]) => `${k} = ${v}`).join(", ")}.</p>
                </>
              )}
            </Notebook>
          </Sheet>
        </div>
      );
    }}</MasterGate>
  );
}
