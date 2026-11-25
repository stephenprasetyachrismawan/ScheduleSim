// Sources of the numbers of a run, for the "Asal angka" sheet. Every value and every row comes
// from the number log of arls-ppo (``/log`` and ``/log/{k}``), which checks each one against the
// number the thesis code used. A list here only shows the rows that were added up; the total
// under it is the number of the API, not a sum made in the browser.
import { Link } from "react-router-dom";
import { LEVEL_NAMES, LEVEL_SHORT } from "../../components/atoms";
import { angka } from "../../format";
import { CodeRef, Formula, Src, type SourceNode } from "../../odoo/source";
import { ListTable } from "../../odoo/ui";
import type { EpisodeLog, EventLog, LevelValue, LogNames, SubLog } from "../../types";
import { issueKey, taskHref } from "./common";

const a4 = (v: number | null | undefined) => angka(v ?? null, 4);
const a2 = (v: number | null | undefined) => angka(v ?? null, 2);
const same = (a: number | undefined, b: number | undefined) =>
  a !== undefined && b !== undefined && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

export interface Names {
  project: string;
  dev: (id: number) => string;
  ctx: { q: string; mk: string; k?: number; langkah?: string };
}

export function namesOf(names: LogNames, ctx: Names["ctx"]): Names {
  return { project: names.project, dev: (id) => names.devs[String(id)] ?? `Pengembang ${id + 1}`, ctx };
}

export function TaskLink({ id, n }: { id: number; n: Names }) {
  return <Link to={taskHref(n.project, id, n.ctx)} className="mono" title={`id ${id} di kode dan naskah`}>
    {issueKey(n.project, id)}</Link>;
}

const EXPLAIN = "src/arls_ppo/_explain.py";

// ------------------------------------------------------------------ episode input
export function nodeE(ep: EpisodeLog, n: Names): SourceNode | null {
  const inp = ep.input;
  if (!inp) return null;
  return {
    title: "E (rata-rata upaya di S0)", value: a4(inp.E.value),
    render: () => (
      <>
        <p>E dipakai sebagai satuan keterlambatan: Tard dibagi E supaya proyek besar dan kecil bisa dibandingkan.
          E dihitung sekali di awal episode dari jadwal awal S0, lalu tetap.</p>
        <Formula rumus="E = Σ (C_i − S_i) di S0 / banyak tugas"
                 isi={`${a4(inp.E.sum)} / ${inp.E.n}`} hasil={a4(inp.E.value)} />
        <ListTable caption={<>{inp.E.n} tugas di S0. Upaya = selesai C − mulai S, dari pengembang yang dipilih S0.</>}
          rows={inp.tasks} rowKey={(r) => r.tugas}
          columns={[
            { label: "Tugas", cell: (r) => <TaskLink id={r.tugas} n={n} /> },
            { label: "Pengembang di S0", cell: (r) => n.dev(r.pengembang) },
            { label: "S (mulai)", num: true, cell: (r) => a2(r.S) },
            { label: "C (selesai)", num: true, cell: (r) => a2(r.C) },
            { label: "C − S", num: true, cell: (r) => a4(r.upaya) },
          ]}
          footer={[`${inp.E.n} tugas`, "", "", "Σ", a4(inp.E.sum)]} />
        <CodeRef file={EXPLAIN} fn="episode_input" note="dicek sama dengan E yang dipakai lingkungan" />
      </>
    ),
  };
}

export function nodeDue(ep: EpisodeLog, id: number, n: Names): SourceNode | null {
  const inp = ep.input;
  const r = inp?.tasks.find((x) => x.tugas === id);
  if (!inp || !r) return null;
  return {
    title: `tenggat ${issueKey(n.project, id)}`, value: a4(r.d),
    render: () => (
      <>
        <p>Tenggat tugas asli diturunkan dari jadwal awal S0: selesai di S0 ditambah setengah lama tugas itu.
          Karena itu di S0 tidak ada tugas yang terlambat.</p>
        <Formula rumus={inp.due_rule}
                 isi={`${a4(r.C)} + ${angka(inp.due_slack, 1)} × (${a4(r.C)} − ${a4(r.S)})`} hasil={a4(r.d)} />
        <p className="muted small">S dan C tugas ini di S0: mulai {a4(r.S)}, selesai {a4(r.C)}, oleh {n.dev(r.pengembang)}.
          {r.d_twk !== null && <> Data mentah juga punya tenggat bawaan {a4(r.d_twk)}; episode tidak memakainya.</>}</p>
        <CodeRef file={EXPLAIN} fn="episode_input" />
      </>
    ),
  };
}

