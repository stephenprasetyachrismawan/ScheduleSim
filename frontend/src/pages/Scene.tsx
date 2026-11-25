// What the schedule on screen is: which event, which method's schedule, and which of the three
// steps of that event. Every method meets the same disruptions; from the second event on, the
// schedules differ because each method repaired the earlier events in its own way.
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, Eye } from "lucide-react";
import { api } from "../api";
import { LEVEL_SHORT, Ladder } from "../components/atoms";
import { angka } from "../format";
import { Info } from "../learn/Learn";
import type { EventDetail, EventSummary, MethodSummary, Phase } from "../types";

export const STEPS: { value: Phase; n: string; label: string }[] = [
  { value: "before", n: "①", label: "Sebelum gangguan" },
  { value: "aor", n: "②", label: "Gangguan masuk" },
  { value: "after", n: "③", label: "Sesudah perbaikan" },
];

export function methodLabel(r: { name: string; method: string }): string {
  return r.method === "aor" ? `${r.name} (tanpa perbaikan)` : r.name;
}

interface Props {
  runId: string;
  results: MethodSummary[];
  current: string;
  onPick: (key: string) => void;
  k: number;
  total: number;
  phase: Phase;
  onPhase: (p: Phase) => void;
  event: EventDetail;
  /** Issue keys to look at in this step (marked on the board and timeline too). */
  focus?: string[];
  playing?: boolean;
}

function caption(phase: Phase, k: number, name: string, isAor: boolean, ev: EventSummary | undefined): string {
  if (phase === "before") {
    return k === 0
      ? "Jadwal awal proyek (S0), tepat sebelum gangguan pertama datang. Semua metode mulai dari jadwal yang sama."
      : `Jadwal ${name} tepat sebelum gangguan kejadian ini datang. Jadwal ini adalah hasil keputusan ${name} pada kejadian-kejadian sebelumnya, jadi bisa berbeda dari jadwal metode lain.`;
  }
  if (phase === "aor") {
    return "Gangguan sudah dimasukkan ke jadwal, tetapi belum diperbaiki. Tugas baru ditaruh di akhir antrean pengembangnya, "
      + "dan tugas yang terkena digeser ke kanan seperlunya. Urutan antrean dan assignee belum diubah. "
      + "Semua metode melewati langkah ini lebih dulu; di naskah langkah ini disebut tingkat 0 atau AOR. "
      + "Kotak putus-putus = posisi di langkah ①.";
  }
  if (isAor) {
    return "Metode pembanding AOR tidak pernah memperbaiki: ia berhenti di langkah ②. Karena itu langkah ③ selalu sama dengan langkah ②. "
      + "Metode ini dipakai sebagai patokan: seberapa buruk jadwal bila gangguan hanya diserap tanpa perbaikan.";
  }
  const used = ev ? ev.levels.map((l) => (l === null ? "–" : LEVEL_SHORT[l])).join(", ") : "";
  const none = ev && ev.changes === 0;
  return `Jadwal sesudah ${name} memilih tingkat perbaikan untuk setiap gangguan kejadian ini (dipakai: ${used}). `
    + (none ? "Tidak ada tugas yang dipindah, jadi jadwalnya sama dengan langkah ②. "
            : `${ev?.changes ?? 0} perubahan dihitung (tugas pindah pengembang atau pindah posisi). `)
    + "Kotak putus-putus = posisi di langkah ②; kartu yang berubah diberi tanda.";
}

export default function Scene({ runId, results, current, onPick, k, total, phase, onPhase, event, focus = [],
                                playing }: Props) {
  const rows = results.filter((r) => r.model_seed !== "mean");
  const evs = useQueries({
    queries: rows.map((r) => ({ queryKey: ["events", runId, r.key], queryFn: () => api.events(runId, r.key),
                                staleTime: Infinity })),
  });
  const at = (i: number) => evs[i]?.data?.[k];
  const cur = rows.find((r) => r.key === current);
  const curEv = at(rows.findIndex((r) => r.key === current));
  const name = cur ? cur.name : "metode ini";
  return (
    <section className="scene" aria-label="Apa yang sedang ditampilkan">
      <div className="scene__event">
        <strong>Kejadian {k + 1} dari {total}</strong> · jam ke-{angka(event.time)} · {event.disruptions.length} gangguan:{" "}
        {event.affected.map((a, i) => (
          <span key={i} className="scene__dis">{a.label}{a.issues.length ? ` (${a.issues.slice(0, 3).join(", ")}${a.issues.length > 3 ? ", …" : ""})` : ""}</span>
        ))}
        <Info term="event" />
      </div>

      <div className="scene__label">Lihat jadwal menurut metode <Info term="methods" /></div>
      <div className="scene__methods" role="tablist" aria-label="Metode yang jadwalnya ditampilkan" data-tour="methods-switch">
        {rows.map((r, i) => {
          const e = at(i);
          return (
            <button key={r.key} role="tab" aria-selected={r.key === current}
                    className={`mchip ${r.key === current ? "on" : ""}`} onClick={() => onPick(r.key)}>
              <span className="mchip__name">{methodLabel(r)}{typeof r.model_seed === "number" && <span className="muted"> · seed {r.model_seed}</span>}</span>
              <span className="mchip__stats">
                {e ? <>
                  <span className="mchip__lv">{e.levels.map((l, j) => <Ladder key={j} level={r.method === "aor" ? null : l} />)}</span>
                  <span>U {e.changes}</span>
                  <span>Tard/E {angka(e.tard_after, 2)}</span>
                </> : <span className="muted">…</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="scene__label">Langkah dalam kejadian ini <Info term="phases" /></div>
      <div className="scene__steps" role="tablist" aria-label="Langkah" data-tour="phases">
        {STEPS.map((s, i) => (
          <span key={s.value} className="scene__step-wrap">
            {i > 0 && <ArrowRight size={14} className="muted" />}
            <button role="tab" aria-selected={phase === s.value} className={`scene__step ${phase === s.value ? "on" : ""}`}
                    onClick={() => onPhase(s.value)}>
              <b>{s.n}</b> {s.value === "after" ? `${s.label} oleh ${name}` : s.label}
            </button>
          </span>
        ))}
      </div>
      <p className="scene__caption">{caption(phase, k, name, cur?.method === "aor", curEv)}</p>
      {phase !== "before" && (
        <div className="scene__look" aria-live="polite">
          <Eye size={15} />
          <span><b>Perhatikan:</b>{" "}
            {phase === "aor"
              ? (focus.length ? <>tugas yang terkena gangguan (A_j), diberi tanda di jadwal: </> : "tidak ada tugas yang terkena.")
              : (focus.length ? <>tugas yang diubah {name} pada langkah ini: </> : `${name} tidak mengubah tugas apa pun pada kejadian ini.`)}
            {focus.map((key) => <span key={key} className="chip">{key}</span>)}
          </span>
        </div>
      )}
      {playing && <div className="scene__playing">Memutar langkah demi langkah… tekan jeda (⏸) untuk berhenti.</div>}
    </section>
  );
}
