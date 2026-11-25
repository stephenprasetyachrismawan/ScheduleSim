import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { LEVEL_NAMES, LEVEL_SHORT, Ladder, LevelChip } from "../components/atoms";
import { HistoryList } from "../components/views/IssueForm";
import { angka } from "../format";
import { Info } from "../learn/Learn";
import type { Disruption, Frame, Sub } from "../types";

const OUTCOME: Record<Sub["outcome"], string> = {
  dipakai: "dipakai", ditolak_penjaga: "ditolak guard", gagal: "operator gagal",
  tingkat_0: "tingkat 0", aor: "tanpa perbaikan", manual_geser: "geser kartu",
};

function describe(d: Disruption, devName: (id: number) => string, keyOf: (id: number) => string): string {
  const p = d.payload as Record<string, number>;
  switch (d.type) {
    case "urgent_task": return `estimasi ${angka(p.effort)} j, prioritas ${angka(p.priority, 2)}`;
    case "effort_revision": return `${keyOf(p.task_id)}, faktor ×${angka(p.factor, 2)}`;
    case "rework_review_fail": return `${keyOf(p.task_id)}, tambahan ${angka(p.extra_effort)} j`;
    case "priority_change": return keyOf(p.task_id);
    case "developer_unavailable": return `${devName(p.dev_id)} selama ${angka(p.duration)} j`;
    default: return "";
  }
}

interface Props {
  frame: Frame;
  total: number;
  onOpenIssue: (key: string) => void;
  manualLevels?: {
    pending: Record<number, number>;
    onChoose: (j: number, level: number) => void;
    onApply: () => void;
    busy: boolean;
  };
}

