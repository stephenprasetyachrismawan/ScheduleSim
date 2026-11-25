// "Log hitung": where every number of the episode comes from, step by step.
// Every number shown here was recorded by arls-ppo (trace_episode with explain=True) at the
// moment the thesis code computed it, and checked against it there. This file only lays the
// numbers out; it computes nothing that the episode uses.
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronRight, Copy, Download, RefreshCw, XCircle } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { LEVEL_NAMES, LEVEL_SHORT, Ladder, Spinner } from "../components/atoms";
import { angka, lambdaLabel } from "../format";
import { Info } from "../learn/Learn";
import type {
  EffectLog, EpisodeLog, EventLog, FeatureItem, LevelValue, LogNames, QueueRow, SubLog,
} from "../types";

const STATUS: Record<string, string> = {
  not_started: "belum mulai", in_progress: "sedang dikerjakan", completed: "selesai",
};
const OUTCOME_TEXT: Record<string, string> = {
  dipakai: "dipakai", ditolak_penjaga: "ditolak guard", gagal: "operator gagal",
  tingkat_0: "tingkat 0", aor: "AOR", manual_geser: "geser kartu",
};

const a4 = (v: unknown) => angka(typeof v === "number" ? v : null, 4);

interface Namer {
  key: (id: number) => string;
  dev: (id: number) => string;
  dis: (type: string) => string;
}

function namer(names: LogNames, types: Record<string, string>): Namer {
  return {
    key: (id) => `${names.project}-${id + 1}`,
    dev: (id) => names.devs[String(id)] ?? `Pengembang ${id + 1}`,
    dis: (t) => types[t] ?? t,
  };
}

