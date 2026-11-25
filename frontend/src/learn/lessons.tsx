// The lessons of the "Belajar" section: one idea per lesson, a few small steps each, and a
// few questions at the end. Every number comes from the example run (lessonData.ts).
import type { ReactNode } from "react";
import { LEVEL_NAMES, LEVEL_SHORT } from "../components/atoms";
import { angka } from "../format";
import type { InputLog, LevelValue, MethodSummary, Phase } from "../types";
import type { LessonData } from "./lessonData";
import { PPO } from "./lessonData";

export interface Ctx {
  d: LessonData;
  key: (id: number) => string;
  dev: (id: number) => string;
  task: (id: number) => InputLog["tasks"][number];
  n: (v: number | null | undefined, digits?: number) => string;
  sum: (key: string) => MethodSummary;
  lv: (k: number, j: number, level: number) => LevelValue;
}

export function makeCtx(d: LessonData): Ctx {
  const key = (id: number) => `${d.log.names.project}-${id + 1}`;
  return {
    d, key,
    dev: (id) => (d.log.names.devs[String(id)] ?? `Pengembang ${id + 1}`).replace(/ \(.*\)$/, ""),
    task: (id) => d.log.input!.tasks.find((t) => t.tugas === id)!,
    n: (v, digits = 2) => angka(v ?? null, digits),
    sum: (k) => d.results.find((r) => r.key === k)!,
    lv: (k, j, level) => d.ev[k].subs[j].levels[String(level)],
  };
}

export type Visual =
  | { kind: "gantt"; method: string; k: number; phase: Phase; highlight?: (c: Ctx) => string[];
      notes?: (c: Ctx) => Record<string, string>; ghost?: boolean; caption: string }
  | { kind: "node"; render: (c: Ctx) => ReactNode };

export interface Step {
  title: string;
  body: (c: Ctx) => ReactNode;
  look?: (c: Ctx) => ReactNode;
  visual?: Visual;
}

export interface Question {
  id: string;
  q: (c: Ctx) => ReactNode;
  /** The first option is the correct one; the page shuffles them. */
  options: (c: Ctx) => string[];
  why: (c: Ctx) => ReactNode;
}

export interface Lesson {
  id: string;
  title: string;
  goal: string;
  minutes: number;
  steps: Step[];
  quiz: Question[];
}

export function Calc({ f, s, r }: { f: string; s?: string; r: string }) {
  return (
    <div className="calc"><span className="calc__f">{f}</span>{s && <span className="calc__s">= {s}</span>}
      <span className="calc__r">= {r}</span></div>
  );
}

const ppoEvents = (c: Ctx) => c.d.events[PPO];
const urgent = (c: Ctx) => c.d.ev[1].disruptions[1].detail as Record<string, number & string>;
const rework = (c: Ctx) => c.d.ev[3].disruptions[0].detail as Record<string, number & string>;
const away = (c: Ctx) => c.d.ev[0].disruptions[0];
const shiftOf = (c: Ctx, task: number) => away(c).shifts.find((s) => s.tugas === task)!;
const sub2 = (c: Ctx) => c.d.ev[1].subs[1];

function LevelTable({ c, k, j, lam }: { c: Ctx; k: number; j: number; lam: number }) {
  return (
    <table className="mini mini--wide lesson-table"><thead><tr><th>Tingkat</th><th>Tard/E</th><th>U</th>
      <th>J = Tard/E + λ × U</th></tr></thead>
      <tbody>{[0, 1, 2, 3].map((lv) => {
        const b = c.lv(k, j, lv);
        return (
          <tr key={lv}><td>{LEVEL_SHORT[lv]} {LEVEL_NAMES[lv]}</td>
            {b.feasible ? <><td>{c.n(b.tard_over_E, 3)}</td><td>{b.U}</td>
              <td>{c.n(b.tard_over_E, 3)} + {c.n(lam, 1)} × {b.U} = <b>{c.n(b.tard_over_E! + lam * b.U!, 3)}</b></td></>
              : <td colSpan={3} className="muted">tidak ada perbaikan yang sah</td>}
          </tr>);
      })}</tbody>
    </table>
  );
}

function Probs({ p }: { p: number[] }) {
  const best = p.indexOf(Math.max(...p));
  return (
    <div className="lesson-probs">
      {p.map((v, lv) => (
        <div key={lv} className={`lesson-prob ${lv === best ? "on" : ""}`}>
          <span>{LEVEL_SHORT[lv]} {LEVEL_NAMES[lv]}</span>
          <span className="bar"><i style={{ width: `${v * 100}%`, background: lv === best ? `var(--lv${lv})` : "var(--line-strong)" }} /></span>
          <span className="num">{angka(v, 3)}</span>
        </div>
      ))}
    </div>
  );
}

function QueueDemo({ c }: { c: Ctx }) {
  const q = c.lv(1, 1, 1).queues!.find((x) => x.dev === 2)!;
  const moved = new Set(q.pindah_posisi);
  return (
    <div className="lesson-queue">
      <div className="lesson-queue__row"><span>Antrean lama {c.dev(q.dev)}</span>
        {q.lama.map((t, i) => <span key={t} className="chip"><b>{i + 1}</b> {c.key(t)}</span>)}</div>
      <div className="lesson-queue__row"><span>Antrean baru (L1)</span>
        {q.baru.map((t, i) => <span key={t} className={`chip ${moved.has(t) ? "chip--moved" : ""}`}><b>{i + 1}</b> {c.key(t)}</span>)}</div>
      <Calc f="posisi lama, menurut urutan baru" r={`[${q.posisi_lama.map((p) => p + 1).join(", ")}]`} />
      <Calc f="barisan naik terpanjang (LIS)" r={`panjang ${q.lis}`} />
      <Calc f="pindah posisi = n − LIS" s={`${q.n} − ${q.lis}`} r={String(q.n - q.lis)} />
    </div>
  );
}

