import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FlaskConical, Lock, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Spinner } from "../components/atoms";
import type { ViewName } from "../components/ControlPanel";
import Workspace from "../components/Workspace";
import { angka } from "../format";

export default function ProjectPage() {
  const { key = "MK01" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const view = (params.get("view") as ViewName) ?? "list";
  const capacity = Number(params.get("cap") ?? 1.5);
  const selected = params.get("issue");
  const q = useQuery({ queryKey: ["project", key, capacity], queryFn: () => api.project(key, capacity),
                       retry: false });
  const del = useMutation({
    mutationFn: () => api.deleteProject(key),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); navigate("/"); },
  });
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v === null ? n.delete(k) : n.set(k, v);
    setParams(n, { replace: true });
  };

  if (q.isLoading) return <div className="page"><Spinner /> <span className="muted">Menyusun jadwal awal…</span></div>;
  if (q.error) {
    const e = q.error as ApiError;
    return (
      <div className="page">
        <div className={`notice ${e.status === 403 ? "notice--warn" : "notice--error"}`}>
          {e.status === 403 && <Lock size={16} />}<span>{e.message}</span></div>
        {e.status === 403 && <Link to="/hasil-uji" className="btn">Buka Hasil uji tesis</Link>}
      </div>
    );
  }
  const d = q.data!;
  const late = d.issues.filter((i) => i.late).length;
  return (
    <div className="page">
      <div className="crumbs"><Link to="/">Proyek</Link><ChevronRight size={13} />{d.project.group}
        <ChevronRight size={13} /><span className="mono">{d.project.key}</span></div>
      <div className="page__head">
        <h1 className="page__title">{d.project.name}</h1>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {d.project.editable && (
            <>
              <Link to={`/proyek/${key}/ubah`} className="btn"><Pencil size={15} />Ubah proyek</Link>
              <button className="btn btn--danger" onClick={() => {
                if (confirm(`Hapus proyek ${key}? Tindakan ini tidak bisa dibatalkan.`)) del.mutate();
              }}><Trash2 size={15} />Hapus</button>
            </>
          )}
          <Link to={`/simulasi?project=${key}&cap=${capacity}`} className="btn btn--primary">
            <FlaskConical size={15} />Simulasikan gangguan</Link>
        </span>
      </div>
      <p className="page__sub">
        Jadwal awal S0 pada t = 0 dengan kapasitas {angka(capacity)}: {d.issues.length} issue,{" "}
        {d.assignees.length} pengembang, {d.epics.length} epic. {late > 0
          ? `${late} issue sudah selesai melewati tenggat di S0.`
          : "Semua issue selesai sebelum tenggat, karena tenggat diturunkan dari S0."}{" "}
        Gangguan dan perbaikan jadwal muncul di halaman Simulasi.
      </p>
      <Workspace issues={d.issues} assignees={d.assignees} epics={d.epics} history={[]}
                 view={view} onView={(v) => set({ view: v })} selected={selected}
                 onSelect={(k) => set({ issue: k })} t={0} initialText={params.get("q") ?? ""}
                 panelExtra={
                   <label className="who small">Kapasitas
                     <select className="select" value={capacity} onChange={(e) => set({ cap: e.target.value })}>
                       {[1.0, 1.5, 2.0].map((c) => <option key={c} value={c}>{angka(c)}</option>)}
                     </select>
                   </label>
                 } />
    </div>
  );
}