// ------------------------------------------------------------------ building blocks
function Step({ n, title, term, code, children, open: initial = true }: {
  n: string; title: string; term?: string; code?: string; children: ReactNode; open?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  return (
    <section className={`step ${open ? "step--open" : ""}`}>
      <header className="step__head">
        <button className="step__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="step__n">{n}</span>
          <span className="step__title">{title}</span>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        {term && <Info term={term} />}
      </header>
      {open && <div className="step__body">
        {children}
        {code && <div className="step__code">Kode: <span className="mono">{code}</span></div>}
      </div>}
    </section>
  );
}

/** One line of arithmetic: the formula, the same formula with numbers, and the result. */
function Calc({ formula, subst, result }: { formula: string; subst?: string; result: string }) {
  return (
    <div className="calc">
      <span className="calc__f">{formula}</span>
      {subst && <span className="calc__s">= {subst}</span>}
      <span className="calc__r">= {result}</span>
    </div>
  );
}

function Fold({ label, children, initial = false }: { label: string; children: ReactNode;
                                                    initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="fold">
      <button className="fold__btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{label}
      </button>
      {open && <div className="fold__body">{children}</div>}
    </div>
  );
}

function Ok({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <div className={`check-line ${ok ? "check-line--ok" : "check-line--bad"}`}>
      {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{ok ? yes : no}
    </div>
  );
}

const TASK_KEYS = /tugas|A_j|siap|irisan|kelebihan|penerima|daftar/i;

/** The inputs of one state number: scalars, task lists and small tables, with names. */
function Inputs({ inputs, nm }: { inputs: Record<string, unknown>; nm: Namer }) {
  const cell = (k: string, v: unknown): ReactNode => {
    if (typeof v === "number") {
      if (/(^|\s)(tugas|pengembang|dev|dari|ke)$/i.test(k)) {
        return /pengembang|dev|dari|ke/i.test(k) ? nm.dev(v) : nm.key(v);
      }
      return Number.isInteger(v) ? String(v) : a4(v);
    }
    if (typeof v === "boolean") return v ? "ya" : "tidak";
    if (v === null || v === undefined) return "–";
    if (Array.isArray(v)) {
      if (v.length === 0) return <span className="muted">kosong</span>;
      if (v.every((x) => typeof x === "number")) {
        const list = v as number[];
        const named = TASK_KEYS.test(k) ? list.map(nm.key)
          : /pengembang/i.test(k) ? list.map(nm.dev) : list.map((x) => cell("", x));
        return <span className="chips">{named.map((x, i) => <span key={i} className="chip">{x}</span>)}</span>;
      }
      if (v.every((x) => Array.isArray(x))) {
        return <span className="chips">{(v as number[][]).map((p, i) => (
          <span key={i} className="chip">{nm.key(p[0])} → {nm.dev(p[1])}</span>))}</span>;
      }
      if (v.every((x) => x && typeof x === "object")) {
        const rows = v as Record<string, unknown>[];
        const cols = Object.keys(rows[0]);
        return (
          <table className="mini"><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 40).map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c}>{cell(c, r[c])}</td>)}</tr>))}</tbody>
            {rows.length > 40 && <caption>{rows.length - 40} baris lagi tidak ditampilkan</caption>}
          </table>
        );
      }
    }
    if (typeof v === "object") {
      return <Inputs inputs={v as Record<string, unknown>} nm={nm} />;
    }
    return String(v);
  };
  return (
    <div className="inputs">
      {Object.entries(inputs).map(([k, v]) => (
        <div key={k} className="inputs__row"><span className="inputs__k">{k}</span>
          <span className="inputs__v">{cell(k, v)}</span></div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ input
function InputSection({ ep, nm }: { ep: EpisodeLog; nm: Namer }) {
  const inp = ep.input, dis = ep.disruptions;
  if (!inp || !dis) return <p className="muted">Log input tidak tersedia untuk run ini.</p>;
  const first = inp.tasks[0];
  return (
    <>
      <Step n="I-1" title="Instans menjadi proyek" term="instance" code="instans_acak.load_any">
        <p>{inp.instance}: {inp.n_tasks} tugas dalam {inp.n_jobs} epic (job), dikerjakan {inp.n_devs} pengembang.</p>
      </Step>
      <Step n="I-2" title="Kapasitas pengembang" term="capacity" code="dfjsp.core.domain.set_capacity">
        <Calc formula="cap_j = m × (Σ upaya nominal / banyak pengembang)"
              subst={`${angka(inp.capacity.m, 1)} × (${a4(inp.capacity.total_nominal)} / ${inp.capacity.n_devs})`}
              result={a4(inp.capacity.value)} />
        <p className="small muted">Upaya nominal sebuah tugas = rata-rata upayanya di semua pengembang yang layak.</p>
      </Step>
      <Step n="I-3" title="Jadwal awal S0 dan tenggat" term="s0" code="dfjsp.env.initial_schedule.build_initial_schedule">
        <p className="small">{inp.s0_rule}.</p>
        <Ok ok={inp.s0_rebuilt_equal} yes="S0 dibangun ulang dari berkas instans dan hasilnya sama persis dengan S0 episode ini."
            no="S0 yang dibangun ulang berbeda dari S0 episode ini." />
        {first && <Calc formula="d_i = C_i + 0,5 × (C_i − S_i)"
                        subst={`${a4(first.C)} + 0,5 × (${a4(first.C)} − ${a4(first.S)})  (${nm.key(first.tugas)})`}
                        result={a4(first.d)} />}
        <Fold label={`Semua ${inp.tasks.length} tugas di S0`}>
          <table className="mini mini--wide"><thead><tr><th>Issue</th><th>Pengembang</th><th>S</th><th>C</th>
            <th>Upaya</th><th>Tenggat TWK (urutan S0)</th><th>d = C + 0,5·upaya</th></tr></thead>
            <tbody>{inp.tasks.map((t) => (
              <tr key={t.tugas}><td>{nm.key(t.tugas)}</td><td>{nm.dev(t.pengembang)}</td><td>{a4(t.S)}</td>
                <td>{a4(t.C)}</td><td>{a4(t.upaya)}</td><td>{a4(t.d_twk)}</td><td>{a4(t.d)}</td></tr>))}</tbody>
          </table>
        </Fold>
      </Step>
      <Step n="I-4" title="Rata-rata upaya E" term="E" code="LadderRepairEnv._ensure_mean_effort">
        <Calc formula="E = Σ (C_i − S_i) di S0 / banyak tugas" subst={`${a4(inp.E.sum)} / ${inp.E.n}`}
              result={a4(inp.E.value)} />
        <p className="small muted">E menjadi satuan keterlambatan di J dan di beberapa angka keadaan.</p>
      </Step>
      <Step n="I-5" title="Gangguan dari seed episode" term="seed" code="derive_episode_seed, TawosDisruptionModel.sample_timeline">
        <p className="small">{dis.seed_rule}.</p>
        <Inputs inputs={dis.seed_inputs} nm={nm} />
        <Calc formula="seed gangguan" result={String(dis.seed)} />
        <p className="small">Generator: <span className="mono">{dis.generator}</span>. Horizon {a4(dis.horizon)} jam,
          {" "}{dis.n} tugas.</p>
        <table className="mini mini--wide"><tbody>{Object.entries(dis.params).map(([k, v]) => (
          <tr key={k}><td>{k}</td><td className="num">{a4(v)}</td></tr>))}</tbody></table>
        <p className="small">{dis.window_rule} (E = {a4(dis.window)}).</p>
        <p className="small">Terjadi: {Object.entries(dis.counts).map(([t, c]) => `${c} ${nm.dis(t).toLowerCase()}`).join(", ")};
          digabung menjadi {dis.events.length} kejadian.</p>
        <Ok ok={dis.regenerated_equal} yes="Daftar gangguan ditarik ulang dari seed yang sama dan hasilnya sama persis."
            no="Penarikan ulang dari seed memberi daftar yang berbeda." />
        <Fold label="Semua kejadian dan anggotanya">
          <table className="mini mini--wide"><thead><tr><th>#</th><th>Waktu keputusan</th><th>Gangguan</th></tr></thead>
            <tbody>{dis.events.map((g, i) => (
              <tr key={i}><td>{i + 1}</td><td>{a4(g.time)}</td>
                <td>{g.members.map((m) => `${nm.dis(m.type)} (${a4(m.time)})`).join("; ")}</td></tr>))}</tbody>
          </table>
        </Fold>
      </Step>
    </>
  );
}

// ------------------------------------------------------------------ process
function decisionText(d: NonNullable<SubLog["decision"]>): string {
  const L = (lv: number) => `${LEVEL_SHORT[lv]} ${LEVEL_NAMES[lv]}`;
  switch (d.rule) {
    case "guard":
      return d.accepted
        ? `Guard: J calon ${a4(d.J_candidate)} tidak lebih besar daripada J sekarang ${a4(d.J_now)}, jadi ${L(d.requested)} dipakai.`
        : `Guard: J calon ${a4(d.J_candidate)} lebih besar daripada J sekarang ${a4(d.J_now)}, jadi ${L(d.requested)} ditolak dan tingkat 0 dipakai.`;
    case "tanpa_guard":
      return `Tanpa guard: ${L(d.requested)} langsung dipakai (J ${a4(d.J_now)} → ${a4(d.J_candidate)}), walaupun J bisa naik.`;
    case "tingkat_0":
      return "Selector meminta tingkat 0, jadi jadwal saat ini dipertahankan untuk gangguan ini.";
    case "operator_gagal":
      return `Operator ${L(d.requested)} tidak menemukan perbaikan yang sah, jadi tingkat 0 dipakai.`;
    case "teacher":
      return `Sequential Lookahead mencoba ketiga tingkat lalu memakai J terkecil (${L(d.used)}); bila J sama, tingkat 0 diutamakan, lalu tingkat yang lebih rendah.`;
    default:
      return d.text;
  }
}

function effectText(e: EffectLog, nm: Namer): ReactNode {
  const d = (e.detail ?? {}) as Record<string, number & string>;
  switch (e.type) {
    case "urgent_task":
      return d.tugas_baru === undefined ? null : <>
        <p>{nm.key(d.tugas_baru)} dibuat dan masuk ke akhir antrean {nm.dev(d.pengembang)}: upaya {a4(d.upaya)} jam,
          prioritas {angka(d.prioritas, 2)}, mulai {a4(d.mulai)}, selesai {a4(d.selesai)}.</p>
        {d.aturan_tenggat === "segera"
          ? <Calc formula={'tenggat (aturan "segera") = t + (1 + slack) × upaya'}
                  subst={`${a4(d.t)} + (1 + ${angka(d.due_slack, 1)}) × ${a4(d.upaya)}`} result={a4(d.tenggat)} />
          : <Calc formula={'tenggat (aturan "antrean") = selesai di akhir antrean + slack × upaya'}
                  subst={`${a4(d.selesai)} + ${angka(d.due_slack, 1)} × ${a4(d.upaya)}`} result={a4(d.tenggat)} />}
      </>;
    case "effort_revision":
      return d.tugas === undefined ? null : <>
        <Calc formula={`upaya ${nm.key(d.tugas)} = upaya lama × faktor`}
              subst={`${a4(d.upaya_sebelum)} × ${a4(d.faktor)}`} result={a4(d.upaya_sesudah)} />
        <p className="small">Status {STATUS[d.status_sebelum] ?? d.status_sebelum}; selesai {a4(d.C_sebelum)} → {a4(d.C_sesudah)}.</p>
      </>;
    case "rework_review_fail":
      return d.tugas === undefined ? null : <>
        <Calc formula={`upaya ${nm.key(d.tugas)} = upaya lama + tambahan rework`}
              subst={`${a4(d.upaya_sebelum)} + ${a4(d.tambahan)}`} result={a4(d.upaya_sesudah)} />
        <p className="small">Status {STATUS[d.status_sebelum] ?? d.status_sebelum} → {STATUS[d.status_sesudah] ?? d.status_sesudah}.</p>
      </>;
    case "priority_change":
      return d.tugas === undefined ? null :
        <p>{nm.key(d.tugas)}: prioritas {angka(d.prioritas_sebelum, 2)} → {angka(d.prioritas_sesudah, 2)}; tenggat tetap {a4(d.tenggat_sesudah)}.</p>;
    case "developer_unavailable":
      return d.pengembang === undefined ? null :
        <p>{nm.dev(d.pengembang)} tidak tersedia {a4(d.lama)} jam, dari jam {a4((d.jeda as unknown as number[])[0])} sampai {a4((d.jeda as unknown as number[])[1])}.</p>;
    default:
      return null;
  }
}

function FeatureTable({ items, nm }: { items: FeatureItem[]; nm: Namer }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <table className="ftable">
      <thead><tr><th>#</th><th>Angka</th><th>Rumus</th><th className="num">Nilai</th></tr></thead>
      <tbody>
        {items.map((it, i) => (
          <FeatureRow key={i} i={i} it={it} open={open === i} onToggle={() => setOpen(open === i ? null : i)} nm={nm} />
        ))}
      </tbody>
    </table>
  );
}

function FeatureRow({ i, it, open, onToggle, nm }: { i: number; it: FeatureItem; open: boolean;
                                                     onToggle: () => void; nm: Namer }) {
  return (
    <>
      <tr className={`ftable__row ${open ? "on" : ""}`} onClick={onToggle}>
        <td className="muted">{i + 1}</td><td>{it.name}</td><td className="small muted">{it.formula}</td>
        <td className="num">{a4(it.value)}</td>
      </tr>
      {open && (
        <tr className="ftable__detail"><td /><td colSpan={3}>
          <Inputs inputs={it.inputs} nm={nm} />
          {it.note && <p className="small muted">{it.note}</p>}
        </td></tr>
      )}
    </>
  );
}

function Heat({ values }: { values: number[] }) {
  return (
    <div className="heat" aria-hidden="true">
      {values.map((v, i) => (
        <i key={i} title={`${i + 1}: ${a4(v)}`}
           style={{ background: v >= 0 ? `color-mix(in srgb, var(--lv3) ${Math.round(Math.abs(v) * 100)}%, var(--surface))`
             : `color-mix(in srgb, var(--lv1) ${Math.round(Math.abs(v) * 100)}%, var(--surface))` }} />
      ))}
    </div>
  );
}

function Queue({ q, nm }: { q: QueueRow; nm: Namer }) {
  const moved = new Set(q.pindah_posisi);
  return (
    <div className="queue">
      <div className="queue__dev">{nm.dev(q.dev)}</div>
      <div className="queue__row"><span className="queue__lab">lama</span>
        <span className="chips">{q.lama.map((t, i) => <span key={t} className="chip"><b>{i + 1}</b> {nm.key(t)}</span>)}</span></div>
      <div className="queue__row"><span className="queue__lab">baru</span>
        <span className="chips">{q.baru.map((t, i) => (
          <span key={t} className={`chip ${moved.has(t) ? "chip--moved" : ""}`}><b>{i + 1}</b> {nm.key(t)}</span>))}</span></div>
      <Calc formula="posisi lama, urut antrean baru" result={`[${q.posisi_lama.map((p) => p + 1).join(", ")}]`} />
      <Calc formula="n − LIS" subst={`${q.n} − ${q.lis}`} result={`${q.n - q.lis} tugas pindah posisi${moved.size ? `: ${[...moved].map(nm.key).join(", ")}` : ""}`} />
    </div>
  );
}

function LevelDetail({ b, nm }: { b: LevelValue; nm: Namer }) {
  if (!b.feasible) return <p className="small muted">{b.reason}</p>;
  return (
    <div className="level-detail">
      <Calc formula="Tard = Σ max(0, C_i − d_i)" subst={b.late!.length
              ? b.late!.slice(0, 6).map((r) => a4(r.telat)).join(" + ") + (b.late!.length > 6 ? ` + … (${b.late!.length} tugas)` : "")
              : "tidak ada tugas terlambat"} result={a4(b.tard)} />
      {b.late!.length > 0 && <Fold label={`${b.late!.length} tugas terlambat`}>
        <table className="mini"><thead><tr><th>Issue</th><th>Pengembang</th><th>C</th><th>d</th><th>C − d</th></tr></thead>
          <tbody>{b.late!.map((r) => <tr key={r.tugas}><td>{nm.key(r.tugas)}</td><td>{nm.dev(r.pengembang)}</td>
            <td>{a4(r.C)}</td><td>{a4(r.d)}</td><td>{a4(r.telat)}</td></tr>)}</tbody></table>
      </Fold>}
      <Calc formula="pindah pengembang" result={b.moved_dev!.length
        ? `${b.moved_dev!.length}: ${b.moved_dev!.map((m) => `${nm.key(m.tugas)} ${nm.dev(m.dari)} → ${nm.dev(m.ke)}`).join("; ")}` : "0"} />
      {b.queues!.map((q) => <Queue key={q.dev} q={q} nm={nm} />)}
      <Calc formula="U = pindah pengembang + Σ (n − LIS)" subst={`${b.md} + ${b.mp}`} result={String(b.U)} />
      <Calc formula="J = Tard / E + λ × U" subst={`${a4(b.tard)} / ${a4(b.E)} + ${lambdaLabel(b.lam!)} × ${b.U}`}
            result={a4(b.J)} />
    </div>
  );
}

function SubDecision({ s, ev, nm, learned }: { s: SubLog; ev: EventLog; nm: Namer; learned: boolean }) {
  const sel = s.selector;
  const [lvOpen, setLvOpen] = useState<number | null>(s.used ?? 0);
  const levels = [0, 1, 2, 3].map((lv) => s.levels[String(lv)]);
  const allowed = s.mask ? [1, ...s.mask] : [1, 1, 1, 1];
  return (
    <>
      {s.features && (
        <Step n="④" title="38 angka keadaan" term="state" code="cek_b3.features, dfjsp.env.state.extract_state">
          <p className="small">Setiap angka dihitung ulang dari jadwal saat itu dan dicek sama dengan angka yang dibaca
            {" "}{learned ? "kebijakan" : "selector"}. Klik baris untuk melihat angka yang masuk ke rumusnya.</p>
          <FeatureTable items={s.features} nm={nm} />
        </Step>
      )}
      {sel?.kind === "ppo" && (
        <>
          <Step n="⑤" title="Normalisasi" term="normalize" code="cek_episode.PPOPol.__call__" open={false}>
            <table className="mini mini--wide"><thead><tr><th>#</th><th>x</th><th>μ</th><th>σ</th><th>(x − μ)/σ</th><th>z</th></tr></thead>
              <tbody>{sel.x!.map((x, i) => (
                <tr key={i} className={sel.clipped!.includes(i) ? "warn" : ""}><td>{i + 1}</td><td>{a4(x)}</td>
                  <td>{a4(sel.mu![i])}</td><td>{a4(sel.sd![i])}</td><td>{a4(sel.raw![i])}</td><td>{a4(sel.obs![i])}</td></tr>))}</tbody>
            </table>
            {sel.clipped!.length > 0 && <p className="small muted">Baris berwarna dipotong ke ±5.</p>}
          </Step>
          <Step n="⑥" title="Jaringan actor dan softmax bermask" term="actor" code="MaskablePPO policy: mlp_extractor.policy_net, action_net">
            <p className="small">{sel.layers!.join(" → ")} angka, aktivasi {sel.activation}. Warna: nilai lapis tersembunyi
              dari −1 (biru) sampai 1 (ungu).</p>
            <div className="small muted">h1 = tanh(W1·z + b1)</div><Heat values={sel.h1!} />
            <div className="small muted">h2 = tanh(W2·h1 + b2)</div><Heat values={sel.h2!} />
            <table className="mini mini--wide"><thead><tr><th>Tingkat</th><th>Logit z</th><th>Mask</th>
              <th>e^(z − z_max)</th><th>Peluang</th></tr></thead>
              <tbody>{[0, 1, 2, 3].map((lv) => (
                <tr key={lv} className={lv === sel.chosen ? "pick" : ""}><td>{LEVEL_SHORT[lv]} {LEVEL_NAMES[lv]}</td>
                  <td>{a4(sel.logits![lv])}</td><td>{sel.allowed![lv]}</td>
                  <td>{sel.allowed![lv] ? a4(sel.exp![lv]) : "dibuang"}</td><td>{a4(sel.probs![lv])}</td></tr>))}</tbody>
            </table>
            <Calc formula="z_max (tingkat yang sah)" result={a4(sel.z_max)} />
            <Calc formula={`p(${LEVEL_SHORT[sel.chosen]}) = e^(z − z_max) / Σ e^(z − z_max)`}
                  subst={`${a4(sel.exp![sel.chosen])} / ${a4(sel.sum_exp)}`} result={a4(sel.probs![sel.chosen])} />
          </Step>
        </>
      )}
      {sel?.kind === "boosting" && (
        <Step n="⑤-⑥" title="Boosting-IL: peluang setiap tingkat" code="cek_b3.Pol (HistGradientBoosting)">
          <p className="small">{sel.model}{sel.n_trees ? `, ${sel.n_trees} iterasi pohon` : ""}. Peluang = softmax dari skor
            mentah setiap kelas; tingkat yang tertutup mask tidak dipilih.</p>
          <table className="mini mini--wide"><thead><tr><th>Tingkat</th><th>Skor mentah</th><th>Mask</th><th>Peluang</th></tr></thead>
            <tbody>{[0, 1, 2, 3].map((lv) => (
              <tr key={lv} className={lv === sel.chosen ? "pick" : ""}><td>{LEVEL_SHORT[lv]} {LEVEL_NAMES[lv]}</td>
                <td>{a4(sel.scores?.[lv] ?? null)}</td><td>{allowed[lv]}</td><td>{a4(sel.probs![lv])}</td></tr>))}</tbody>
          </table>
        </Step>
      )}
      {(sel?.kind === "rule" || sel?.kind === "manual") && (
        <Step n="⑤-⑥" title={sel.kind === "manual" ? "Pilihan Anda" : "Aturan selector"} term="selector">
          <p className="small">{sel.rule}.</p>
          <p className="small">Tingkat yang sah menurut mask: {sel.allowed!.map((lv) => LEVEL_SHORT[lv]).join(", ")}.</p>
        </Step>
      )}
      <Step n="⑦" title="Tingkat yang diminta" term="selector">
        {s.requested === null ? <p className="small">Tidak ada selector (AOR).</p> : (
          <p><span className="level-pill" style={{ background: `color-mix(in srgb, var(--lv${s.requested}) 18%, white)` }}>
            <Ladder level={s.requested} />{LEVEL_SHORT[s.requested]} {LEVEL_NAMES[s.requested]}</span>
            {sel?.kind === "ppo" && <span className="small muted"> peluang terbesar, deterministik</span>}
            {s.decision?.rule === "teacher" && <span className="small muted"> J terkecil dari semua tingkat</span>}
          </p>
        )}
      </Step>
      <Step n="⑧" title="Coba setiap tingkat pada salinan jadwal, hitung J" term="J" code="cek_b1_b2.try_level, cek_b1_b2.score, count_changes">
        <p className="small">Untuk belajar, keempat tingkat dicoba di sini. Metode sendiri hanya mencoba tingkat yang diminta
          {s.decision?.rule === "teacher" ? " (teacher memang mencoba semuanya)" : ""}. U dihitung terhadap jadwal sesudah AOR.</p>
        <table className="mini mini--wide lv-table"><thead><tr><th>Tingkat</th><th>Sah</th><th>Tard</th><th>Tard/E</th>
          <th>Pindah dev</th><th>Pindah posisi</th><th>U</th><th>λ·U</th><th>J</th></tr></thead>
          <tbody>{levels.map((b, lv) => (
            <tr key={lv} className={`${lv === s.used ? "pick" : ""} ${lvOpen === lv ? "on" : ""}`} onClick={() => setLvOpen(lvOpen === lv ? null : lv)}>
              <td>{LEVEL_SHORT[lv]}{lv === s.requested ? " (diminta)" : ""}</td>
              <td>{!allowed[lv] ? "mask 0" : b?.feasible ? "ya" : "tidak"}</td>
              {b?.feasible ? <><td>{a4(b.tard)}</td><td>{a4(b.tard_over_E)}</td><td>{b.md}</td><td>{b.mp}</td><td>{b.U}</td>
                <td>{a4(b.lamU)}</td><td><b>{a4(b.J)}</b></td></> : <td colSpan={7} className="muted">operator tidak menemukan perbaikan sah</td>}
            </tr>))}</tbody>
        </table>
        {lvOpen !== null && levels[lvOpen] && <div className="lv-open">
          <div className="small muted">Rincian {LEVEL_SHORT[lvOpen]} {LEVEL_NAMES[lvOpen]}:</div>
          <LevelDetail b={levels[lvOpen]} nm={nm} /></div>}
      </Step>
      <Step n="⑨" title={s.decision?.rule === "teacher" ? "Aturan teacher" : "Guard"} term={s.decision?.rule === "teacher" ? "teacher" : "guard"} code="cek_b3.run_batch">
        {s.decision ? <>
          <p>{decisionText(s.decision)}</p>
          {s.decision.rule === "guard" && <Calc formula="J_calon ≤ J_sekarang + 10⁻⁹ ?"
            subst={`${a4(s.decision.J_candidate)} ≤ ${a4(s.decision.J_now)} + 10⁻⁹`}
            result={s.decision.accepted ? "ya, diterima" : "tidak, ditolak"} />}
        </> : <p className="small">AOR tidak punya guard.</p>}
      </Step>
      <Step n="⑩" title="Hasil sub-keputusan">
        <Calc formula="J" subst={`${a4(s.J_before)} → ${a4(s.J_after)}`}
              result={`${s.used === null ? "–" : LEVEL_SHORT[s.used]} (${OUTCOME_TEXT[s.outcome] ?? s.outcome}), perubahan kumulatif ${s.changes_after}`} />
        {ev.subs.length > s.j + 1 && <p className="small muted">Sub-keputusan berikutnya mulai dari jadwal ini.</p>}
      </Step>
    </>
  );
}

function ProcessSection({ ev, ep, nm }: { ev: EventLog; ep: EpisodeLog; nm: Namer }) {
  const [j, setJ] = useState(0);
  const s = ev.subs[Math.min(j, ev.subs.length - 1)];
  const learned = ep.meta.method.startsWith("ppo_") || ep.meta.method.startsWith("il_");
  const lam = ev.lam;
  return (
    <>
      <div className="nlog__event">Kejadian {ev.index + 1} dari {ep.events.length} · jam ke-{a4(ev.time)} · {ev.disruptions.length} gangguan</div>
      <Step n="①" title="Gangguan dan efeknya" term="disruption" code="dfjsp.env.disruption_effects.apply_disruption">
        {ev.disruptions.map((e, i) => (
          <div key={i} className="effect">
            <div className="effect__head"><b>ξ{i + 1} · {nm.dis(e.type)}</b> <span className="muted small">jam {a4(e.time)}</span></div>
            {effectText(e, nm)}
            {e.shifts.length > 0 && <Fold label={`${e.shifts.length} tugas bergeser karena gangguan ini (AOR)`}>
              <table className="mini"><thead><tr><th>Issue</th><th>Pengembang</th><th>Mulai</th><th>Selesai</th></tr></thead>
                <tbody>{e.shifts.map((r) => <tr key={r.tugas}><td>{nm.key(r.tugas)}</td><td>{nm.dev(r.pengembang)}</td>
                  <td>{a4(r.mulai_sebelum)} → {a4(r.mulai_sesudah)}</td><td>{a4(r.C_sebelum)} → {a4(r.C_sesudah)}</td></tr>)}</tbody></table>
            </Fold>}
          </div>
        ))}
      </Step>
      <Step n="②" title="AOR (tingkat 0) menyerap semua gangguan" term="aor">
        <Calc formula="Tard / E sebelum gangguan" result={a4(ev.tard_before)} />
        <Calc formula="J sesudah AOR = Tard / E + λ × 0" result={a4(ev.tard_aor)} />
      </Step>
      <Step n="③" title="Affected set A_j setiap gangguan" term="affected" code="dfjsp.env.repair_env.affected_tasks">
        {ev.disruptions.map((e, i) => (
          <div key={i} className="aset">
            <b>A{i + 1}</b> ({e.affected.length}): <span className="chips">{e.affected.map((t) => (
              <span key={t} className="chip" title={e.direct.includes(t) ? "sasaran langsung" : "tergeser lalu lewat tenggat"}>
                {nm.key(t)}{e.direct.includes(t) ? "" : " ⟶"}</span>))}</span>
            {e.late_shift.length > 0 && <div className="small muted">⟶ tergeser dan lewat tenggat: {e.late_shift.map((r) =>
              `${nm.key(r.tugas)} (C ${a4(r.C_sebelum)} → ${a4(r.C_sesudah)} > d ${a4(r.d)})`).join("; ")}</div>}
          </div>
        ))}
      </Step>
      {ev.manual && (
        <Step n="④-⑩" title="Geser kartu: nilai jadwal Anda" term="J">
          <LevelDetail b={ev.manual} nm={nm} />
        </Step>
      )}
      {!ev.manual && ev.subs.some((x) => x.features || x.decision) && (
        <>
          <div className="subtabs" role="tablist" aria-label="Sub-keputusan">
            {ev.subs.map((x) => (
              <button key={x.j} role="tab" aria-selected={x.j === s.j} className={x.j === s.j ? "on" : ""} onClick={() => setJ(x.j)}>
                Sub-keputusan {x.j + 1}<span className="small muted"> · {nm.dis(x.type)}</span>
                {x.used !== null && <Ladder level={x.used} />}
              </button>))}
          </div>
          <SubDecision key={`${ev.index}-${s.j}`} s={s} ev={ev} nm={nm} learned={learned} />
        </>
      )}
      <Step n="Σ" title="Hasil kejadian" term="J">
        <Calc formula="J kejadian = Tard / E + λ × U" subst={`${a4(ev.tard_after)} + ${lambdaLabel(lam)} × ${ev.changes}`}
              result={a4(ev.J_after_batch)} />
      </Step>
    </>
  );
}

// ------------------------------------------------------------------ output
function OutputSection({ ep, nm }: { ep: EpisodeLog; nm: Namer }) {
  const out = ep.output;
  if (!out) return <p className="muted">Log output tidak tersedia untuk run ini.</p>;
  const sumU = ep.events.reduce((t, e) => t + e.changes, 0);
  return (
    <>
      <Step n="O-1" title="Perubahan setiap kejadian" term="U">
        <table className="mini mini--wide"><thead><tr><th>Kejadian</th><th>Jam</th><th>Tingkat dipakai</th><th>U</th><th>J kejadian</th></tr></thead>
          <tbody>{ep.events.map((e) => (
            <tr key={e.index}><td>{e.index + 1}</td><td>{a4(e.time)}</td><td>{e.levels.map((l) => LEVEL_SHORT[l] ?? "–").join(" ")}</td>
              <td>{e.changes}</td><td>{a4(e.J_after_batch)}</td></tr>))}</tbody>
        </table>
        <Calc formula="Σ U" subst={ep.events.filter((e) => e.changes).map((e) => e.changes).join(" + ") || "0"} result={String(sumU)} />
      </Step>
      <Step n="O-2" title="Keterlambatan akhir" term="tardiness">
        <Calc formula="Tard akhir = Σ max(0, C_i − d_i)" subst={`${out.late.length} tugas terlambat`} result={a4(out.tard)} />
        <Calc formula="Tard akhir / E" subst={`${a4(out.tard)} / ${a4(out.E)}`} result={a4(out.tard_over_E)} />
        {out.late.length > 0 && <Fold label="Tugas yang terlambat di akhir episode">
          <table className="mini"><thead><tr><th>Issue</th><th>Pengembang</th><th>C</th><th>d</th><th>C − d</th></tr></thead>
            <tbody>{out.late.map((r) => <tr key={r.tugas}><td>{nm.key(r.tugas)}</td><td>{nm.dev(r.pengembang)}</td>
              <td>{a4(r.C)}</td><td>{a4(r.d)}</td><td>{a4(r.telat)}</td></tr>)}</tbody></table>
        </Fold>}
      </Step>
      <Step n="O-3" title="Nilai episode" term="J">
        <Calc formula="J episode = Tard akhir / E + λ × Σ U"
              subst={`${a4(out.tard_over_E)} + ${lambdaLabel(out.lam)} × ${out.changes}`} result={a4(out.J)} />
        <p className="small muted">Angka ini sama dengan kolom J episode di tabel perbandingan metode, karena keduanya
          berasal dari <span className="mono">cek_episode.run</span>.</p>
      </Step>
    </>
  );
}

// ------------------------------------------------------------------ determinism
function Determinism({ ep, runId, methodKey }: { ep: EpisodeLog; runId: string; methodKey: string }) {
  const d = ep.determinism;
  const rerun = useMutation({ mutationFn: () => api.rerun(runId, methodKey) });
  const model = d.model_files.find((f) => d.model_seed !== null
    ? f.path.startsWith(`e9c_s${d.model_seed}/`) : f.path.endsWith(".pkl"));
  return (
    <section className="det" data-tour="determinism">
      <header className="det__head">Deterministik <Info term="determinism" /></header>
      <div className="kv small">
        <span>Seed episode</span><span>{d.episode_seed}</span>
        <span>Seed gangguan</span><span>{d.disruption_seed ?? "–"}</span>
        <span>Generator</span><span>{d.rng ?? "–"}</span>
        {d.model_seed !== null && <><span>Seed model PPO</span><span>{d.model_seed}</span></>}
        {model && <><span>Model</span><span title={model.sha256}>{model.path} · {model.sha256.slice(0, 10)}…</span></>}
        <span>arls-ppo</span><span>{d.arls_ppo_commit ?? "–"}</span>
      </div>
      <p className="small muted">Hanya waktu (ms) yang berubah dari run ke run. Semua angka lain ditentukan oleh pengaturan di atas.</p>
      <button className="btn btn--sm" onClick={() => rerun.mutate()} disabled={rerun.isPending}>
        {rerun.isPending ? <Spinner /> : <RefreshCw size={14} />}Jalankan ulang tanpa cache dan bandingkan
      </button>
      {rerun.data && (rerun.data.same
        ? <Ok ok yes={`${rerun.data.compared.toLocaleString("id-ID")} angka dibandingkan, semuanya sama (${angka(rerun.data.seconds, 1)} detik).`} no="" />
        : <div className="check-line check-line--bad"><XCircle size={15} />{rerun.data.n_differences ?? rerun.data.differences.length} selisih:
            {" "}{rerun.data.differences.slice(0, 5).join("; ")}</div>)}
      {rerun.error && <div className="notice notice--warn small">{(rerun.error as Error).message}</div>}
    </section>
  );
}

// ------------------------------------------------------------------ text export
function asText(ep: EpisodeLog, ev: EventLog | undefined, nm: Namer): string {
  const L: string[] = [];
  const m = ep.meta;
  L.push(`ScheduleSim · log hitung · ${m.method_name} · ${m.instance}, kapasitas ${m.capacity}, intensitas ${m.intensity}, seed ${m.seed}, λ ${m.lam}`);
  if (ep.input) L.push(`E = ${ep.input.E.sum} / ${ep.input.E.n} = ${ep.input.E.value}`);
  if (ep.disruptions) L.push(`seed gangguan = ${ep.disruptions.seed}; ${ep.disruptions.events.length} kejadian`);
  if (ev) {
    L.push("", `Kejadian ${ev.index + 1}, jam ${ev.time}`);
    ev.disruptions.forEach((e, i) => L.push(`  ξ${i + 1} ${nm.dis(e.type)}; A${i + 1} = {${e.affected.map(nm.key).join(", ")}}`));
    L.push(`  J sesudah AOR = ${ev.tard_aor}`);
    for (const s of ev.subs) {
      L.push(`  Sub-keputusan ${s.j + 1}: diminta ${s.requested}, dipakai ${s.used} (${s.outcome})`);
      if (s.selector?.probs) L.push(`    peluang = [${s.selector.probs.map((p) => p.toFixed(4)).join(", ")}]`);
      for (const [lv, b] of Object.entries(s.levels)) {
        if (b.feasible) L.push(`    L${lv}: J = ${b.tard} / ${b.E} + ${b.lam} × (${b.md} + ${b.mp}) = ${b.J}`);
      }
      if (s.decision) L.push(`    ${decisionText(s.decision)}`);
    }
    L.push(`  J kejadian = ${ev.tard_after} + ${ev.lam} × ${ev.changes} = ${ev.J_after_batch}`);
  }
  if (ep.output) L.push("", `J episode = ${ep.output.tard_over_E} + ${ep.output.lam} × ${ep.output.changes} = ${ep.output.J}`);
  return L.join("\n");
}

// ------------------------------------------------------------------ panel
type Section = "input" | "proses" | "output";

export default function NumberLog({ runId, methodKey, k }: { runId: string; methodKey: string; k: number }) {
  const [section, setSection] = useState<Section>("proses");
  const [copied, setCopied] = useState(false);
  const ep = useQuery({ queryKey: ["log", runId, methodKey], queryFn: () => api.log(runId, methodKey),
                        staleTime: Infinity });
  const ev = useQuery({ queryKey: ["log", runId, methodKey, k], queryFn: () => api.logEvent(runId, methodKey, k),
                        staleTime: Infinity, placeholderData: (p) => p });
  const nm = useMemo(() => ep.data ? namer(ep.data.names, ep.data.disruption_types) : null, [ep.data]);

  if (ep.isLoading || !nm) return <aside className="decision nlog"><Spinner /></aside>;
  if (ep.error || !ep.data) return <aside className="decision nlog"><div className="notice notice--warn">{(ep.error as Error)?.message}</div></aside>;

  const download = () => {
    const blob = new Blob([JSON.stringify({ episode: ep.data, event: ev.data }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `log-${ep.data!.meta.instance}-${methodKey}-kejadian${k + 1}.json`.replace(/[^\w.@-]/g, "_");
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(ep.data!, ev.data, nm));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  return (
    <aside className="decision nlog" aria-label="Log hitung">
      <div className="nlog__bar">
        <div className="segmented" role="tablist" aria-label="Bagian log">
          {(["input", "proses", "output"] as Section[]).map((s) => (
            <button key={s} role="tab" aria-selected={section === s} className={section === s ? "on" : ""} onClick={() => setSection(s)}>
              {s === "input" ? "Input" : s === "proses" ? `Proses · kejadian ${k + 1}` : "Output"}</button>))}
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn btn--ghost btn--sm" onClick={copy} title="Salin log kejadian ini sebagai teks"><Copy size={14} />{copied ? "Tersalin" : "Salin"}</button>
        <button className="btn btn--ghost btn--sm" onClick={download} title="Unduh log sebagai JSON"><Download size={14} />JSON</button>
      </div>
      <p className="nlog__ids">Nomor issue = id tugas + 1 dan Pengembang n = id pengembang + 1. Naskah dan kode memakai
        id mulai dari 0; contoh: tugas 55 dan pengembang 5 di kode = {ep.data.names.project}-56 dan Pengembang 6.</p>
      <div className="rail">
        {section === "input" && <InputSection ep={ep.data} nm={nm} />}
        {section === "proses" && (ev.data ? <ProcessSection ev={ev.data} ep={ep.data} nm={nm} /> : <Spinner />)}
        {section === "output" && <OutputSection ep={ep.data} nm={nm} />}
      </div>
      <Determinism ep={ep.data} runId={runId} methodKey={methodKey} />
    </aside>
  );
}