export default function DecisionPanel({ frame, total, onOpenIssue, manualLevels }: Props) {
  const ev = frame.event;
  const lam = frame.meta.lam;
  const [featuresOf, setFeaturesOf] = useState<number | null>(null);
  const devName = (id: number) => frame.assignees.find((a) => a.id === id)?.name ?? `Pengembang ${id + 1}`;
  const keyOf = (id: number) => frame.issues.find((i) => i.id === id)?.key ?? `issue ${id + 1}`;
  const changes = frame.history.filter((h) => h.event === ev.index && (h.kind === "assignee" || h.kind === "rank"));
  const learned = frame.meta.method.startsWith("ppo_") || frame.meta.method.startsWith("il_");
  const ppoFile = frame.meta.model_seed !== null
    ? frame.meta.model_files.find((f) => f.path === `e9c_s${frame.meta.model_seed}/${frame.meta.method === "ppo_bc_g" ? "bc.zip" : "bc_ppo.zip"}`)
    : null;

  return (
    <aside className="decision" aria-label="Laporan keputusan">
      <h3>Kejadian {ev.index + 1} dari {total}</h3>
      <div className="muted small">jam ke-{angka(ev.time)} · {frame.meta.method_name} · λ = {angka(lam, lam < 1 ? 1 : 0)}</div>

      <h4>Nilai <Info term="J" /></h4>
      <div className="kv">
        <span>Tard/E sebelum gangguan (①)</span><span>{angka(ev.tard_before, 3)}</span>
        <span>Tard/E sesudah gangguan masuk (②)</span><span>{angka(ev.tard_aor, 3)}</span>
        <span>Tard/E sesudah perbaikan (③)</span><span>{angka(ev.tard_after, 3)}</span>
        <span>Perubahan U keputusan ini</span><span>{ev.changes}</span>
        <span>J keputusan = Tard/E + λ·U</span><span>{angka(ev.J_after_batch, 3)}</span>
      </div>

      <h4>Gangguan ({ev.disruptions.length}) <Info term="disruption" /></h4>
      {ev.disruptions.map((d, n) => (
        <div key={n} className="dis">
          <span className="mono small muted" style={{ minWidth: 54 }}>{angka(d.time)}</span>
          <span><strong>{d.label}</strong><br /><span className="muted small">{describe(d, devName, keyOf)}</span></span>
        </div>
      ))}

      <h4>Keputusan per gangguan <Info term="subdecision" /></h4>
      {ev.subs.map((s) => {
        const affected = ev.affected[s.j];
        const opts = s.options ? Object.entries(s.options).map(([k, v]) => [Number(k), v] as [number, number]) : [];
        const best = opts.length ? Math.min(...opts.map(([, v]) => v)) : null;
        const worst = opts.length ? Math.max(...opts.map(([, v]) => v)) : null;
        const allowed = s.mask ? [1, ...s.mask] : [1, 1, 1, 1];
        const choice = manualLevels?.pending[s.j];
        return (
          <div key={s.j} className="sub">
            <div className="sub__head">
              <strong>{s.j + 1}. {affected?.label ?? s.type}</strong>
              <span className={`outcome outcome--${s.outcome}`}>{OUTCOME[s.outcome]}</span>
            </div>
            <div className="small muted" style={{ margin: "4px 0", display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
              <span>A_j ({affected?.issues.length ?? 0}):</span>
              {affected?.issues.length ? affected.issues.map((k) => (
                <span key={k} className="key key--link" onClick={() => onOpenIssue(k)}>{k}</span>
              )) : <span>kosong</span>}
            </div>
            {s.requested !== null && s.used !== null && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                {s.requested !== s.used && <span title="tingkat yang diminta selector"><LevelChip level={s.requested} muted /></span>}
                <LevelChip level={s.used} />
              </div>
            )}
            {(s.probs || opts.length > 0) && (
              <div style={{ marginTop: 6 }}>
                <div className="sub__row small muted"><span /><span>{s.probs ? "peluang dari kebijakan" : "J tiap tingkat"}</span><span className="num">J</span></div>
                {[0, 1, 2, 3].map((lv) => {
                  const p = s.probs?.[lv];
                  const v = s.options?.[String(lv)];
                  const okLevel = allowed[lv] === 1;
                  const width = p !== undefined ? p * 100
                    : v !== undefined && best !== null && worst !== null && worst > best ? 100 - 80 * (v - best) / (worst - best) : v !== undefined ? 100 : 0;
                  return (
                    <div key={lv} className="sub__row" style={{ opacity: okLevel ? 1 : 0.45 }}>
                      {manualLevels ? (
                        <button className={`btn btn--sm ${choice === lv ? "btn--primary" : ""}`} disabled={!okLevel}
                                onClick={() => manualLevels.onChoose(s.j, lv)} title={LEVEL_NAMES[lv]}>{LEVEL_SHORT[lv]}</button>
                      ) : (
                        <span className="who small" title={LEVEL_NAMES[lv]}><Ladder level={lv} />{LEVEL_SHORT[lv]}</span>
                      )}
                      <div className="bar" title={okLevel ? (p !== undefined ? `${angka(p * 100, 1)}%` : "") : "tidak sah (mask)"}>
                        <i style={{ width: `${width}%`, background: s.used === lv ? `var(--lv${lv})` : "var(--line-strong)" }} />
                      </div>
                      <span className={`num small ${v !== undefined && v === best ? "" : "muted"}`}
                            style={{ fontWeight: v !== undefined && v === best ? 700 : 400 }}>
                        {okLevel ? (v !== undefined ? angka(v, 2) : "–") : "tidak sah"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="small" style={{ marginTop: 6 }}>
              J {angka(s.J_before, 3)} → <strong>{angka(s.J_after, 3)}</strong>
              {s.outcome === "ditolak_penjaga" && s.J_candidate !== undefined && (
                <span className="muted"> · usulan {LEVEL_SHORT[s.requested ?? 0]} memberi J {angka(s.J_candidate, 3)}, jadi guard menolak</span>
              )}
            </div>
            {s.features && (
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 4, paddingLeft: 0 }}
                      onClick={() => setFeaturesOf(featuresOf === s.j ? null : s.j)}>
                {featuresOf === s.j ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                38 angka keadaan yang dibaca {learned ? "kebijakan" : "selector"}
              </button>
            )}
            {featuresOf === s.j && s.features && (
              <table className="feature-table"><tbody>
                {s.features.map((v, n) => (
                  <tr key={n}><td className="muted">{n + 1}</td><td>{frame.meta.feature_names[n]}</td>
                    <td className="num">{angka(v, 3)}</td></tr>
                ))}
              </tbody></table>
            )}
          </div>
        );
      })}
      {manualLevels && (
        <button className="btn btn--primary" style={{ width: "100%" }} disabled={manualLevels.busy}
                onClick={manualLevels.onApply}>Terapkan pilihan untuk kejadian {ev.index + 1}</button>
      )}

      <h4>Perubahan yang dihitung (U = {ev.changes}) <Info term="U" /></h4>
      <HistoryList entries={changes} empty="Tidak ada perubahan urutan atau assignee pada keputusan ini." />

      {ppoFile && (
        <div className="notice" style={{ marginTop: 16 }}>
          <ShieldCheck size={16} style={{ flex: "none" }} />
          <span className="small">Model <span className="mono">{ppoFile.path}</span>, SHA-256{" "}
            <span className="mono">{ppoFile.sha256.slice(0, 12)}…</span>, sama dengan dokumen kunci uji.</span>
        </div>
      )}
    </aside>
  );
}
