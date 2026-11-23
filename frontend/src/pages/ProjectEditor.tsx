import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import type { ProjectSpec } from "../types";

const EMPTY: ProjectSpec = {
  key: "", name: "",
  developers: [{ name: "Pengembang 1" }, { name: "Pengembang 2" }],
  epics: [{ name: "Fitur 01", issues: [{ summary: "", efforts: { "0": 4 } }] }],
  links: [],
};

export default function ProjectEditor() {
  const { key } = useParams();
  const editing = !!key;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: ["project", key, 1.5], queryFn: () => api.project(key!, 1.5),
                              enabled: editing });
  const [spec, setSpec] = useState<ProjectSpec>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (existing.data?.spec) setSpec(existing.data.spec); }, [existing.data]);

  const save = useMutation({
    mutationFn: () => editing ? api.updateProject(key!, spec) : api.createProject(spec),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", r.key] });
      navigate(`/proyek/${r.key}?view=board`);
    },
    onError: (e) => setError((e as ApiError).message),
  });

  const upd = (f: (s: ProjectSpec) => void) => setSpec((s) => { const c = structuredClone(s); f(c); return c; });
  const allIssues = spec.epics.flatMap((e, ei) => e.issues.map((iss, ii) => ({ ei, ii, label: `${e.name} / ${iss.summary || `Tugas ${ii + 1}`}` })));

  return (
    <div className="page editor">
      <div className="crumbs"><Link to="/">Proyek</Link><ChevronRight size={13} />{editing ? key : "Proyek baru"}</div>
      <div className="page__head"><h1 className="page__title">{editing ? `Ubah proyek ${key}` : "Proyek baru"}</h1>
        <button className="btn btn--primary" style={{ marginLeft: "auto" }} onClick={() => { setError(null); save.mutate(); }}
                disabled={save.isPending}>Simpan proyek</button></div>
      <p className="page__sub">Issue dalam satu epic dikerjakan berurutan, seperti operasi dalam satu job. Isi upaya (jam)
        hanya untuk pengembang yang punya keahliannya; sel kosong berarti tidak bisa dikerjakan pengembang itu.
        Proyek melewati transformasi yang sama dengan instans tesis. Kebijakan dilatih pada tujuh instans
        Brandimarte, jadi proyek buatan sendiri berada di luar data latihnya.</p>
      {error && <div className="notice notice--error">{error}</div>}

      <div className="sheet" style={{ marginBottom: 16 }}>
        <div className="sheet__cols">
          <label className="field"><span>Key (2-10 huruf/angka)</span>
            <input className="input mono" value={spec.key} disabled={editing} maxLength={10}
                   onChange={(e) => upd((s) => { s.key = e.target.value.toUpperCase(); })} placeholder="TOKO" /></label>
          <label className="field"><span>Nama proyek</span>
            <input className="input" value={spec.name} onChange={(e) => upd((s) => { s.name = e.target.value; })}
                   placeholder="Toko daring" /></label>
        </div>
        <h2 className="section-title">Pengembang</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {spec.developers.map((d, i) => (
            <span key={i} className="who">
              <span className="mono muted small">M{i + 1}</span>
              <input className="input" value={d.name} style={{ width: 170 }}
                     onChange={(e) => upd((s) => { s.developers[i].name = e.target.value; })} />
              {spec.developers.length > 1 && i === spec.developers.length - 1 && (
                <button className="btn btn--ghost btn--sm" aria-label="hapus pengembang"
                        onClick={() => upd((s) => {
                          s.developers.pop();
                          for (const ep of s.epics) for (const is of ep.issues) delete is.efforts[String(i)];
                        })}><Trash2 size={14} /></button>)}
            </span>
          ))}
          <button className="btn btn--sm" onClick={() => upd((s) => { s.developers.push({ name: `Pengembang ${s.developers.length + 1}` }); })}>
            <Plus size={14} />Pengembang</button>
        </div>
      </div>

      {spec.epics.map((ep, ei) => (
        <div key={ei} className="sheet" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <span className="muted small">Epic {ei + 1}</span>
            <input className="input" value={ep.name} style={{ width: 260, fontWeight: 600 }}
                   onChange={(e) => upd((s) => { s.epics[ei].name = e.target.value; })} />
            {spec.epics.length > 1 && (
              <button className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }}
                      onClick={() => upd((s) => {
                        s.epics.splice(ei, 1);
                        s.links = s.links.filter((l) => l.from[0] !== ei && l.to[0] !== ei)
                          .map((l) => ({ from: [l.from[0] > ei ? l.from[0] - 1 : l.from[0], l.from[1]],
                                         to: [l.to[0] > ei ? l.to[0] - 1 : l.to[0], l.to[1]] }));
                      })}><Trash2 size={14} />Hapus epic</button>)}
          </div>
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>#</th><th>Ringkasan issue</th>
                {spec.developers.map((d, di) => <th key={di} className="num" title={d.name}>{d.name.split(" ")[0]} (j)</th>)}<th /></tr></thead>
              <tbody>
                {ep.issues.map((iss, ii) => (
                  <tr key={ii}>
                    <td className="muted mono">{ii + 1}</td>
                    <td><input className="input" style={{ width: "100%" }} value={iss.summary} placeholder={`Tugas ${ii + 1}`}
                               onChange={(e) => upd((s) => { s.epics[ei].issues[ii].summary = e.target.value; })} /></td>
                    {spec.developers.map((_, di) => (
                      <td key={di} className="num">
                        <input className="input effort" inputMode="decimal" value={iss.efforts[String(di)] ?? ""}
                               onChange={(e) => upd((s) => {
                                 const v = e.target.value.replace(",", ".");
                                 if (v === "") delete s.epics[ei].issues[ii].efforts[String(di)];
                                 else s.epics[ei].issues[ii].efforts[String(di)] = Number(v);
                               })} />
                      </td>
                    ))}
                    <td>{ep.issues.length > 1 && (
                      <button className="btn btn--ghost btn--sm" aria-label="hapus issue"
                              onClick={() => upd((s) => { s.epics[ei].issues.splice(ii, 1); s.links = []; })}><Trash2 size={14} /></button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn--sm" style={{ marginTop: 8 }}
                  onClick={() => upd((s) => { s.epics[ei].issues.push({ summary: "", efforts: { "0": 4 } }); })}>
            <Plus size={14} />Issue</button>
        </div>
      ))}
      <button className="btn" onClick={() => upd((s) => { s.epics.push({ name: `Fitur ${String(s.epics.length + 1).padStart(2, "0")}`, issues: [{ summary: "", efforts: { "0": 4 } }] }); })}>
        <Plus size={15} />Epic</button>

      <div className="sheet" style={{ marginTop: 16 }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Tautan antar-epic ("memblokir")</h2>
        {spec.links.map((l, n) => (
          <div key={n} className="who" style={{ marginBottom: 6 }}>
            <select className="select" value={`${l.from[0]}:${l.from[1]}`}
                    onChange={(e) => upd((s) => { const [a, b] = e.target.value.split(":").map(Number); s.links[n].from = [a, b]; })}>
              {allIssues.map((x) => <option key={`${x.ei}:${x.ii}`} value={`${x.ei}:${x.ii}`}>{x.label}</option>)}
            </select>
            <span className="muted">memblokir</span>
            <select className="select" value={`${l.to[0]}:${l.to[1]}`}
                    onChange={(e) => upd((s) => { const [a, b] = e.target.value.split(":").map(Number); s.links[n].to = [a, b]; })}>
              {allIssues.map((x) => <option key={`${x.ei}:${x.ii}`} value={`${x.ei}:${x.ii}`}>{x.label}</option>)}
            </select>
            <button className="btn btn--ghost btn--sm" onClick={() => upd((s) => { s.links.splice(n, 1); })}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn btn--sm" disabled={allIssues.length < 2}
                onClick={() => upd((s) => { s.links.push({ from: [0, 0], to: [Math.min(1, s.epics.length - 1), 0] }); })}>
          <Plus size={14} />Tautan</button>
      </div>
    </div>
  );
}
