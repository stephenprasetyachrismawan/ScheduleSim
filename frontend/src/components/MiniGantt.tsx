// A small timeline for the lessons: one row per developer, the tasks to look at in colour, the
// others faded. Late parts are hatched red, the due date of a highlighted task is a small mark,
// and a dashed box shows where a highlighted task was in the step before.
import { angka } from "../format";
import type { Frame } from "../types";

interface Props {
  frame: Pick<Frame, "issues" | "assignees" | "ghost" | "t" | "pauses">;
  highlight?: string[];
  /** Short label drawn above a task, e.g. {"KOPI-13": "baru"}. */
  notes?: Record<string, string>;
  showGhost?: boolean;
  showT?: boolean;
  maxT?: number;
  caption?: string;
}

const W = 760, NAME = 150, ROW = 34, TOP = 22, BOTTOM = 22;

export default function MiniGantt({ frame, highlight = [], notes = {}, showGhost = true, showT = true,
                                    maxT: fixedMax, caption }: Props) {
  const hi = new Set(highlight);
  const focus = hi.size > 0;
  let maxT = fixedMax ?? 0;
  if (!fixedMax) {
    for (const i of frame.issues) maxT = Math.max(maxT, i.end, i.due);
    for (const g of Object.values(frame.ghost ?? {})) maxT = Math.max(maxT, g.end);
    maxT = Math.ceil(maxT * 1.04);
  }
  const plot = W - NAME - 10;
  const x = (v: number) => NAME + (v / maxT) * plot;
  const rowOf = new Map(frame.assignees.map((a, i) => [a.id, i]));
  const H = TOP + frame.assignees.length * ROW + BOTTOM;
  const step = [1, 2, 5, 10, 20, 50, 100, 200].find((s) => (s / maxT) * plot >= 48) ?? 500;
  const ticks: number[] = [];
  for (let v = 0; v <= maxT; v += step) ticks.push(v);
  return (
    <figure className="mini-gantt">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption ?? "Jadwal"}>
        <defs>
          <pattern id="mg-late" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#fbd9d2" /><rect width="2.6" height="6" fill="#e0573f" />
          </pattern>
          <pattern id="mg-away" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#eef0f3" /><rect width="2" height="6" fill="#c6cbd3" />
          </pattern>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={TOP - 4} y2={H - BOTTOM} stroke="var(--line)" />
            <text x={x(v)} y={H - 6} textAnchor="middle" className="mg-tick">{v}</text>
          </g>
        ))}
        <text x={NAME - 8} y={H - 6} textAnchor="end" className="mg-tick">jam ke-</text>
        {frame.assignees.map((a, r) => (
          <g key={a.id}>
            <rect x={0} y={TOP + r * ROW} width={W} height={ROW} fill={r % 2 ? "var(--surface)" : "transparent"} />
            <text x={8} y={TOP + r * ROW + ROW / 2 + 4} className="mg-name">{a.name}</text>
            {(frame.pauses?.[String(a.id)] ?? []).map(([p, q], k) => (
              <rect key={k} x={x(p)} y={TOP + r * ROW + 3} width={Math.max(1, x(q) - x(p))} height={ROW - 6}
                    fill="url(#mg-away)"><title>tidak tersedia jam {angka(p)} sampai {angka(q)}</title></rect>
            ))}
          </g>
        ))}
        {showGhost && frame.ghost && Object.entries(frame.ghost).map(([key, g]) => {
          if (focus && !hi.has(key)) return null;
          const now = frame.issues.find((i) => i.key === key);
          if (!now || (Math.abs(now.start - g.start) < 1e-6 && Math.abs(now.end - g.end) < 1e-6
                       && now.assignee_id === g.dev)) return null;
          const r = rowOf.get(g.dev);
          if (r === undefined) return null;
          return <rect key={`g-${key}`} x={x(g.start)} y={TOP + r * ROW + 7} width={Math.max(2, x(g.end) - x(g.start))}
                       height={ROW - 14} rx={3} fill="none" stroke="var(--ink-3)" strokeDasharray="4 3" />;
        })}
        {frame.issues.map((i) => {
          const r = rowOf.get(i.assignee_id);
          if (r === undefined) return null;
          const on = !focus || hi.has(i.key);
          const y = TOP + r * ROW + 7, h = ROW - 14;
          const x0 = x(i.start), x1 = x(i.end), lateFrom = Math.max(i.start, i.due);
          return (
            <g key={i.key} opacity={on ? 1 : 0.28}>
              <rect x={x0} y={y} width={Math.max(2, x1 - x0)} height={h} rx={3}
                    fill={on && focus ? "var(--primary)" : i.unplanned ? "#e8a598" : "#9fb4e8"} />
              {i.end > i.due + 1e-9 && (
                <rect x={x(lateFrom)} y={y} width={Math.max(1, x1 - x(lateFrom))} height={h} rx={3} fill="url(#mg-late)" />
              )}
              {on && focus && <rect x={x0 - 1.5} y={y - 1.5} width={Math.max(2, x1 - x0) + 3} height={h + 3} rx={4}
                                    fill="none" stroke="var(--primary)" strokeWidth={2.5} />}
              {x1 - x0 > 46 && <text x={x0 + 5} y={y + h / 2 + 4} className={`mg-key ${on && focus ? "mg-key--on" : ""}`}>{i.key}</text>}
              {on && focus && (
                <path d={`M ${x(i.due)} ${y - 1} l -4 -6 h 8 z`} fill="var(--danger)"><title>tenggat jam ke-{angka(i.due)}</title></path>
              )}
              {(notes[i.key] || (on && focus && x1 - x0 <= 46)) && (() => {
                const label = notes[i.key] ? `${i.key} · ${notes[i.key]}` : i.key;
                const lw = label.length * 6.2 + 10;
                const lx = Math.min(x0, W - lw - 2);          // keep the label inside the picture
                return (
                  <g>
                    <rect x={lx} y={y - 17} width={lw} height={14} rx={3} fill="var(--primary-ink)" />
                    <text x={lx + 5} y={y - 7} className="mg-note">{label}</text>
                  </g>
                );
              })()}
              <title>{i.key}: jam {angka(i.start)} sampai {angka(i.end)}, tenggat {angka(i.due)}{i.late ? `, terlambat ${angka(i.end - i.due)} jam` : ""}</title>
            </g>
          );
        })}
        {showT && frame.t !== null && frame.t !== undefined && frame.t > 0 && (
          <g>
            <line x1={x(frame.t)} x2={x(frame.t)} y1={TOP - 6} y2={H - BOTTOM} stroke="var(--danger)" strokeWidth={1.5} />
            <text x={x(frame.t) + 3} y={TOP - 9} className="mg-t">sekarang (jam {angka(frame.t)})</text>
          </g>
        )}
      </svg>
      <figcaption className="mg-legend">
        {focus && <span><i className="mg-sw mg-sw--on" />yang perlu diperhatikan</span>}
        <span><i className="mg-sw mg-sw--late" />bagian yang lewat tenggat</span>
        {focus && <span><i className="mg-sw mg-sw--due" />tenggat</span>}
        {showGhost && frame.ghost && <span><i className="mg-sw mg-sw--ghost" />posisi di langkah sebelumnya</span>}
        <span><i className="mg-sw mg-sw--away" />pengembang tidak tersedia</span>
        {caption && <span className="mg-cap">{caption}</span>}
      </figcaption>
    </figure>
  );
}