export function nodeCap(ep: EpisodeLog): SourceNode | null {
  const c = ep.input?.capacity;
  if (!c) return null;
  return {
    title: "kapasitas cap_j", value: a4(c.value),
    render: () => (
      <>
        <p>Setiap pengembang mendapat kapasitas yang sama: pengali m kali rata-rata beban per pengembang.</p>
        <Formula rumus={c.rumus} isi={`${angka(c.m, 2)} × (${a4(c.total_nominal)} / ${c.n_devs})`} hasil={a4(c.value)} />
        <CodeRef file="exp1/dfjsp-ppo-repair/src/dfjsp/core/domain.py" fn="set_capacity" />
      </>
    ),
  };
}

// ------------------------------------------------------------------ one schedule: Tard, U, J
function LateTable({ lv, n }: { lv: LevelValue; n: Names }) {
  const late = lv.late ?? [];
  return (
    <ListTable caption="Tugas yang selesai sesudah tenggatnya. Tugas lain menyumbang 0." rows={late}
      rowKey={(r) => r.tugas} empty="Tidak ada tugas yang terlambat, jadi Tard = 0."
      columns={[
        { label: "Tugas", cell: (r) => <TaskLink id={r.tugas} n={n} /> },
        { label: "Pengembang", cell: (r) => n.dev(r.pengembang) },
        { label: "C (selesai)", num: true, cell: (r) => a2(r.C) },
        { label: "d (tenggat)", num: true, cell: (r) => a2(r.d) },
        { label: "C − d", num: true, cell: (r) => a4(r.telat) },
      ]}
      footer={[`${late.length} tugas`, "", "", "Σ = Tard", a4(lv.tard)]} />
  );
}

export function nodeTard(title: string, lv: LevelValue, ep: EpisodeLog | undefined, n: Names): SourceNode {
  return {
    title, value: a4(lv.tard_over_E),
    render: () => (
      <>
        <Formula rumus="Tard/E = Σ max(0, C_i − d_i) / E" isi={`${a4(lv.tard)} / ${a4(lv.E)}`} hasil={a4(lv.tard_over_E)} />
        <p className="muted small">E = {a4(lv.E)} {ep && <Src deeper node={() => nodeE(ep, n)} />}</p>
        <LateTable lv={lv} n={n} />
        <CodeRef file="revisi/hasil/gerbang_batch/cek_b1_b2.py" fn="score" />
      </>
    ),
  };
}

export function nodeLevel(title: string, lv: LevelValue, ep: EpisodeLog | undefined, n: Names): SourceNode {
  const queues = (lv.queues ?? []).filter((q) => q.n - q.lis > 0);
  return {
    title, value: a4(lv.J),
    render: () => (
      <>
        <Formula rumus="J = Tard/E + λ × U,  U = pindah pengembang + Σ (n − LIS)"
                 isi={`${a4(lv.tard_over_E)} + ${angka(lv.lam ?? 0, 1)} × (${lv.md ?? 0} + ${lv.mp ?? 0})`}
                 hasil={a4(lv.J)} />
        <h4 className="o-h4">Tard/E = {a4(lv.tard_over_E)} <Src deeper node={() => nodeTard(`Tard/E ${title}`, lv, ep, n)} /></h4>
        <h4 className="o-h4">Pindah pengembang ({lv.md ?? 0})</h4>
        <ListTable rows={lv.moved_dev ?? []} rowKey={(r) => r.tugas} empty="Tidak ada tugas yang pindah pengembang."
          columns={[{ label: "Tugas", cell: (r) => <TaskLink id={r.tugas} n={n} /> },
                    { label: "Dari", cell: (r) => n.dev(r.dari) }, { label: "Ke", cell: (r) => n.dev(r.ke) }]} />
        <h4 className="o-h4">Pindah posisi dalam antrean ({lv.mp ?? 0})</h4>
        <p className="muted small">Untuk setiap pengembang: dari antrean lama, tugas yang tetap berurutan sama adalah
          LIS (longest increasing subsequence). Tugas sisanya, n − LIS, dihitung pindah posisi.</p>
        <ListTable rows={queues} rowKey={(r) => r.dev} empty="Urutan antrean semua pengembang tidak berubah."
          columns={[
            { label: "Pengembang", cell: (r) => n.dev(r.dev) },
            { label: "Posisi lama tugas, urut antrean baru", cell: (r) => <span className="mono">[{r.posisi_lama.map((p) => p + 1).join(", ")}]</span> },
            { label: "n", num: true, cell: (r) => r.n },
            { label: "LIS", num: true, cell: (r) => r.lis },
            { label: "n − LIS", num: true, cell: (r) => r.n - r.lis },
          ]}
          footer={["", "", "", "Σ", String(lv.mp ?? 0)]} />
        <CodeRef file="exp1/dfjsp-ppo-repair/src/dfjsp/repair/ladder.py" fn="count_changes dan _lis_length" />
      </>
    ),
  };
}

