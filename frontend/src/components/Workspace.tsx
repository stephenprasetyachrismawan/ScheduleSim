import { useMemo, useState, type ReactNode } from "react";
import { emptyFilters, filterIssues, type Filters, type GroupBy } from "../lib/filter";
import type { Assignee, Epic, EventDetail, HistoryEntry, Issue, Span } from "../types";
import ControlPanel, { type ViewName } from "./ControlPanel";
import BoardView, { type Move } from "./views/BoardView";
import GanttView, { type GanttMode } from "./views/GanttView";
import IssueForm from "./views/IssueForm";
import ListView from "./views/ListView";

interface Props {
  issues: Issue[];
  assignees: Assignee[];
  epics: Epic[];
  history: HistoryEntry[];
  view: ViewName;
  onView: (v: ViewName) => void;
  selected: string | null;
  onSelect: (key: string | null) => void;
  pauses?: Record<string, [number, number][]>;
  ghost?: Record<string, Span> | null;
  ghostLabel?: string;
  t?: number | null;
  event?: EventDetail | null;
  changed?: Set<string>;
  dragEnabled?: boolean;
  onMove?: (m: Move) => void;
  panelExtra?: ReactNode;
  initialText?: string;
  /** Open an issue as its own page instead of the Form view inside the workspace. */
  onOpenIssue?: (key: string) => void;
}

export default function Workspace(p: Props) {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters, text: p.initialText ?? "" });
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [ganttMode, setGanttMode] = useState<GanttMode>("assignee");
  const palette = useMemo(() => new Map(p.epics.map((e) => [e.id, e.color])), [p.epics]);
  const shown = useMemo(() => filterIssues(p.issues, filters), [p.issues, filters]);
  const epicNames = useMemo(() => [...new Set(p.issues.map((i) => i.epic))], [p.issues]);
  const unavailable = useMemo(() => {
    const s = new Set<number>();
    if (p.t === null || p.t === undefined) return s;
    for (const [dev, ps] of Object.entries(p.pauses ?? {}))
      if (ps.some(([a, b]) => a <= p.t! && p.t! < b)) s.add(Number(dev));
    return s;
  }, [p.pauses, p.t]);

  const open = (key: string) => {
    if (p.onOpenIssue) { p.onOpenIssue(key); return; }
    p.onSelect(key); p.onView("form");
  };
  const formIssue = p.view === "form"
    ? (shown.find((i) => i.key === p.selected) ?? p.issues.find((i) => i.key === p.selected) ?? shown[0])
    : undefined;

  return (
    <div>
      <ControlPanel filters={filters} onFilters={setFilters} groupBy={groupBy} onGroupBy={setGroupBy}
                    view={p.view} onView={p.onView} assignees={p.assignees} epics={epicNames}
                    showGroup={p.view === "list"} hideForm={!!p.onOpenIssue}>
        {p.panelExtra}
      </ControlPanel>
      {p.view === "list" && (
        <ListView issues={shown} assignees={p.assignees} groupBy={groupBy} selected={p.selected}
                  changed={p.changed} onOpen={open} palette={palette} />
      )}
      {p.view === "board" && (
        <BoardView issues={shown} assignees={p.assignees} onOpen={open} palette={palette}
                   changed={p.changed} unavailable={unavailable} dragEnabled={p.dragEnabled}
                   onMove={p.onMove} />
      )}
      {p.view === "gantt" && (
        <GanttView issues={shown} assignees={p.assignees} pauses={p.pauses} ghost={p.ghost}
                   ghostLabel={p.ghostLabel} t={p.t} onOpen={open} palette={palette}
                   changed={p.changed} mode={ganttMode} onMode={setGanttMode} />
      )}
      {p.view === "form" && (formIssue
        ? <IssueForm issue={formIssue} list={shown.length ? shown : p.issues} history={p.history}
                     assignees={p.assignees} palette={palette} event={p.event}
                     onNavigate={(k) => p.onSelect(k)} />
        : <div className="empty">Pilih issue dari List atau Board untuk membuka form-nya.</div>)}
    </div>
  );
}
