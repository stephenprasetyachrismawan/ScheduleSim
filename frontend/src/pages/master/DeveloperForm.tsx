// Records of one developer and of one job (epic) in the master data.
import { useNavigate, useParams } from "react-router-dom";
import { angka } from "../../format";
import { ControlBar, Field, Fields, ListTable, Pager, Sheet } from "../../odoo/ui";
import { devHref, devName, jobHref, jobName, MasterGate, projectHref, useMaster } from "./common";

export function DeveloperForm() {
  const { key = "MK01", id: idParam = "0" } = useParams();
  const id = Number(idParam);
  const navigate = useNavigate();
  const m = useMaster(key);
  return (
    <MasterGate m={m}>{(master, board) => {
      const a = board.assignees.find((x) => x.id === id);
      const tasks = master.tasks.filter((t) => String(id) in t.eligible);
      const queue = board.issues.filter((i) => i.assignee_id === id).sort((x, y) => x.start - y.start);
      const keyOf = (tid: number) => `${key}-${tid + 1}`;
      return (
        <div className="o-page">
          <ControlBar crumbs={[{ label: "Proyek", to: "/" }, { label: key, to: projectHref(key) },
                               { label: "Pengembang", to: projectHref(key, "pengembang") }, { label: devName(board, id) }]}
            right={<Pager index={id} total={master.developers.length} label="Pengembang"
                          prev={id > 0 ? devHref(key, id - 1) : null}
                          next={id + 1 < master.developers.length ? devHref(key, id + 1) : null} />} />
          <Sheet title={devName(board, id)}>
            <Fields cols={3}>
              <Field label="id di kode dan naskah" hint="nomor di layar = id + 1"><span className="mono">{id}</span></Field>
              <Field label={master.source.kind === "file" ? "Di berkas" : "Di spec"}>
                <span className="mono">{master.source.kind === "file" ? `machine ${id} (M${id + 1})` : `developers[${id}]`}</span></Field>
              <Field label="Kapasitas (pengali 1,5)" hint="cap_j = pengali × (Σ upaya nominal / banyak pengembang); sama untuk semua pengembang">
                <span className="mono">{angka(a?.capacity, 2)}</span></Field>
            </Fields>
            <h3 className="o-h3">Tugas yang bisa dikerjakan ({tasks.length})</h3>
            <ListTable rows={tasks} rowKey={(t) => t.id} onRow={(t) => navigate(`/proyek/${key}/tugas/${t.id}`)}
              columns={[
                { label: "Tugas", cell: (t) => <span className="mono">{keyOf(t.id)}</span> },
                { label: "Job", cell: (t) => jobName(board, t.job) },
                { label: "Upaya (jam)", num: true, cell: (t) => angka(t.eligible[String(id)], 2) },
              ]} />
            <h3 className="o-h3">Antrean di jadwal awal S0 ({queue.length})</h3>
            <ListTable rows={queue} rowKey={(i) => i.id} onRow={(i) => navigate(`/proyek/${key}/tugas/${i.id}`)}
              empty="Pengembang ini tidak mendapat tugas di S0."
              columns={[
                { label: "Urutan", num: true, cell: (i) => queue.indexOf(i) + 1 },
                { label: "Tugas", cell: (i) => <span className="mono">{i.key}</span> },
                { label: "Mulai", num: true, cell: (i) => angka(i.start, 2) },
                { label: "Selesai", num: true, cell: (i) => angka(i.end, 2) },
                { label: "Tenggat", num: true, cell: (i) => angka(i.due, 2) },
              ]} />
          </Sheet>
        </div>
      );
    }}</MasterGate>
  );
}

export function JobForm() {
  const { key = "MK01", id: idParam = "0" } = useParams();
  const id = Number(idParam);
  const navigate = useNavigate();
  const m = useMaster(key);
  return (
    <MasterGate m={m}>{(master, board) => {
      const ops = master.tasks.filter((t) => t.job === id).sort((x, y) => x.op - y.op);
      return (
        <div className="o-page">
          <ControlBar crumbs={[{ label: "Proyek", to: "/" }, { label: key, to: projectHref(key) },
                               { label: "Job", to: projectHref(key, "job") }, { label: jobName(board, id) }]}
            right={<Pager index={id} total={board.epics.length} label="Job" prev={id > 0 ? jobHref(key, id - 1) : null}
                          next={id + 1 < board.epics.length ? jobHref(key, id + 1) : null} />} />
          <Sheet title={jobName(board, id)}
            subtitle={master.source.kind === "file"
              ? <>Job {id + 1} di berkas (<span className="mono">jobs[{id}]</span>): {ops.length} operasi yang harus dikerjakan berurutan.</>
              : <>Epic {id + 1} di proyek ini: {ops.length} issue yang dikerjakan berurutan.</>}>
            <ListTable rows={ops} rowKey={(t) => t.id} onRow={(t) => navigate(`/proyek/${key}/tugas/${t.id}`)}
              columns={[
                { label: "Operasi", num: true, cell: (t) => t.op + 1 },
                { label: "Tugas", cell: (t) => <span className="mono">{key}-{t.id + 1}</span> },
                { label: "id", num: true, cell: (t) => t.id },
                { label: "Pengembang layak: upaya (jam)", cell: (t) => <span className="small">{Object.entries(t.eligible).map(([d, v]) => `${devName(board, Number(d))}: ${angka(v, 2)}`).join(" · ")}</span> },
                { label: "Menunggu lintas job", cell: (t) => t.deps.filter((d) => d.kind === "lintas").map((d) => `${key}-${d.id + 1}`).join(", ") || "–" },
              ]} />
          </Sheet>
        </div>
      );
    }}</MasterGate>
  );
}
