import { useQuery } from "@tanstack/react-query";
import { scaleLinear } from "d3-scale";
import { useState } from "react";
import { api, type Interval } from "../api";
import { Spinner } from "../components/atoms";
import { angka, lambdaLabel, persen } from "../format";

// two series, validated with the dataviz palette checker (CVD ΔE 31,5); shapes add a second cue
const SERIES = [
  { key: "uk1" as const, label: "uk. 1 (rata-rata rasio per kondisi)", color: "#1d5bd8", shape: "circle" },
  { key: "uk2" as const, label: "uk. 2 (rasio total)", color: "#d9770b", shape: "square" },
];
const NAMES: Record<string, string> = {
  acak_g: "Random + guard", fix3_g: "Fixed-L3 + guard", aor: "AOR", seq: "Sequential Lookahead",
  il_g: "Boosting-IL + guard", ppo_bc_g: "ARLS-BC", ppo_bc_ppo: "ARLS-PPO tanpa guard",
  ppo_bc_ppo_g: "ARLS-PPO",
};

interface Row { label: string; sub?: string; values: Record<"uk1" | "uk2", Interval> }

function Forest({ rows, caption }: { rows: Row[]; caption: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const W = 760, left = 230, right = 24, rowH = 52, top = 30, bottom = 34;
  const all = rows.flatMap((r) => SERIES.flatMap((s) => [r.values[s.key][1], r.values[s.key][2]]));
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const pad = (hi - lo) * 0.08;
  const x = scaleLinear().domain([lo - pad, hi + pad]).nice().range([left, W - right]);
  const ticks = x.ticks(7);
  const H = top + rows.length * rowH + bottom;
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={caption} style={{ maxWidth: W }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={top - 6} y2={H - bottom} stroke={v === 0 ? "var(--ink-2)" : "var(--surface-2)"}
                  strokeWidth={v === 0 ? 1.4 : 1} />
            <text x={x(v)} y={H - bottom + 16} fontSize={11} textAnchor="middle" fill="var(--ink-3)"
                  fontFamily="var(--font-mono)">{persen(v, 0)}</text>
          </g>
        ))}
        <text x={x(0)} y={top - 12} fontSize={11} textAnchor="middle" fill="var(--ink-2)">0 = sama dengan pembanding</text>
        <text x={(left + W - right) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--ink-3)">
          selisih J ARLS-PPO terhadap pembanding (negatif berarti ARLS-PPO lebih baik)</text>
        {rows.map((r, k) => {
          const y0 = top + k * rowH;
          return (
            <g key={k}>
              {k > 0 && <line x1={0} x2={W} y1={y0} y2={y0} stroke="var(--surface-2)" />}
              <text x={0} y={y0 + rowH / 2 - 2} fontSize={13} fill="var(--ink)" fontWeight={600}>{r.label}</text>
              {r.sub && <text x={0} y={y0 + rowH / 2 + 14} fontSize={11.5} fill="var(--ink-3)">{r.sub}</text>}
              {SERIES.map((s, n) => {
                const [est, a, b] = r.values[s.key];
                const y = y0 + 16 + n * 20;
                const text = `${r.label}${r.sub ? `, ${r.sub}` : ""} · ${s.label}: ${persen(est)} [${persen(a)}; ${persen(b)}]`;
                return (
                  <g key={s.key} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text })}
                     onMouseLeave={() => setTip(null)} style={{ cursor: "default" }}>
                    <rect x={left} y={y - 9} width={W - left - right} height={18} fill="transparent" />
                    <line x1={x(a)} x2={x(b)} y1={y} y2={y} stroke={s.color} strokeWidth={2} strokeLinecap="round" />
                    <line x1={x(a)} x2={x(a)} y1={y - 5} y2={y + 5} stroke={s.color} strokeWidth={2} />
                    <line x1={x(b)} x2={x(b)} y1={y - 5} y2={y + 5} stroke={s.color} strokeWidth={2} />
                    {s.shape === "circle"
                      ? <circle cx={x(est)} cy={y} r={4.5} fill={s.color} stroke="var(--canvas)" strokeWidth={2} />
                      : <rect x={x(est) - 4.5} y={y - 4.5} width={9} height={9} fill={s.color} stroke="var(--canvas)" strokeWidth={2} />}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <figcaption className="legend" style={{ marginTop: 6 }}>
        {SERIES.map((s) => (
          <span key={s.key}><svg width={22} height={10} style={{ verticalAlign: "middle", marginRight: 6 }}>
            <line x1={1} x2={21} y1={5} y2={5} stroke={s.color} strokeWidth={2} />
            {s.shape === "circle" ? <circle cx={11} cy={5} r={4} fill={s.color} /> : <rect x={7} y={1} width={8} height={8} fill={s.color} />}
          </svg>{s.label}</span>
        ))}
        <span className="muted">{caption}</span>
      </figcaption>
      {tip && <div className="tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.text}</div>}
    </figure>
  );
}

function IntervalCell({ v }: { v: Interval }) {
  return <span className="mono">{persen(v[0])} <span className="muted">[{persen(v[1])}; {persen(v[2])}]</span></span>;
}

export default function ResultsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["results"], queryFn: api.results, staleTime: Infinity });
  if (isLoading || !data) return <div className="page"><Spinner /></div>;
  const ppoTime = data.time.ppo_bc_ppo_g;
  const episodes = Object.values(data.violations).reduce((a, v) => a + v.episode, 0);
  const hard = Object.values(data.violations).reduce((a, v) => a + v.keras, 0);
  const mainRows: Row[] = [];
  for (const m of ["acak_g", "fix3_g"]) for (const lam of ["0.3", "3.0"])
    mainRows.push({ label: NAMES[m], sub: `λ = ${lambdaLabel(Number(lam))} · ${data.claims[m][lam]}`,
                    values: data.main[m][lam] });

  return (
    <div className="page">
      <div className="crumbs">Tesis</div>
      <div className="page__head"><h1 className="page__title">Hasil uji tesis</h1></div>
      <p className="page__sub">Angka di halaman ini dibaca dari berkas hasil Bab V di repositori arls-ppo. Data uji
        (MK03, MK04, MK09 dengan seed 10000-10009 dan 35 benchmark uji dengan seed 11000-11004) dibuka satu kali pada
        19 November 2026 untuk resep E15 E9c dan tidak disimulasikan ulang di ScheduleSim.</p>

      <div className="stat-row">
        <div className="stat"><div className="stat__label">I-1 · p95 waktu selector ARLS-PPO, maksimum per instans</div>
          <div className="stat__value">{angka(ppoTime?.p95_pemilih_maks ?? null, 2)} ms</div>
          <div className="small muted">batas 50 ms · {ppoTime?.di_bawah_50ms ? "tercapai" : "tidak tercapai"}</div></div>
        <div className="stat"><div className="stat__label">I-2 · pelanggaran keras pemeriksa jadwal</div>
          <div className="stat__value">{hard}</div>
          <div className="small muted">dari {angka(episodes, 0)} episode uji, semua metode</div></div>
      </div>

      <h2 className="section-title">Klaim utama: ARLS-PPO lawan pembanding aturan dan acak</h2>
      <p className="page__sub" style={{ margin: "0 0 10px" }}>Selang 98,75% (koreksi Bonferroni untuk empat uji), bootstrap bergugus
        (instans, intensitas, seed) dengan strata instans, tiap instans berbobot sama. "Lebih baik" hanya ditulis bila
        kedua ukuran seluruhnya di bawah 0.</p>
      <Forest rows={mainRows} caption="selang 98,75%" />
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="grid">
          <thead><tr><th>Pembanding</th><th>λ</th><th>uk. 1</th><th>uk. 2</th><th>Kalimat di tesis</th></tr></thead>
          <tbody>
            {mainRows.map((r, k) => (
              <tr key={k}><td>{r.label}</td><td className="mono">{r.sub?.split(" · ")[0].replace("λ = ", "")}</td>
                <td><IntervalCell v={r.values.uk1} /></td><td><IntervalCell v={r.values.uk2} /></td>
                <td><strong>{r.sub?.split(" · ")[1]}</strong></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Semua λ (selang pelengkap 95%)</h2>
      {["acak_g", "fix3_g"].map((m) => (
        <div key={m} style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{NAMES[m]}</div>
          <Forest caption="selang 95%, pelengkap"
                  rows={Object.entries(data.combined[m]).map(([lam, v]) => ({ label: `λ = ${lambdaLabel(Number(lam))}`, values: v }))} />
        </div>
      ))}

      <h2 className="section-title">Butir 1: celah ke Sequential di λ tanpa label</h2>
      <div className="table-wrap">
        <table className="grid">
          <thead><tr><th>Pasangan λ</th><th>uk. 1</th><th>uk. 2</th></tr></thead>
          <tbody>
            {Object.entries(data.item1).map(([pair, v]) => (
              <tr key={pair}><td>{pair}</td><td><IntervalCell v={v.uk1} /></td><td><IntervalCell v={v.uk2} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Satuan: poin persen. Di tesis, batas atas selang ditulis "paling banyak X poin lebih besar".</p>

      <h2 className="section-title">Pelanggaran keras per metode (I-2)</h2>
      <div className="table-wrap" style={{ maxWidth: 640 }}>
        <table className="grid">
          <thead><tr><th>Metode</th><th className="num">Episode</th><th className="num">Pelanggaran keras</th></tr></thead>
          <tbody>
            {Object.entries(data.violations).map(([m, v]) => (
              <tr key={m}><td>{NAMES[m] ?? m}</td><td className="num">{angka(v.episode, 0)}</td><td className="num">{v.keras}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
