import { scaleLinear } from "d3-scale";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { angka } from "../../format";
import type { Assignee, Issue, Span } from "../../types";
import { Avatar, epicColor, TypeIcon } from "../atoms";

export type GanttMode = "assignee" | "epic";

interface Props {
  issues: Issue[];
  assignees: Assignee[];
  pauses?: Record<string, [number, number][]>;
  ghost?: Record<string, Span> | null;
  ghostLabel?: string;
  t?: number | null;
  onOpen: (key: string) => void;
  palette: Map<number, number>;
  changed?: Set<string>;
  mode: GanttMode;
  onMode: (m: GanttMode) => void;
}

const NAMES_W = 230;
const AXIS_H = 40;
const STEPS = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

type Row = { kind: "dev"; dev: Assignee } | { kind: "epic"; label: string; color: string }
  | { kind: "issue"; issue: Issue };

export default function GanttView({ issues, assignees, pauses = {}, ghost, ghostLabel, t, onOpen,
                                    palette, changed, mode, onMode }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [zoom, setZoom] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; issue: Issue } | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const maxT = useMemo(() => {
    let m = t ?? 0;
    for (const i of issues) m = Math.max(m, i.end, i.due);
    for (const g of Object.values(ghost ?? {})) m = Math.max(m, g.end);
    for (const ps of Object.values(pauses)) for (const [, b] of ps) m = Math.max(m, b);
    return Math.max(1, m * 1.03);
  }, [issues, ghost, pauses, t]);

  // the moment every task on screen is finished: past it the timeline is empty on purpose
  const finish = useMemo(() => (issues.length ? Math.max(...issues.map((i) => i.end)) : null), [issues]);
  const fit = Math.max(2, (width - NAMES_W - 24) / maxT);
  const px = zoom ?? fit;
  const plotW = Math.max(width - NAMES_W - 2, maxT * px);
  const x = useMemo(() => scaleLinear().domain([0, maxT]).range([0, maxT * px]), [maxT, px]);
  const step = STEPS.find((s) => s * px >= 64) ?? 2000;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let v = 0; v <= maxT; v += step) out.push(v);
    return out;
  }, [maxT, step]);

  const rowH = mode === "assignee" ? 40 : 28;
  const rows: Row[] = useMemo(() => {
    if (mode === "assignee") return assignees.map((a) => ({ kind: "dev" as const, dev: a }));
    const groups = new Map<string, { order: number; color: string; items: Issue[] }>();
    for (const i of issues) {
      const g = groups.get(i.epic) ?? { order: i.unplanned ? 1e6 : i.epic_id ?? 0,
                                        color: epicColor(i, palette), items: [] };
      g.items.push(i);
      groups.set(i.epic, g);
    }
    const out: Row[] = [];
    for (const [label, g] of [...groups.entries()].sort((a, b) => a[1].order - b[1].order)) {
      out.push({ kind: "epic", label, color: g.color });
      for (const i of g.items.sort((a, b) => a.start - b.start || a.id - b.id))
        out.push({ kind: "issue", issue: i });
    }
    return out;
  }, [mode, assignees, issues, palette]);

  const devRow = new Map<number, number>();
  rows.forEach((r, k) => { if (r.kind === "dev") devRow.set(r.dev.id, k); });
  const issueRow = new Map<string, number>();
  rows.forEach((r, k) => { if (r.kind === "issue") issueRow.set(r.issue.key, k); });
  const height = rows.length * rowH;
  const byKey = new Map(issues.map((i) => [i.key, i]));

  const moved = (i: Issue) => {
    const g = ghost?.[i.key];
    return !!g && (g.dev !== i.assignee_id || Math.abs(g.start - i.start) > 1e-6 || Math.abs(g.end - i.end) > 1e-6);
  };

  const bar = (i: Issue, y: number, h: number) => {
    const color = epicColor(i, palette);
    const x0 = x(i.start), w = Math.max(2, x(i.end) - x(i.start));
    const done = i.status === "Done";
    const lateFrom = i.late ? Math.max(i.start, i.due) : null;
    return (
      <g key={i.key} className="gbar" style={{ cursor: "pointer" }}
         onClick={() => onOpen(i.key)}
         onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, issue: i })}
         onMouseLeave={() => setTip(null)}>
        <rect x={x0} y={y} width={w} height={h} rx={3}
              fill={`color-mix(in srgb, ${color} ${done ? 38 : 82}%, white)`}
              stroke={changed?.has(i.key) ? "var(--lv2)" : `color-mix(in srgb, ${color} 80%, black)`}
              strokeWidth={changed?.has(i.key) ? 2 : 0.6} />
        {i.status === "In Progress" && (
          <rect x={x0} y={y + h - 3} width={w * i.progress} height={3} fill="rgba(0,0,0,.35)" rx={1} />
        )}
        {lateFrom !== null && (
          <rect x={x(lateFrom)} y={y} width={Math.max(1.5, x(i.end) - x(lateFrom))} height={h} rx={2}
                fill="url(#late)" />
        )}
        {w > 48 && (
          <text x={x0 + 6} y={y + h / 2 + 4} fontSize={11}
                fill={done ? "var(--ink-2)" : "#fff"} style={{ pointerEvents: "none" }}>
            {i.key}
          </text>
        )}
      </g>
    );
  };

  const changeZoom = (f: number) => setZoom(Math.min(120, Math.max(1, px * f)));
  return (
    <div>
      <div className="gantt__tools">
        <div className="segmented" role="tablist" aria-label="Baris timeline">
          <button className={mode === "assignee" ? "on" : ""} onClick={() => onMode("assignee")}>Per assignee</button>
          <button className={mode === "epic" ? "on" : ""} onClick={() => onMode("epic")}>Per epic</button>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => changeZoom(1 / 1.5)} aria-label="Perkecil"><ZoomOut size={15} /></button>
        <button className="btn btn--ghost btn--sm" onClick={() => changeZoom(1.5)} aria-label="Perbesar"><ZoomIn size={15} /></button>
        <button className="btn btn--ghost btn--sm" onClick={() => setZoom(null)}><Maximize2 size={14} />Pas</button>
        <span className="muted small">sumbu: jam model</span>
        <span className="legend" style={{ marginLeft: "auto" }}>
          <span><i style={{ background: "url(#late)", backgroundImage: "repeating-linear-gradient(-45deg,#e0573f 0 2.4px,#fbd9d2 2.4px 6px)" }} />lewat tenggat</span>
          {ghost && <span><i style={{ border: "1.5px dashed var(--ink-3)", background: "transparent" }} />{ghostLabel ?? "posisi sebelumnya"}</span>}
          <span><i style={{ backgroundImage: "repeating-linear-gradient(-45deg,#c6cbd3 0 3px,#eef0f3 3px 6px)" }} />tidak tersedia</span>
          {t !== null && t !== undefined && <span><i style={{ background: "var(--danger)", width: 2 }} />t sekarang</span>}
          {finish !== null && <span><i style={{ background: "var(--success)", width: 2 }} />semua tugas selesai</span>}
        </span>
      </div>
      <div ref={box} className="table-wrap" style={{ maxHeight: "72vh" }}>
        <div style={{ display: "grid", gridTemplateColumns: `${NAMES_W}px ${plotW}px`, width: NAMES_W + plotW }}>
          <div style={{ position: "sticky", top: 0, left: 0, zIndex: 4, height: AXIS_H, background: "var(--surface)",
                        borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line)",
                        display: "flex", alignItems: "center", padding: "0 12px", fontSize: 12, fontWeight: 650, color: "var(--ink-2)" }}>
            {mode === "assignee" ? "Assignee" : "Epic / issue"}
          </div>
          <svg width={plotW} height={AXIS_H} style={{ position: "sticky", top: 0, zIndex: 3, background: "var(--surface)",
                                                       borderBottom: "1px solid var(--line)", display: "block" }}>
            {ticks.map((v) => (
              <g key={v} transform={`translate(${x(v)},0)`}>
                <line y1={AXIS_H - 8} y2={AXIS_H} stroke="var(--line-strong)" />
                <text x={4} y={AXIS_H - 14} fontSize={11} fill="var(--ink-3)">{angka(v, step < 1 ? 1 : 0)}</text>
              </g>
            ))}
            {finish !== null && (
              <g transform={`translate(${x(finish)},0)`}>
                <text x={-4} y={AXIS_H - 26} fontSize={10.5} fill="var(--success)" textAnchor="end">selesai semua: jam {angka(finish)}</text>
              </g>
            )}
            {t !== null && t !== undefined && (
              <g transform={`translate(${x(t)},0)`}>
                <rect x={-22} y={4} width={44} height={16} rx={8} fill="var(--danger)" />
                <text x={0} y={16} fontSize={10.5} fill="#fff" textAnchor="middle">t={angka(t)}</text>
              </g>
            )}
          </svg>
          <div style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--canvas)", borderRight: "1px solid var(--line)" }}>
            {rows.map((r, k) => (
              <div key={k} className="gantt__name" style={{ height: rowH,
                     background: r.kind === "epic" ? "var(--surface)" : undefined,
                     fontWeight: r.kind === "epic" ? 650 : 400 }}>
                {r.kind === "dev" && <><Avatar id={r.dev.id} label={r.dev.short} size={22} />{r.dev.name}
                  <span className="muted small">{r.dev.origin}</span></>}
                {r.kind === "epic" && <><span style={{ width: 10, height: 10, borderRadius: 2, background: r.color }} />{r.label}</>}
                {r.kind === "issue" && <><TypeIcon unplanned={r.issue.unplanned} />
                  <span className="key">{r.issue.key}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.issue.summary}</span></>}
              </div>
            ))}
          </div>
          <svg width={plotW} height={height} style={{ display: "block" }}>
            <defs>
              <pattern id="late" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#fbd9d2" /><rect width="2.4" height="6" fill="#e0573f" />
              </pattern>
              <pattern id="away" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#eef0f3" /><rect width="3" height="6" fill="#c6cbd3" />
              </pattern>
            </defs>
            {rows.map((r, k) => (
              <rect key={`bg${k}`} x={0} y={k * rowH} width={plotW} height={rowH}
                    fill={r.kind === "epic" ? "var(--surface)" : k % 2 ? "#fbfbfc" : "#fff"} />
            ))}
            {ticks.map((v) => <line key={`gl${v}`} x1={x(v)} x2={x(v)} y1={0} y2={height} stroke="var(--surface-2)" />)}
            {mode === "assignee" && Object.entries(pauses).map(([dev, ps]) => {
              const k = devRow.get(Number(dev));
              if (k === undefined) return null;
              return ps.map(([a, b], n) => (
                <rect key={`p${dev}-${n}`} x={x(a)} y={k * rowH + 2} width={Math.max(1, x(b) - x(a))} height={rowH - 4}
                      fill="url(#away)" opacity={0.9}><title>tidak tersedia jam {angka(a)} sampai {angka(b)}</title></rect>
              ));
            })}
            {ghost && issues.filter(moved).map((i) => {
              const g = ghost[i.key];
              const k = mode === "assignee" ? devRow.get(g.dev) : issueRow.get(i.key);
              if (k === undefined) return null;
              const pad = mode === "assignee" ? 8 : 6;
              return <rect key={`gh${i.key}`} x={x(g.start)} y={k * rowH + pad} width={Math.max(2, x(g.end) - x(g.start))}
                           height={rowH - 2 * pad} rx={3} fill="none" stroke="var(--ink-3)" strokeDasharray="4 3" strokeWidth={1.3} />;
            })}
            {mode === "assignee" && rows.map((r, k) => r.kind === "dev"
              ? issues.filter((i) => i.assignee_id === r.dev.id).map((i) => bar(i, k * rowH + 8, rowH - 16)) : null)}
            {mode === "epic" && rows.map((r, k) => r.kind === "issue" ? (
              <g key={`r${r.issue.key}`}>
                {bar(r.issue, k * rowH + 6, rowH - 12)}
                <path d={`M ${x(r.issue.due)} ${k * rowH + 7} l 5 7 l -5 7 l -5 -7 z`}
                      fill={r.issue.late ? "var(--danger)" : "var(--ink-2)"}>
                  <title>tenggat jam ke-{angka(r.issue.due)}</title></path>
              </g>) : null)}
            {mode === "epic" && issues.flatMap((i) => i.blocked_by.map((b) => {
              const from = byKey.get(b);
              const r1 = issueRow.get(b), r2 = issueRow.get(i.key);
              if (!from || r1 === undefined || r2 === undefined) return null;
              const x1 = x(from.end), y1 = r1 * rowH + rowH / 2, x2 = x(i.start), y2 = r2 * rowH + rowH / 2;
              return <path key={`d${b}-${i.key}`} d={`M${x1} ${y1} C ${x1 + 12} ${y1}, ${x2 - 12} ${y2}, ${x2} ${y2}`}
                           fill="none" stroke="var(--ink-4)" strokeWidth={1} markerEnd="" />;
            }))}
            {finish !== null && <rect x={x(finish)} y={0} width={Math.max(0, x(maxT) - x(finish))} height={height}
                                      fill="var(--surface)" opacity={0.6}><title>Tidak ada tugas sesudah jam {angka(finish)}</title></rect>}
            {finish !== null && <line x1={x(finish)} x2={x(finish)} y1={0} y2={height} stroke="var(--success)" strokeWidth={1.5} strokeDasharray="5 3" />}
            {t !== null && t !== undefined && <line x1={x(t)} x2={x(t)} y1={0} y2={height} stroke="var(--danger)" strokeWidth={1.5} />}
          </svg>
        </div>
      </div>
      {tip && (
        <div className="tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <div><span className="mono">{tip.issue.key}</span> {tip.issue.summary}</div>
          <div>{tip.issue.assignee} · {tip.issue.status}</div>
          <div>jam {angka(tip.issue.start)} sampai {angka(tip.issue.end)} · estimasi {angka(tip.issue.estimate)} j</div>
          <div>tenggat jam ke-{angka(tip.issue.due)}{tip.issue.late ? ` · telat ${angka(tip.issue.lateness)} j` : ""}</div>
          {ghost?.[tip.issue.key] && moved(tip.issue) && (
            <div>sebelumnya: {assignees.find((a) => a.id === ghost[tip.issue.key].dev)?.name
              ?? `Pengembang ${ghost[tip.issue.key].dev + 1}`}, jam {angka(ghost[tip.issue.key].start)}</div>
          )}
        </div>
      )}
    </div>
  );
}
