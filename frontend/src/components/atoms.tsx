import { CheckSquare, ChevronDown, ChevronUp, ChevronsUp, Equal, Zap } from "lucide-react";
import type { CSSProperties } from "react";
import type { Issue, StatusName } from "../types";

export const LEVEL_NAMES = ["Tanpa perbaikan", "Resequence", "Reassign", "Partial rescheduling"];
export const LEVEL_SHORT = ["L0", "L1", "L2", "L3"];

const STATUS_CLASS: Record<StatusName, string> = {
  "To Do": "todo", "In Progress": "prog", Done: "done", Reopened: "reop",
};

export function Lozenge({ status }: { status: StatusName }) {
  return <span className={`lozenge lozenge--${STATUS_CLASS[status]}`}>{status}</span>;
}

export function epicColor(issue: { unplanned: boolean; epic_id: number | null },
                          palette?: Map<number, number>): string {
  if (issue.unplanned || issue.epic_id === null) return "var(--ep-unplanned)";
  const idx = palette?.get(issue.epic_id) ?? issue.epic_id;
  return `var(--ep${idx % 12})`;
}

export function EpicTag({ issue, palette }: { issue: Issue; palette?: Map<number, number> }) {
  const c = epicColor(issue, palette);
  const style: CSSProperties = {
    color: `color-mix(in srgb, ${c} 75%, black)`,
    background: `color-mix(in srgb, ${c} 16%, white)`,
  };
  return <span className="epic-tag" style={style} title={issue.epic}>{issue.epic}</span>;
}

const AVATAR = ["#3d63dd", "#0e8a6f", "#b5462c", "#7c4dce", "#b07b00", "#0b7bb5", "#b13e86",
                "#4a7a2a", "#5a6475", "#c05b2c", "#2a6fa0", "#8a5a2e"];

export function Avatar({ id, label, size = 24 }: { id: number; label: string; size?: number }) {
  return (
    <span className="avatar" title={label}
          style={{ width: size, height: size, fontSize: size * 0.42,
                   background: AVATAR[id % AVATAR.length] }}>
      {label}
    </span>
  );
}

export function Who({ id, name, short, size = 22 }: { id: number; name: string; short: string;
                                                       size?: number }) {
  return (
    <span className="who"><Avatar id={id} label={short} size={size} />{name}</span>
  );
}

export function PriorityIcon({ priority }: { priority: Issue["priority"] }) {
  const p = { size: 16, strokeWidth: 2.6 };
  switch (priority) {
    case "Highest": return <ChevronsUp {...p} color="#d1362a" aria-label="Highest" />;
    case "High": return <ChevronUp {...p} color="#e2732b" aria-label="High" />;
    case "Medium": return <Equal {...p} color="#d39e1b" aria-label="Medium" />;
    default: return <ChevronDown {...p} color="#2f6fd6" aria-label="Low" />;
  }
}

export function TypeIcon({ unplanned }: { unplanned: boolean }) {
  const style: CSSProperties = {
    display: "inline-grid", placeItems: "center", width: 16, height: 16, borderRadius: 3,
    background: unplanned ? "#d6452e" : "#3a7be0", color: "#fff", flex: "none",
  };
  return (
    <span className="type-icon" style={style} title={unplanned ? "Pekerjaan tidak terencana" : "Task"}>
      {unplanned ? <Zap size={11} strokeWidth={2.6} /> : <CheckSquare size={11} strokeWidth={2.6} />}
    </span>
  );
}

/** The signature: four rising bars, the chosen repair level filled in its colour. */
export function Ladder({ level, size = 1, title }: { level: number | null; size?: number;
                                                    title?: string }) {
  return (
    <span className="ladder" title={title ?? (level === null ? "tanpa tingkat"
                                               : `${LEVEL_SHORT[level]} ${LEVEL_NAMES[level]}`)}
          style={{ transform: `scale(${size})`, transformOrigin: "left bottom" }}>
      {[0, 1, 2, 3].map((k) => (
        <i key={k} style={level !== null && k <= level
                          ? { background: `var(--lv${level})` } : undefined} />
      ))}
    </span>
  );
}

export function LevelChip({ level, muted }: { level: number; muted?: boolean }) {
  return (
    <span className="level-chip"
          style={{ background: muted ? undefined : `color-mix(in srgb, var(--lv${level}) 16%, white)`,
                   color: muted ? "var(--ink-3)" : `color-mix(in srgb, var(--lv${level}) 70%, black)` }}>
      <Ladder level={level} />{LEVEL_SHORT[level]} · {LEVEL_NAMES[level]}
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" aria-label="memuat" />;
}