/** The schedule of step 2 or 3 of an event, as one tried level of the number log. */
export function stepLevel(ev: EventLog, step: "2" | "3"): LevelValue | null {
  if (!ev.subs.length) return ev.manual ?? null;
  if (step === "2") {
    const lv = ev.subs[0].levels["0"];
    return lv && same(lv.tard_over_E, ev.tard_aor) ? lv : null;
  }
  const last = ev.subs[ev.subs.length - 1];
  const lv = last.used !== null ? last.levels[String(last.used)] : undefined;
  return lv && same(lv.tard_over_E, ev.tard_after) ? lv : null;
}

export function nodeStepTard(ev: EventLog, step: "1" | "2" | "3", ep: EpisodeLog | undefined, n: Names,
                             prevHref: string | null): SourceNode {
  const label = { "1": "①", "2": "②", "3": "③" }[step];
  const value = step === "1" ? ev.tard_before : step === "2" ? ev.tard_aor : ev.tard_after;
  if (step === "1") {
    return {
      title: `Tard/E ${label} kejadian ${ev.index + 1}`, value: a4(value),
      render: () => ev.index === 0
        ? <p>Langkah ① kejadian pertama adalah jadwal awal S0. Tenggat diturunkan dari S0, jadi tidak ada tugas yang
            terlambat dan Tard/E = {a4(value)}.</p>
        : <p>Langkah ① sama dengan langkah ③ kejadian sebelumnya: di antara dua kejadian jadwal berjalan tanpa
            perubahan. {prevHref && <Link to={prevHref}>Buka langkah ③ kejadian {ev.index}</Link>}</p>,
    };
  }
  const lv = stepLevel(ev, step);
  if (lv) return nodeTard(`Tard/E ${label} kejadian ${ev.index + 1}`, lv, ep, n);
  return {
    title: `Tard/E ${label} kejadian ${ev.index + 1}`, value: a4(value),
    render: () => <p>Rincian tugas terlambat untuk langkah ini ada di tab Log hitung, bagian ⑧.</p>,
  };
}

export function nodeEventJ(ev: EventLog, ep: EpisodeLog | undefined, n: Names): SourceNode {
  const lv = stepLevel(ev, "3");
  return {
    title: `J kejadian ${ev.index + 1}`, value: a4(ev.J_after_batch),
    render: () => (
      <>
        <p>J menilai jadwal sesudah keputusan kejadian ini: keterlambatan (Tard/E) ditambah harga setiap perubahan
          (λ × U). Bila ada beberapa gangguan, keputusan diambil satu per satu dan J yang dipakai adalah J sesudah
          sub-keputusan terakhir.</p>
        <ListTable rows={ev.subs} rowKey={(s) => s.j} empty="Kejadian ini tidak punya sub-keputusan."
          columns={[
            { label: "Sub-keputusan", cell: (s) => `${s.j + 1}. ${s.type}` },
            { label: "Tingkat dipakai", cell: (s) => (s.used === null ? "–" : `${LEVEL_SHORT[s.used]} ${LEVEL_NAMES[s.used]}`) },
            { label: "J sebelum", num: true, cell: (s) => a4(s.J_before) },
            { label: "J sesudah", num: true, cell: (s) => a4(s.J_after) },
          ]} />
        {lv && <p>Uraian J sesudah sub-keputusan terakhir: <Src deeper node={() => nodeLevel(`J kejadian ${ev.index + 1}`, lv, ep, n)} /></p>}
      </>
    ),
  };
}

