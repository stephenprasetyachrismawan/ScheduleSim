// The list of runs opened in this browser, and examples to start from.
import { FlaskConical, Plus } from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { defaultSpec, recentRuns, specQuery } from "../../odoo/runUrl";
import { ControlBar, ListTable, Sheet } from "../../odoo/ui";
import { runHref } from "./common";

const EXAMPLES = [
  { label: "Kedai kopi (contoh kecil, 12 tugas)", spec: { ...defaultSpec("KOPI", 1.5), m: ["ppo_bc_ppo_g@0", "aor", "seq", "fix3_g", "acak_g"] } },
  { label: "MK01 Brandimarte (55 tugas, contoh di Bab IV)", spec: defaultSpec("MK01", 1.5) },
];

export default function RunList() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // old links: /simulasi?project=KOPI&cap=1.5
  const legacy = params.get("project");
  if (legacy) return <Navigate replace to={`/simulasi/baru?p=${legacy}&cap=${params.get("cap") ?? 1.5}`} />;
  const recent = recentRuns();
  return (
    <div className="o-page">
      <ControlBar crumbs={[{ label: "Simulasi" }]} right={
        <button className="btn btn--primary" onClick={() => navigate("/simulasi/baru")}><Plus size={15} />Baru</button>} />
      <Sheet title="Simulasi gangguan"
             subtitle="Setiap run memutar gangguan pada satu proyek, lalu setiap metode memperbaiki jadwal dengan caranya sendiri. Buka run, lalu metode, lalu kejadian. Setiap angka punya tanda ↗ untuk melihat asalnya.">
        <h3 className="o-h3">Mulai dari contoh</h3>
        <ListTable rows={EXAMPLES} rowKey={(e) => e.label} onRow={(e) => navigate(runHref(specQuery(e.spec)))}
          columns={[{ label: "Contoh", cell: (e) => <><FlaskConical size={14} className="muted" /> {e.label}</> },
                    { label: "Metode", cell: (e) => `${e.spec.m.length} metode` }]} />
        <h3 className="o-h3">Run yang pernah dibuka di browser ini</h3>
        <ListTable rows={recent} rowKey={(r) => r.q} onRow={(r) => navigate(runHref(r.q))}
          empty={<>Belum ada. Pilih contoh di atas, atau tekan <b>Baru</b> untuk mengatur run sendiri.</>}
          columns={[{ label: "Run", cell: (r) => <span className="mono">{r.label}</span> },
                    { label: "Dibuka", cell: (r) => new Date(r.at).toLocaleString("id-ID") }]} />
      </Sheet>
    </div>
  );
}