export const LESSONS: Lesson[] = [
  // ------------------------------------------------------------------ 1
  {
    id: "masalah", title: "Apa yang diteliti?", minutes: 4,
    goal: "Mengenal bagian-bagian soal penjadwalan proyek: tugas, pengembang, upaya, dan dependensi.",
    steps: [
      {
        title: "Proyek = tugas yang dikerjakan pengembang",
        body: (c) => <p>Contoh kita adalah proyek fiktif <b>Kedai kopi digital</b>: {c.d.log.input!.n_tasks} tugas
          (issue) dikerjakan {c.d.log.input!.n_devs} pengembang. Gambar di samping adalah jadwalnya. Setiap batang
          adalah satu tugas, dan panjang batang adalah lama pengerjaannya (disebut <i>upaya</i>), dalam jam.</p>,
        look: () => <>Setiap <b>baris</b> adalah satu pengembang. Seorang pengembang mengerjakan tugasnya satu per satu,
          berurutan seperti antrean.</>,
        visual: { kind: "gantt", method: PPO, k: 0, phase: "before", ghost: false, caption: "Jadwal awal proyek" },
      },
      {
        title: "Upaya bergantung pada siapa yang mengerjakan",
        body: (c) => {
          const t = c.task(0);
          return <p>{c.key(0)} bisa dikerjakan {Object.entries(t.layak).map(([d, e]) => `${c.dev(Number(d))} dalam ${c.n(e, 0)} jam`).join(" atau ")}.
            Tidak semua pengembang bisa mengerjakan semua tugas. Pengembang yang bisa disebut <i>pengembang yang layak</i>.</p>;
        },
        look: () => <>Siapa yang mengerjakan memengaruhi kapan tugas selesai. Inilah ruang yang bisa dipakai saat memperbaiki jadwal.</>,
        visual: { kind: "gantt", method: PPO, k: 0, phase: "before", ghost: false, highlight: (c) => [c.key(0)],
                  caption: "Jadwal awal" },
      },
      {
        title: "Dependensi: ada tugas yang harus menunggu",
        body: (c) => {
          const a = c.task(0), b = c.task(1);
          return <p>{c.key(1)} baru boleh mulai sesudah {c.key(0)} selesai. Hubungan ini disebut <i>dependensi</i>
            (precedence constraint). Di jadwal, {c.key(0)} selesai jam {c.n(a.C, 0)} dan {c.key(1)} mulai jam {c.n(b.S, 0)}.</p>;
        },
        look: (c) => <>{c.key(1)} tidak mungkin mulai sebelum jam {c.n(c.task(0).C, 0)}, walaupun {c.dev(c.task(1).pengembang)} sedang kosong.</>,
        visual: { kind: "gantt", method: PPO, k: 0, phase: "before", ghost: false,
                  highlight: (c) => [c.key(0), c.key(1)], caption: "Jadwal awal" },
      },
      {
        title: "Waktu dalam jam, bukan tanggal",
        body: () => <p>Angka di bawah jadwal adalah <b>jam ke-sekian</b> sejak proyek mulai, bukan tanggal kalender.
          Tesis ini memakai satuan waktu dari data penjadwalan apa adanya.</p>,
        look: () => <>Di tesis, proyek seperti ini dibaca dari soal penjadwalan pabrik: <i>job</i> menjadi fitur,
          <i> mesin</i> menjadi pengembang, dan <i>operasi</i> menjadi tugas (Subbab 3.2.1).</>,
      },
    ],
    quiz: [
      { id: "1a", q: () => "Di jadwal, satu batang mewakili apa?",
        options: () => ["Satu tugas (issue)", "Satu pengembang", "Satu gangguan", "Satu hari kerja"],
        why: () => "Baris = pengembang, batang = tugas, panjang batang = upaya dalam jam." },
      { id: "1b", q: (c) => `${c.key(1)} bergantung pada ${c.key(0)}. Artinya…`,
        options: (c) => [`${c.key(1)} baru boleh mulai sesudah ${c.key(0)} selesai`,
                         `${c.key(1)} harus dikerjakan pengembang yang sama`,
                         `${c.key(1)} lebih penting daripada ${c.key(0)}`,
                         "Keduanya harus dikerjakan bersamaan"],
        why: () => "Dependensi hanya mengatur urutan waktu: pendahulu harus selesai dulu." },
    ],
  },
  // ------------------------------------------------------------------ 2
  {
    id: "jadwal-awal", title: "Jadwal awal dan tenggat", minutes: 4,
    goal: "Tahu dari mana jadwal awal S0, tenggat d, dan satuan E berasal.",
    steps: [
      {
        title: "Jadwal awal S0",
        body: () => <p>Sebelum ada gangguan, ada rencana yang disebut <b>S0</b>. S0 disusun otomatis: tugas yang sudah
          boleh mulai diurutkan, lalu diberikan ke pengembang layak yang bebannya paling ringan.</p>,
        look: () => <>S0 adalah rencana. Gangguan nanti membuat rencana ini meleset, dan di situlah penjadwalan ulang dibutuhkan.</>,
        visual: { kind: "gantt", method: PPO, k: 0, phase: "before", ghost: false, caption: "S0" },
      },
      {
        title: "Tenggat diambil dari S0",
        body: (c) => {
          const t = c.task(0);
          return <><p>Setiap tugas punya <b>tenggat</b> d, yaitu batas waktu selesai. Di tesis ini tenggat = waktu selesai
            di S0 ditambah setengah upayanya.</p>
            <Calc f={`d(${c.key(0)}) = selesai + 0,5 × upaya`} s={`${c.n(t.C, 0)} + 0,5 × ${c.n(t.upaya, 0)}`} r={c.n(t.d, 1)} /></>;
        },
        look: () => <>Karena itu S0 sendiri tidak pernah terlambat. Keterlambatan baru muncul sesudah gangguan. Segitiga merah di
          jadwal adalah tenggat.</>,
        visual: { kind: "gantt", method: PPO, k: 0, phase: "before", ghost: false, highlight: (c) => [c.key(0)], caption: "S0" },
      },
      {
        title: "E: rata-rata upaya sebagai satuan",
        body: (c) => {
          const E = c.d.log.input!.E;
          return <><p>Total upaya semua tugas di S0 dibagi banyak tugas:</p>
            <Calc f="E" s={`${c.n(E.sum, 0)} / ${E.n}`} r={`${c.n(E.value, 4)} jam`} />
            <p>Keterlambatan nanti ditulis dalam satuan E. "Tard/E = 6" artinya total keterlambatan kira-kira enam kali lama
              satu tugas rata-rata.</p></>;
        },
        look: () => <>Dengan satuan E, proyek kecil dan proyek besar bisa dibandingkan.</>,
      },
      {
        title: "Kapasitas pengembang",
        body: (c) => {
          const cap = c.d.log.input!.capacity;
          return <><p>Setiap pengembang punya batas beban. Dengan pengali m = {c.n(cap.m, 1)}:</p>
            <Calc f="kapasitas = m × (total upaya nominal / banyak pengembang)"
                  s={`${c.n(cap.m, 1)} × (${c.n(cap.total_nominal, 1)} / ${cap.n_devs})`} r={`${c.n(cap.value, 3)} jam`} /></>;
        },
        look: () => <>Perbaikan jadwal tidak boleh membuat beban seseorang melewati kapasitas ini.</>,
      },
    ],
    quiz: [
      { id: "2a", q: (c) => { const t = c.task(1); return `${c.key(1)} di S0 mulai jam ${c.n(t.S, 0)} dan selesai jam ${c.n(t.C, 0)} (upaya ${c.n(t.upaya, 0)} jam). Berapa tenggatnya?`; },
        options: (c) => { const t = c.task(1); return [c.n(t.d, 1), c.n(t.C, 1), c.n(t.C + t.upaya, 1), c.n(t.S + 0.5 * t.upaya, 1)]; },
        why: (c) => { const t = c.task(1); return `d = selesai + 0,5 × upaya = ${c.n(t.C, 0)} + 0,5 × ${c.n(t.upaya, 0)} = ${c.n(t.d, 1)}.`; } },
      { id: "2b", q: () => "Mengapa S0 tidak pernah terlambat?",
        options: () => ["Karena tenggat setiap tugas diambil dari waktu selesainya di S0 ditambah kelonggaran",
                        "Karena S0 tidak punya dependensi", "Karena S0 disusun oleh ARLS-PPO",
                        "Karena di S0 semua tugas dikerjakan bersamaan"],
        why: () => "Tenggat = selesai di S0 + 0,5 × upaya, jadi selalu lebih lambat daripada waktu selesai di S0." },
    ],
  },
  // ------------------------------------------------------------------ 3
  {
    id: "gangguan", title: "Gangguan datang", minutes: 4,
    goal: "Mengenal lima jenis gangguan, kejadian, dan mengapa semua metode menghadapi gangguan yang sama.",
    steps: [
      {
        title: "Lima jenis gangguan",
        body: () => <ul className="lesson-list">
          <li><b>Pekerjaan tidak terencana</b>: tugas baru masuk di tengah jalan.</li>
          <li><b>Revisi estimasi</b>: upaya sebuah tugas ternyata lebih besar atau lebih kecil.</li>
          <li><b>Rework</b>: review gagal, tugas yang hampir selesai harus dikerjakan lagi.</li>
          <li><b>Perubahan prioritas</b>: sebuah tugas menjadi lebih atau kurang penting.</li>
          <li><b>Pengembang tidak tersedia</b>: seseorang berhenti bekerja beberapa jam.</li></ul>,
        look: () => <>Seberapa sering tiap jenis terjadi diambil dari data Jira nyata (TAWOS). Ketidakhadiran dan perubahan
          prioritas tidak ada di TAWOS, jadi nilainya asumsi yang ditulis terang di naskah (Subbab 3.2.4).</>,
      },
      {
        title: "Gangguan ditarik dari seed",
        body: (c) => {
          const g = c.d.log.disruptions!;
          return <p>Daftar gangguan ditarik secara acak, tetapi dari angka awal yang tetap: seed episode {String(g.seed_inputs["seed episode"])}
            {" "}menghasilkan seed gangguan {g.seed}. Seed itu tidak memuat nama metode, jadi semua metode mendapat gangguan yang
            sama persis.</p>;
        },
        look: () => <>Inilah yang membuat perbandingan adil: semua metode mengerjakan soal yang sama.</>,
      },
      {
        title: "Kejadian: gangguan yang datang berdekatan",
        body: (c) => {
          const g = c.d.log.disruptions!;
          const total = Object.values(g.counts).reduce((a, b) => a + b, 0);
          return <><p>Gangguan yang jatuh dalam satu E ({c.n(g.window, 2)} jam) dari gangguan pertamanya digabung menjadi satu
            <b> kejadian</b>, lalu ditangani sekaligus. Episode ini punya {total} gangguan dalam {g.events.length} kejadian:</p>
            <table className="mini mini--wide lesson-table"><thead><tr><th>Kejadian</th><th>Jam keputusan</th><th>Gangguan</th></tr></thead>
              <tbody>{g.events.map((e, i) => <tr key={i}><td>{i + 1}</td><td>{c.n(e.time, 1)}</td>
                <td>{e.members.map((m) => c.d.log.disruption_types[m.type]).join(", ")}</td></tr>)}</tbody></table></>;
        },
        look: () => <>Keputusan diambil pada jam gangguan terakhir dalam kejadian itu.</>,
      },
      {
        title: "Kejadian pertama",
        body: (c) => {
          const a = away(c), b = c.d.ev[0].disruptions[1];
          const da = a.detail as Record<string, number>, db = b.detail as Record<string, number>;
          return <p>Jam {c.n(c.d.ev[0].time, 1)}: {c.dev(da.pengembang)} tidak tersedia {c.n(da.lama, 1)} jam dan
            {" "}{c.dev(db.pengembang)} tidak tersedia {c.n(db.lama, 1)} jam. Tugas mereka yang belum selesai harus menunggu.</p>;
        },
        look: () => <>Area abu-abu bergaris adalah jam saat pengembang tidak tersedia.</>,
        visual: { kind: "gantt", method: PPO, k: 0, phase: "aor", ghost: false,
                  highlight: (c) => [...away(c).direct, ...c.d.ev[0].disruptions[1].direct].map(c.key),
                  caption: "Kejadian 1, sesudah gangguan masuk" },
      },
    ],
    quiz: [
      { id: "3a", q: () => "Mengapa semua metode menghadapi gangguan yang sama?",
        options: () => ["Karena gangguan ditarik dari seed yang tidak bergantung pada metode",
                        "Karena gangguan ditulis tangan untuk setiap proyek",
                        "Karena gangguan dipilih oleh ARLS-PPO", "Karena hanya ada satu jenis gangguan"],
        why: () => "Seed gangguan dihitung dari instans, intensitas, dan seed episode, tanpa nama metode." },
      { id: "3b", q: (c) => { const a = away(c), b = c.d.ev[0].disruptions[1]; return `Dua gangguan datang pada jam ${c.n(a.time, 2)} dan jam ${c.n(b.time, 2)}, dan E = ${c.n(c.d.log.disruptions!.window, 2)}. Apakah keduanya satu kejadian?`; },
        options: () => ["Ya, karena selisih waktunya kurang dari E", "Tidak, karena setiap gangguan selalu menjadi kejadian sendiri",
                        "Tidak, karena pengembangnya berbeda", "Ya, karena jenisnya sama"],
        why: () => "Gangguan yang jatuh dalam satu E dari gangguan pertama kelompoknya digabung menjadi satu kejadian." },
    ],
  },
  // ------------------------------------------------------------------ 4
  {
    id: "langkah-2", title: "Gangguan masuk, belum diperbaiki", minutes: 5,
    goal: "Memahami langkah ② di setiap kejadian: apa yang berubah, apa yang tidak, dan keterlambatan yang muncul.",
    steps: [
      {
        title: "① Sebelum gangguan",
        body: (c) => { const t = c.task(0); return <p>Ini jadwal tepat sebelum kejadian pertama. {c.key(0)} dijadwalkan selesai jam {c.n(t.C, 0)},
          sedangkan tenggatnya jam {c.n(t.d, 0)}. Aman.</p>; },
        look: () => <>Lihat batang biru terang dan segitiga merah di atasnya: batang selesai sebelum segitiga.</>,
        visual: { kind: "gantt", method: PPO, k: 0, phase: "before", ghost: false, highlight: (c) => [c.key(0)],
                  caption: "Kejadian 1, langkah ①" },
      },
      {
        title: "② Gangguan dimasukkan",
        body: (c) => {
          const s = shiftOf(c, 0), da = away(c).detail as Record<string, number[] & number>;
          return <p>{c.dev(0)} tidak tersedia dari jam {c.n(da.jeda[0], 1)} sampai {c.n(da.jeda[1], 1)}. Sisa pekerjaan {c.key(0)} harus
            menunggu, jadi selesainya mundur dari jam {c.n(s.C_sebelum, 1)} ke jam {c.n(s.C_sesudah, 1)}. Tugas di belakangnya ikut tergeser.</p>;
        },
        look: (c) => { const s = shiftOf(c, 0), t = c.task(0); return <>Kotak putus-putus = posisi di langkah ①. Bagian merah = lewat tenggat:
          {" "}{c.key(0)} kini terlambat {c.n(s.C_sesudah, 1)} − {c.n(t.d, 0)} = {c.n(s.C_sesudah - t.d, 1)} jam.</>; },
        visual: { kind: "gantt", method: PPO, k: 0, phase: "aor", highlight: (c) => [c.key(0)],
                  caption: "Kejadian 1, langkah ②" },
      },
      {
        title: "Apa yang tidak berubah",
        body: () => <p>Di langkah ② urutan antrean dan siapa yang mengerjakan <b>tidak diubah</b>. Tugas hanya digeser ke
          kanan seperlunya. Hasilnya selalu sah, tetapi bisa terlambat.</p>,
        look: () => <>Di naskah langkah ini disebut <b>tingkat 0</b> atau <b>AOR</b>. Semua metode melewatinya lebih dulu.
          Metode pembanding bernama AOR berhenti di sini dan tidak pernah memperbaiki.</>,
      },
      {
        title: "Keterlambatan total",
        body: (c) => {
          const s = c.d.ev[0].subs, last = s[s.length - 1].levels["0"];
          return <><p>Jumlahkan keterlambatan semua tugas, lalu bagi dengan E:</p>
            <Calc f="Tard" r={`${c.n(last.tard, 2)} jam`} />
            <Calc f="Tard / E" s={`${c.n(last.tard, 2)} / ${c.n(c.d.log.input!.E.value, 4)}`} r={c.n(c.d.ev[0].tard_aor, 3)} /></>;
        },
        look: () => <>Angka Tard/E ini adalah titik awal. Pertanyaannya: bisakah perbaikan menurunkannya?</>,
      },
      {
        title: "Affected set A_j: tugas yang terkena",
        body: (c) => <p>Tugas yang terkena satu gangguan disebut <i>affected set</i> A_j: tugas milik pengembang yang tidak tersedia,
          ditambah tugas yang tergeser lalu lewat tenggat. Untuk ketidakhadiran {c.dev(0)}: A_1 = {"{"}{away(c).affected.map(c.key).join(", ")}{"}"}.</p>,
        look: () => <>Perbaikan hanya menyentuh tugas di sekitar A_j, tidak seluruh jadwal.</>,
        visual: { kind: "gantt", method: PPO, k: 0, phase: "aor", ghost: false, highlight: (c) => away(c).affected.map(c.key),
                  caption: "A_1 pada kejadian 1" },
      },
    ],
    quiz: [
      { id: "4a", q: () => "Di langkah ② (gangguan masuk), apa yang terjadi pada antrean dan assignee?",
        options: () => ["Tidak berubah; tugas hanya digeser ke kanan seperlunya", "Antrean diurutkan ulang menurut tenggat",
                        "Tugas dipindah ke pengembang yang paling kosong", "Semua tugas dijadwal ulang dari nol"],
        why: () => "Langkah ② (tingkat 0, AOR) hanya menyerap gangguan; perbaikan baru terjadi di langkah ③." },
      { id: "4b", q: (c) => { const s = shiftOf(c, 0), t = c.task(0); return `${c.key(0)} kini selesai jam ${c.n(s.C_sesudah, 1)} dan tenggatnya jam ${c.n(t.d, 0)}. Berapa keterlambatannya?`; },
        options: (c) => { const s = shiftOf(c, 0), t = c.task(0); return [`${c.n(s.C_sesudah - t.d, 1)} jam`, "0 jam", `${c.n(s.C_sesudah, 1)} jam`, `${c.n(t.d, 0)} jam`]; },
        why: (c) => { const s = shiftOf(c, 0), t = c.task(0); return `Keterlambatan = max(0, selesai − tenggat) = ${c.n(s.C_sesudah, 1)} − ${c.n(t.d, 0)} = ${c.n(s.C_sesudah - t.d, 1)} jam.`; } },
      { id: "4c", q: () => "Metode pembanding bernama AOR…",
        options: () => ["berhenti di langkah ② dan tidak pernah memperbaiki", "selalu memakai tingkat 3",
                        "adalah teacher yang ditiru ARLS-PPO", "memakai jaringan saraf"],
        why: () => "AOR dipakai sebagai patokan: seberapa buruk jadwal bila gangguan hanya diserap tanpa perbaikan." },
    ],
  },
  // ------------------------------------------------------------------ 5
  {
    id: "tingkat", title: "Empat tingkat perbaikan", minutes: 6,
    goal: "Mengenal L0, L1, L2, L3 lewat satu masalah nyata, dan arti mask.",
    steps: [
      {
        title: "Masalah di kejadian kedua",
        body: (c) => { const u = urgent(c); return <><p>Jam {c.n(c.d.ev[1].time, 1)} datang pekerjaan tidak terencana <b>{c.key(u.tugas_baru)}</b> untuk {c.dev(u.pengembang)},
          upaya {c.n(u.upaya, 2)} jam, prioritas tinggi, jadi tenggatnya ketat:</p>
          <Calc f="tenggat = t + 1,5 × upaya" s={`${c.n(u.t, 2)} + 1,5 × ${c.n(u.upaya, 2)}`} r={c.n(u.tenggat, 2)} />
          <p>Di langkah ② ia ditaruh di akhir antrean {c.dev(u.pengembang)}, jadi baru selesai jam {c.n(u.selesai, 1)}.</p></>; },
        look: (c) => { const u = urgent(c); return <>{c.key(u.tugas_baru)} terlambat sekitar {c.n(u.selesai - u.tenggat, 1)} jam.
          Tard/E naik dari {c.n(c.d.ev[1].tard_before, 3)} ke {c.n(c.d.ev[1].tard_aor, 3)}.</>; },
        visual: { kind: "gantt", method: PPO, k: 1, phase: "aor", ghost: false, highlight: (c) => [c.key(urgent(c).tugas_baru)],
                  notes: (c) => ({ [c.key(urgent(c).tugas_baru)]: "baru" }), caption: "Kejadian 2, langkah ②" },
      },
      {
        title: "L0: tanpa perbaikan",
        body: (c) => <p>Pilihan pertama: biarkan seperti langkah ②. Tidak ada tugas yang berubah, jadi Tard/E tetap
          {" "}{c.n(c.lv(1, 1, 0).tard_over_E, 3)}.</p>,
        look: () => <>L0 selalu boleh dipilih dan selalu sah.</>,
      },
      {
        title: "L1 Resequence: ubah urutan di antrean sendiri",
        body: (c) => { const u = urgent(c); const q = c.lv(1, 1, 1).queues!.find((x) => x.dev === u.pengembang)!;
          return <p>Tugas yang terkena dimajukan ke posisi menurut tenggatnya di antrean pengembangnya sendiri. {c.key(u.tugas_baru)}
            {" "}maju dari posisi {q.lama.indexOf(u.tugas_baru) + 1} ke posisi {q.baru.indexOf(u.tugas_baru) + 1} di antrean {c.dev(u.pengembang)}.</p>; },
        look: (c) => <>Satu tugas pindah posisi. Tard/E turun ke {c.n(c.lv(1, 1, 1).tard_over_E, 3)}. Kotak putus-putus = posisinya di langkah ②.</>,
        visual: { kind: "gantt", method: "seq", k: 1, phase: "after", highlight: (c) => [c.key(urgent(c).tugas_baru)],
                  caption: "Hasil L1 pada kejadian 2" },
      },
      {
        title: "L2 Reassign: pindahkan ke pengembang lain",
        body: (c) => { const m = c.lv(1, 1, 2).moved_dev![0];
          return <p>Paling banyak tiga tugas yang paling terlambat dipindah ke pengembang lain yang layak. {c.key(m.tugas)} dipindah dari
            {" "}{c.dev(m.dari)} ke {c.dev(m.ke)}.</p>; },
        look: (c) => <>Satu tugas pindah pengembang. Tard/E turun ke {c.n(c.lv(1, 1, 2).tard_over_E, 3)}, tidak serendah L1.</>,
        visual: { kind: "gantt", method: PPO, k: 1, phase: "after", highlight: (c) => [c.key(urgent(c).tugas_baru)],
                  caption: "Hasil L2 pada kejadian 2" },
      },
      {
        title: "L3 Partial rescheduling: susun ulang sebagian",
        body: (c) => <p>Paling banyak delapan tugas yang belum mulai di sekitar waktu sekarang dikeluarkan, lalu disisipkan kembali
          satu per satu, tenggat terdekat dulu. Di kejadian ini hasilnya sama dengan L1: Tard/E {c.n(c.lv(1, 1, 3).tard_over_E, 3)}.</p>,
        look: () => <>Tingkat makin tinggi berarti jangkauan makin luas, tetapi hasilnya <b>belum tentu</b> makin baik.</>,
        visual: { kind: "gantt", method: "fix3_g", k: 1, phase: "after", highlight: (c) => [c.key(urgent(c).tugas_baru)],
                  caption: "Hasil L3 pada kejadian 2" },
      },
      {
        title: "Mask: tingkat yang tidak punya calon",
        body: (c) => { const m = c.d.ev[0].subs[0].mask!;
          return <p>Kadang sebuah tingkat tidak punya calon perbaikan yang sah, misalnya tidak ada tugas yang bisa dimajukan atau tidak ada
            pengembang lain yang layak. Tingkat itu ditutup (<i>mask</i> = 0) dan tidak bisa dipilih. Pada gangguan pertama kejadian 1,
            mask L1, L2, L3 = [{m.join(", ")}].</p>; },
        look: () => <>Mask dihitung dari aturan kelayakan yang sama dengan pemeriksa jadwal: keahlian, ketersediaan, dependensi, dan kapasitas.</>,
      },
    ],
    quiz: [
      { id: "5a", q: () => "Tingkat mana yang hanya mengubah urutan di antrean pengembang yang sama?",
        options: () => ["L1 Resequence", "L2 Reassign", "L0 Tanpa perbaikan", "Tidak ada"],
        why: () => "L1 memajukan tugas di antreannya sendiri; L2 memindahkan tugas ke pengembang lain." },
      { id: "5b", q: () => "Apa arti mask = 0 untuk sebuah tingkat?",
        options: () => ["Tingkat itu tidak punya calon perbaikan yang sah, jadi tidak boleh dipilih", "Tingkat itu selalu paling baik",
                        "Tingkat itu sudah dipakai", "Tingkat itu tidak mengubah apa pun"],
        why: () => "Mask menutup tingkat yang operatornya tidak menemukan perbaikan yang sah. Tingkat 0 selalu terbuka." },
      { id: "5c", q: () => "Apakah tingkat yang lebih tinggi selalu memberi hasil yang lebih baik?",
        options: (c) => [`Tidak; di kejadian 2, L2 (Tard/E ${c.n(c.lv(1, 1, 2).tard_over_E, 3)}) lebih buruk daripada L1 (${c.n(c.lv(1, 1, 1).tard_over_E, 3)})`,
                         "Ya, L3 selalu paling baik", "Ya, karena jangkauannya lebih luas", "Tidak bisa dibandingkan"],
        why: () => "Setiap tingkat cocok untuk situasi yang berbeda. Itulah mengapa perlu ada yang memilih tingkat." },
    ],
  },
  // ------------------------------------------------------------------ 6
  {
    id: "ukuran-j", title: "Mengukur dengan J", minutes: 6,
    goal: "Menghitung banyak perubahan U (termasuk LIS) dan nilai gabungan J = Tard/E + λ × U.",
    steps: [
      {
        title: "Dua hal yang ingin dijaga",
        body: () => <p>Manajer proyek ingin dua hal: tugas <b>tidak terlambat</b>, dan jadwal <b>tidak terus berubah</b>, karena tim bingung
          kalau rencana diganti terus. Keduanya sering bertentangan: memperbaiki keterlambatan berarti mengubah jadwal.</p>,
        look: () => <>Di naskah, kestabilan jadwal diukur dengan banyak perubahan U (Subbab 3.3.5).</>,
      },
      {
        title: "Menghitung perubahan U",
        body: (c) => { const b = c.lv(1, 1, 2);
          return <p>U = tugas yang pindah pengembang + tugas yang pindah posisi di antrean. L2 di kejadian 2 memindahkan
            {" "}{c.key(b.moved_dev![0].tugas)} ke {c.dev(b.moved_dev![0].ke)} dan tidak mengubah posisi lain, jadi U = {b.md} + {b.mp} = {b.U}.</p>; },
        look: () => <>U dihitung terhadap jadwal di langkah ②, bukan terhadap S0.</>,
      },
      {
        title: "Pindah posisi dihitung dengan LIS",
        body: () => <p>Bagaimana menghitung tugas yang pindah posisi? Ambil posisi lama setiap tugas menurut urutan antrean baru,
          lalu cari barisan naik terpanjang (LIS). Tugas di dalam LIS tidak perlu disentuh; sisanya dihitung pindah.</p>,
        look: () => <>Memajukan satu tugas melewati banyak tugas lain tetap dihitung <b>satu</b> perubahan.</>,
        visual: { kind: "node", render: (c) => <QueueDemo c={c} /> },
      },
      {
        title: "Satu angka: J",
        body: (c) => <><p>J menjumlahkan keduanya: J = Tard/E + λ × U. λ adalah <i>change penalty</i>, harga satu perubahan; di sini
          λ = {c.n(c.d.log.meta.lam, 0)}. Untuk gangguan kedua di kejadian 2:</p>
          <LevelTable c={c} k={1} j={1} lam={c.d.log.meta.lam} /></>,
        look: () => <>J makin kecil makin baik. Di sini L1 dan L3 paling kecil, L2 di tengah, L0 paling besar.</>,
      },
    ],
    quiz: [
      { id: "6a", q: () => "Sebuah perbaikan memberi Tard/E = 7,2 dengan 2 perubahan, dan λ = 3. Berapa J?",
        options: () => ["13,2", "9,2", "7,2", "21,6"], why: () => "J = 7,2 + 3 × 2 = 13,2." },
      { id: "6b", q: () => "Antrean lama [A, B, C, D] menjadi [D, A, B, C]. Berapa tugas yang pindah posisi?",
        options: () => ["1", "4", "3", "0"],
        why: () => "Posisi lama menurut urutan baru = [4, 1, 2, 3]. LIS = [1, 2, 3], panjang 3. Pindah posisi = 4 − 3 = 1 (hanya D)." },
      { id: "6c", q: () => "Mengapa J menjumlahkan keterlambatan dan banyak perubahan?",
        options: () => ["Supaya keduanya dinilai dalam satu angka, dengan λ sebagai harga satu perubahan",
                        "Karena perubahan selalu menurunkan keterlambatan", "Karena keterlambatan tidak penting",
                        "Karena U selalu nol"],
        why: () => "Satu angka membuat pilihan bisa dibandingkan; λ mengatur seberapa mahal satu perubahan." },
    ],
  },
  // ------------------------------------------------------------------ 7
  {
    id: "lambda", title: "Change penalty λ", minutes: 5,
    goal: "Memahami mengapa sebuah perbaikan bisa tidak sepadan, dan apa yang diatur λ.",
    steps: [
      {
        title: "Kejadian keempat: rework",
        body: (c) => { const r = rework(c);
          return <><p>Jam {c.n(c.d.ev[3].time, 0)}, review {c.key(r.tugas)} gagal. Tugas itu kembali belum mulai, dan upayanya bertambah:</p>
            <Calc f="upaya baru = upaya lama + 0,47 × upaya semula" s={`${c.n(r.upaya_sebelum, 2)} + ${c.n(r.tambahan, 2)}`} r={`${c.n(r.upaya_sesudah, 2)} jam`} />
            <p>Tugas-tugas di belakangnya ikut mundur. Tard/E menjadi {c.n(c.d.ev[3].tard_aor, 3)}.</p></>; },
        look: () => <>Batang terang adalah tugas yang terkena rework dan tugas yang ikut tergeser.</>,
        visual: { kind: "gantt", method: PPO, k: 3, phase: "aor", highlight: (c) => c.d.ev[3].subs[0].affected.map(c.key),
                  caption: "Kejadian 4, langkah ②" },
      },
      {
        title: "Coba L1",
        body: (c) => { const b0 = c.lv(3, 0, 0), b1 = c.lv(3, 0, 1);
          return <><p>L1 menurunkan Tard/E dari {c.n(b0.tard_over_E, 3)} ke {c.n(b1.tard_over_E, 3)}, turun
            {" "}{c.n(b0.tard_over_E! - b1.tard_over_E!, 3)}. Tetapi ada {b1.U} perubahan, harganya λ × {b1.U} = {c.n(c.d.log.meta.lam * b1.U!, 0)}.</p>
            <Calc f="J (L1)" s={`${c.n(b1.tard_over_E, 3)} + ${c.n(c.d.log.meta.lam, 0)} × ${b1.U}`} r={c.n(b1.J, 3)} />
            <Calc f="J (L0)" s={`${c.n(b0.tard_over_E, 3)} + ${c.n(c.d.log.meta.lam, 0)} × 0`} r={c.n(b0.J, 3)} /></>; },
        look: (c) => { const b0 = c.lv(3, 0, 0), b1 = c.lv(3, 0, 1);
          return <>Penurunan keterlambatan ({c.n(b0.tard_over_E! - b1.tard_over_E!, 3)}) lebih kecil daripada harga perubahan
            ({c.n(c.d.log.meta.lam * b1.U!, 0)}). Pada λ = {c.n(c.d.log.meta.lam, 0)}, perbaikan ini <b>tidak sepadan</b>.</>; },
      },
      {
        title: "Bagaimana bila λ kecil?",
        body: (c) => { const b0 = c.lv(3, 0, 0), b1 = c.lv(3, 0, 1);
          return <><p>Misalkan di kejadian ini λ = 0,3, perubahan jadi murah:</p>
            <Calc f="J (L1)" s={`${c.n(b1.tard_over_E, 3)} + 0,3 × ${b1.U}`} r={c.n(b1.tard_over_E! + 0.3 * b1.U!, 3)} />
            <Calc f="J (L0)" s={`${c.n(b0.tard_over_E, 3)} + 0,3 × 0`} r={c.n(b0.tard_over_E, 3)} />
            <p>Sekarang L1 lebih kecil, jadi perbaikan dipakai.</p></>; },
        look: () => <>Inilah gunanya λ: pengguna mengatur seberapa mahal sebuah perubahan. Satu kebijakan ARLS-PPO menerima λ sebagai
          masukan, jadi tidak perlu dilatih ulang untuk setiap λ.</>,
      },
      {
        title: "λ di tesis",
        body: () => <p>Tesis menguji λ dari 0,1 sampai 30, dan menandai 0,3, 3, dan 30 sebagai nilai berlabel: perubahan murah, sedang,
          dan mahal. Di halaman Simulasi, λ bisa dipilih sebelum menekan Jalankan.</p>,
        look: () => <>λ kecil: kejar keterlambatan. λ besar: jaga jadwal tetap.</>,
      },
    ],
    quiz: [
      { id: "7a", q: () => "Pada λ = 3, sebuah perbaikan menurunkan Tard/E sebesar 2 dengan 1 perubahan. Apa akibatnya pada J?",
        options: () => ["J naik, karena penurunan 2 lebih kecil daripada harga 3", "J turun 2", "J tidak berubah", "J turun 5"],
        why: () => "Perubahan J = −2 + 3 × 1 = +1, jadi J naik." },
      { id: "7b", q: () => "λ besar berarti…",
        options: () => ["perubahan mahal, jadi jadwal cenderung dijaga tetap", "perubahan murah, jadi sering diperbaiki",
                        "keterlambatan tidak dihitung", "semua tingkat ditutup mask"],
        why: () => "λ adalah harga satu perubahan di dalam J." },
    ],
  },
  // ------------------------------------------------------------------ 8
  {
    id: "pemilih", title: "Siapa yang memilih tingkat?", minutes: 6,
    goal: "Memahami teacher, ARLS-PPO, dan guard, lewat dua keputusan nyata.",
    steps: [
      {
        title: "Teacher: mencoba semuanya",
        body: (c) => { const lv = c.d.events.seq[1].levels[1]!;
          return <p><b>Sequential Lookahead</b> mencoba L1, L2, dan L3 pada salinan jadwal, menghitung J masing-masing, lalu memakai yang
            terkecil. Di kejadian 2 ia memilih {LEVEL_SHORT[lv]} (J {c.n(c.lv(1, 1, lv).J, 3)}).</p>; },
        look: () => <>Hasilnya bagus tetapi lambat, karena harus mencoba semua tingkat setiap kali. Ia menjadi <b>teacher</b>:
          contoh yang ditiru.</>,
      },
      {
        title: "ARLS-PPO membaca 38 angka",
        body: () => <p>ARLS-PPO tidak mencoba semua tingkat. Ia membaca ringkasan <b>38 angka</b> tentang jadwal dan gangguan (misalnya berapa
          tugas terkena, seberapa terlambat, beban pengembang, dan log λ), lalu sebuah jaringan saraf kecil memberi peluang setiap tingkat.</p>,
        look: (c) => { const p = sub2(c).selector!.probs!; const best = p.indexOf(Math.max(...p));
          return <>Peluang terbesar {LEVEL_SHORT[best]} ({c.n(p[best], 3)}), jadi ARLS-PPO meminta {LEVEL_SHORT[best]}. Ini cepat:
            p95 waktunya {c.n(c.sum(PPO).ms_selector_p95, 2)} ms.</>; },
        visual: { kind: "node", render: (c) => <Probs p={sub2(c).selector!.probs!} /> },
      },
      {
        title: "Guard memeriksa sebelum dipakai",
        body: (c) => { const dd = sub2(c).decision!;
          return <><p>Tingkat yang diminta dicoba dulu pada salinan jadwal. Bila J-nya lebih besar daripada J sekarang, permintaan ditolak
            dan jadwal dibiarkan. Di kejadian 2:</p>
            <Calc f="J calon ≤ J sekarang ?" s={`${c.n(dd.J_candidate, 3)} ≤ ${c.n(dd.J_now, 3)}`} r={dd.accepted ? "ya, diterima" : "tidak, ditolak"} /></>; },
        look: () => <><b>Guard</b> menjamin pilihan ARLS-PPO tidak pernah membuat J sub-keputusan itu lebih buruk daripada tidak memperbaiki.</>,
      },
      {
        title: "Guard menolak",
        body: (c) => { const s = c.d.ev[3].subs[0], dd = s.decision!, p = s.selector!.probs!;
          return <><p>Di kejadian 4, ARLS-PPO meminta {LEVEL_SHORT[dd.requested]} (peluang {c.n(p[dd.requested], 3)}).</p>
            <Calc f="J calon ≤ J sekarang ?" s={`${c.n(dd.J_candidate, 3)} ≤ ${c.n(dd.J_now, 3)}`} r={dd.accepted ? "ya, diterima" : "tidak, ditolak"} />
            <p>Guard menolak, jadi tingkat 0 yang dipakai.</p></>; },
        look: () => <>Ini sama dengan pelajaran λ: pada λ = 3 semua perbaikan di kejadian ini lebih mahal daripada manfaatnya.</>,
      },
      {
        title: "Tidak selalu sama dengan teacher",
        body: (c) => { const lvT = c.d.events.seq[1].levels[1]!, lvP = c.d.events[PPO][1].levels[1]!;
          return <p>Di kejadian 2, ARLS-PPO memakai {LEVEL_SHORT[lvP]} (J {c.n(c.lv(1, 1, lvP).J, 3)}), sedangkan teacher memakai
            {" "}{LEVEL_SHORT[lvT]} (J {c.n(c.lv(1, 1, lvT).J, 3)}). Jadi ARLS-PPO tidak selalu memilih yang terbaik; ia meniru teacher
            sebaik mungkin, tetapi jauh lebih cepat.</p>; },
        look: () => <>ARLS-PPO dilatih dari pilihan teacher (behavior cloning), satu putaran DAgger, lalu 100.000 langkah PPO, pada 7 instans
          Brandimarte. Proyek kedai kopi ini <b>tidak</b> ada di data latihnya.</>,
      },
    ],
    quiz: [
      { id: "8a", q: () => "Apa tugas guard?",
        options: () => ["Menolak tingkat yang membuat J lebih besar daripada J sekarang", "Memilih tingkat terbaik dari semua tingkat",
                        "Melatih jaringan saraf", "Menambah gangguan baru"],
        why: () => "Guard hanya memeriksa tingkat yang diminta; ia tidak mencari tingkat terbaik." },
      { id: "8b", q: () => "Mengapa tidak memakai teacher saja?",
        options: () => ["Teacher harus mencoba semua tingkat setiap kali, jadi lambat", "Teacher selalu salah",
                        "Teacher tidak bisa menghitung J", "Teacher melanggar kapasitas"],
        why: () => "Tujuan tesis adalah keputusan yang cepat; teacher menjadi contoh untuk dilatih." },
      { id: "8c", q: (c) => `Peluang ARLS-PPO di kejadian 2 adalah [${sub2(c).selector!.probs!.map((p) => c.n(p, 3)).join("; ")}] untuk L0 sampai L3. Tingkat mana yang diminta?`,
        options: (c) => { const p = sub2(c).selector!.probs!; const best = p.indexOf(Math.max(...p));
          return [LEVEL_SHORT[best], ...[0, 1, 2, 3].filter((l) => l !== best).map((l) => LEVEL_SHORT[l])]; },
        why: () => "Kebijakan dijalankan deterministik: tingkat dengan peluang terbesar yang diminta." },
    ],
  },
  // ------------------------------------------------------------------ 9
  {
    id: "episode", title: "Satu episode utuh", minutes: 5,
    goal: "Membaca hasil satu episode, membandingkan metode, dan tahu bedanya dengan hasil tesis.",
    steps: [
      {
        title: "Lima kejadian berurutan",
        body: (c) => <><p>Keputusan di satu kejadian menjadi jadwal awal kejadian berikutnya. Ringkasan ARLS-PPO:</p>
          <table className="mini mini--wide lesson-table"><thead><tr><th>Kejadian</th><th>Jam</th><th>Tingkat dipakai</th><th>U</th><th>Tard/E sesudahnya</th></tr></thead>
            <tbody>{ppoEvents(c).map((e) => <tr key={e.index}><td>{e.index + 1}</td><td>{c.n(e.time, 1)}</td>
              <td>{e.levels.map((l) => (l === null ? "–" : LEVEL_SHORT[l])).join(", ")}</td><td>{e.changes}</td><td>{c.n(e.tard_after, 3)}</td></tr>)}</tbody></table></>,
        look: () => <>Mulai kejadian 2, jadwal setiap metode bisa berbeda karena keputusannya berbeda.</>,
      },
      {
        title: "J episode",
        body: (c) => { const o = c.d.log.output!;
          return <><p>Di akhir episode, keterlambatan akhir dan semua perubahan dijumlahkan:</p>
            <Calc f="J episode = Tard akhir / E + λ × Σ U" s={`${c.n(o.tard_over_E, 3)} + ${c.n(o.lam, 0)} × ${o.changes}`} r={c.n(o.J, 3)} /></>; },
        look: () => <>Ini angka yang dipakai untuk membandingkan metode pada satu episode.</>,
      },
      {
        title: "Semua metode pada gangguan yang sama",
        body: (c) => <table className="mini mini--wide lesson-table"><thead><tr><th>Metode</th><th>J episode</th><th>Tard/E akhir</th><th>Σ U</th></tr></thead>
          <tbody>{["aor", PPO, "seq", "fix3_g", "acak_g"].map((k) => { const r = c.sum(k);
            return <tr key={k}><td>{r.method === "aor" ? "AOR (tanpa perbaikan)" : r.name}</td><td>{c.n(r.J, 3)}</td><td>{c.n(r.tard, 3)}</td><td>{r.changes}</td></tr>; })}</tbody></table>,
        look: (c) => <>Pada proyek kecil ini ARLS-PPO ({c.n(c.sum(PPO).J, 3)}) lebih baik daripada AOR ({c.n(c.sum("aor").J, 3)}) tetapi kalah dari
          teacher ({c.n(c.sum("seq").J, 3)}). Ini <b>satu contoh saja</b>, bukan hasil tesis.</>,
      },
      {
        title: "Hasil tesis yang sebenarnya",
        body: () => <p>Kesimpulan tesis diambil dari <b>data uji</b> yang tidak dipakai melatih dan dibuka sekali: MK03, MK04, MK09, dan
          35 instans benchmark, dengan banyak seed. Hasilnya: ARLS-PPO lebih baik daripada Random + guard, dan tidak ditemukan selisih yang
          tegas terhadap Fixed-L3 + guard. Rinciannya ada di halaman <b>Hasil uji tesis</b> dan Bab V.</p>,
        look: () => <>Satu episode bisa menyesatkan. Karena itu tesis memakai banyak instans, banyak seed, dan selang kepercayaan.</>,
      },
      {
        title: "Semua angka ini deterministik",
        body: () => <p>Bila dijalankan ulang dengan proyek, kapasitas, intensitas, seed, λ, metode, dan berkas model yang sama, semua angka di
          pelajaran ini sama persis. Hanya waktu (ms) yang berubah dari run ke run.</p>,
        look: () => <>Di halaman Simulasi, tab Log hitung punya tombol "Jalankan ulang tanpa cache dan bandingkan" untuk membuktikannya.</>,
      },
    ],
    quiz: [
      { id: "9a", q: () => "Mengapa jadwal ARLS-PPO dan AOR bisa berbeda di kejadian 3, padahal gangguannya sama?",
        options: () => ["Karena keputusan mereka di kejadian sebelumnya berbeda", "Karena seed gangguannya berbeda",
                        "Karena proyeknya berbeda", "Karena AOR memakai λ yang lain"],
        why: () => "Gangguan sama untuk semua metode; yang berbeda adalah cara setiap metode memperbaiki kejadian sebelumnya." },
      { id: "9b", q: (c) => { const r = c.sum("seq"); return `Teacher mengakhiri episode dengan Tard/E ${c.n(r.tard, 3)} dan ${r.changes} perubahan, λ = 3. Berapa J episodenya?`; },
        options: (c) => { const r = c.sum("seq"); return [c.n(r.J, 3), c.n(r.tard, 3), c.n(r.tard + r.changes, 3), c.n(3 * r.tard, 3)]; },
        why: (c) => { const r = c.sum("seq"); return `J = ${c.n(r.tard, 3)} + 3 × ${r.changes} = ${c.n(r.J, 3)}.`; } },
      { id: "9c", q: () => "Kesimpulan tesis tentang ARLS-PPO diambil dari…",
        options: () => ["data uji yang tidak dipakai melatih, dengan banyak instans dan seed", "proyek kedai kopi ini",
                        "satu episode MK01", "data latih"],
        why: () => "Proyek contoh hanya untuk belajar; klaim tesis berasal dari data uji (Bab V)." },
    ],
  },
];