export function nodeEventU(ev: EventLog, n: Names): SourceNode {
  return {
    title: `U kejadian ${ev.index + 1}`, value: String(ev.changes),
    render: () => (
      <>
        <p>U menghitung perubahan yang dibuat keputusan kejadian ini, dibanding jadwal sesudah gangguan masuk (②):
          satu untuk setiap tugas yang pindah pengembang, dan satu untuk setiap tugas yang pindah posisi di antrean.</p>
        <ListTable rows={ev.change_items} rowKey={(c) => `${c.task}-${c.kind}`} empty="Tidak ada perubahan, U = 0."
          columns={[
            { label: "Tugas", cell: (c) => <TaskLink id={c.task} n={n} /> },
            { label: "Jenis perubahan", cell: (c) => (c.kind === "assignee" ? "pindah pengembang" : "pindah posisi antrean") },
          ]}
          footer={[`${ev.change_items.length} baris`, `U = ${ev.changes}`]} />
        <CodeRef file="exp1/dfjsp-ppo-repair/src/dfjsp/repair/ladder.py" fn="count_changes" />
      </>
    ),
  };
}

export function nodeProb(s: SubLog): SourceNode | null {
  const sel = s.selector;
  if (!sel?.logits || !sel.probs) return null;
  return {
    title: `peluang tingkat, sub-keputusan ${s.j + 1}`, value: sel.chosen !== undefined ? `${LEVEL_SHORT[sel.chosen]}` : undefined,
    render: () => (
      <>
        <p>Jaringan actor memberi satu logit z untuk setiap tingkat. Tingkat yang tidak sah (mask) dibuang. Peluang
          dihitung dengan softmax: e^(z − z_max) dibagi jumlahnya. Tingkat yang diminta adalah peluang terbesar.</p>
        <ListTable rows={[0, 1, 2, 3]} rowKey={(l) => l}
          columns={[
            { label: "Tingkat", cell: (l) => `${LEVEL_SHORT[l]} ${LEVEL_NAMES[l]}` },
            { label: "logit z", num: true, cell: (l) => a4(sel.logits![l]) },
            { label: "e^(z − z_max)", num: true, cell: (l) => (sel.exp?.[l] === undefined ? "tidak sah" : a4(sel.exp[l])) },
            { label: "peluang", num: true, cell: (l) => a4(sel.probs![l]) },
          ]}
          footer={["", `z_max = ${a4(sel.z_max)}`, `Σ = ${a4(sel.sum_exp)}`, ""]} />
        <CodeRef file="revisi/hasil/gerbang_batch/cek_episode.py" fn="PPOPol" note="38 angka keadaan dan normalisasinya ada di tab Log hitung" />
      </>
    ),
  };
}

// ------------------------------------------------------------------ episode output
export function nodeEndTard(ep: EpisodeLog, n: Names): SourceNode | null {
  const o = ep.output;
  if (!o) return null;
  return nodeTard("Tard/E akhir episode",
                  { level: "akhir", feasible: true, tard: o.tard, E: o.E, tard_over_E: o.tard_over_E, late: o.late },
                  ep, n);
}

export function nodeEpisodeJ(ep: EpisodeLog, n: Names, eventHrefOf: (k: number) => string): SourceNode | null {
  const o = ep.output;
  if (!o) return null;
  return {
    title: "J episode", value: a4(o.J),
    render: () => (
      <>
        <Formula rumus={o.rumus} isi={`${a4(o.tard_over_E)} + ${angka(o.lam, 1)} × ${o.changes}`} hasil={a4(o.J)} />
        <h4 className="o-h4">Tard/E akhir = {a4(o.tard_over_E)} <Src deeper node={() => nodeEndTard(ep, n)} /></h4>
        <h4 className="o-h4">ΣU = {o.changes}: perubahan semua kejadian</h4>
        <ListTable rows={ep.events} rowKey={(e) => e.index}
          columns={[
            { label: "Kejadian", cell: (e) => <Link to={eventHrefOf(e.index)}>Kejadian {e.index + 1}</Link> },
            { label: "Jam", num: true, cell: (e) => angka(e.time, 1) },
            { label: "U", num: true, cell: (e) => e.changes },
          ]}
          footer={[`${ep.events.length} kejadian`, "Σ", String(o.changes)]} />
        <CodeRef file={EXPLAIN} fn="episode_output" note="dicek sama dengan J hasil cek_episode.run" />
      </>
    ),
  };
}
