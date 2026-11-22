import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Clock, PauseCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { angka } from "../../format";
import type { Assignee, Issue } from "../../types";
import { Avatar, EpicTag, Lozenge, PriorityIcon, TypeIcon } from "../atoms";

export interface Move { task: number; to_dev: number; to_pos?: number }

interface Props {
  issues: Issue[];
  assignees: Assignee[];
  onOpen: (key: string) => void;
  palette: Map<number, number>;
  changed?: Set<string>;
  unavailable?: Set<number>;
  dragEnabled?: boolean;
  onMove?: (move: Move) => void;
}

const COLUMNS: { title: string; match: (i: Issue) => boolean }[] = [
  { title: "To Do", match: (i) => i.status === "To Do" || i.status === "Reopened" },
  { title: "In Progress", match: (i) => i.status === "In Progress" },
  { title: "Done", match: (i) => i.status === "Done" },
];

function order(col: number, items: Issue[]): Issue[] {
  const xs = [...items];
  if (col === 0) xs.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.start - b.start);
  else if (col === 1) xs.sort((a, b) => a.start - b.start);
  else xs.sort((a, b) => b.end - a.end);
  return xs;
}

function Card({ issue, palette, changed, short, draggable, onOpen, overlay }: {
  issue: Issue; palette: Map<number, number>; changed?: boolean; short: string;
  draggable: boolean; onOpen: (k: string) => void; overlay?: boolean;
}) {
  const drag = useDraggable({ id: `card:${issue.key}`, disabled: !draggable || overlay,
                              data: { issue } });
  const drop = useDroppable({ id: `before:${issue.key}`, disabled: !draggable || overlay,
                              data: { issue } });
  const ref = (el: HTMLElement | null) => { drag.setNodeRef(el); drop.setNodeRef(el); };
  return (
    <div ref={overlay ? undefined : ref} {...(overlay ? {} : drag.listeners)} {...(overlay ? {} : drag.attributes)}
         className={`card ${changed ? "moved" : ""} ${drag.isDragging ? "dragging" : ""} ${overlay ? "overlay" : ""}`}
         style={drop.isOver ? { boxShadow: "0 -3px 0 var(--primary)" } : undefined}
         onClick={() => onOpen(issue.key)} role="button" tabIndex={0}
         onKeyDown={(e) => { if (e.key === "Enter") onOpen(issue.key); }}>
      <div className="card__summary">{issue.summary}</div>
      <div className="card__meta">
        <EpicTag issue={issue} palette={palette} />
        {issue.status === "Reopened" && <Lozenge status="Reopened" />}
        {issue.late && <span className="pill pill--late" title="Selesai melewati tenggat">
          <Clock size={10} />+{angka(issue.lateness)} j</span>}
      </div>
      <div className="card__foot">
        <span className="key"><TypeIcon unplanned={issue.unplanned} />{issue.key}</span>
        {issue.rank !== null && <span className="pill pill--rank" title="Rank di antrean">#{issue.rank}</span>}
        <span className="pill" title="Original estimate">{angka(issue.estimate)} j</span>
        <PriorityIcon priority={issue.priority} />
        <Avatar id={issue.assignee_id} label={short} size={22} />
      </div>
    </div>
  );
}

function Cell({ dev, col, children, droppable, blocked }: {
  dev: number; col: number; children: React.ReactNode; droppable: boolean; blocked: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${dev}:${col}`, disabled: !droppable,
                                                data: { dev, col } });
  return (
    <div ref={setNodeRef} className={`lane__cell ${isOver ? "drop" : ""} ${blocked ? "blocked" : ""}`}>
      {children}
    </div>
  );
}

export default function BoardView({ issues, assignees, onOpen, palette, changed, unavailable,
                                    dragEnabled = false, onMove }: Props) {
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const [active, setActive] = useState<Issue | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const byDev = useMemo(() => {
    const m = new Map<number, Issue[]>();
    for (const a of assignees) m.set(a.id, []);
    for (const i of issues) m.get(i.assignee_id)?.push(i);
    return m;
  }, [issues, assignees]);
  const short = (id: number) => assignees.find((a) => a.id === id)?.short ?? `P${id + 1}`;
  const movable = (i: Issue) => dragEnabled && (i.status === "To Do" || i.status === "Reopened");

  const onStart = (e: DragStartEvent) => setActive((e.active.data.current?.issue as Issue) ?? null);
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const issue = e.active.data.current?.issue as Issue | undefined;
    const over = e.over;
    if (!issue || !over || !onMove) return;
    let dev: number, pos: number | undefined;
    if (String(over.id).startsWith("before:")) {
      const target = over.data.current?.issue as Issue;
      if (target.key === issue.key || target.rank === null) return;
      dev = target.assignee_id;
      pos = target.rank;
      if (dev === issue.assignee_id && issue.rank !== null && issue.rank < target.rank) pos -= 1;
    } else {
      const d = over.data.current as { dev: number; col: number };
      if (d.col !== 0) return;
      dev = d.dev;
      const queue = (byDev.get(dev) ?? []).filter((x) => x.rank !== null && x.key !== issue.key);
      pos = queue.length + 1;
    }
    if (dev === issue.assignee_id && pos === issue.rank) return;
    onMove({ task: issue.id, to_dev: dev, to_pos: pos });
  };

  const template = `repeat(${COLUMNS.length}, minmax(240px, 1fr))`;
  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="board" style={{ gridTemplateColumns: template }}>
        <div className="board__head" style={{ gridColumn: "1 / -1", gridTemplateColumns: template }}>
          {COLUMNS.map((c) => (
            <div key={c.title} className="board__col-title">
              {c.title}<span className="muted">{issues.filter(c.match).length}</span>
            </div>
          ))}
        </div>
        {assignees.map((a) => {
          const mine = byDev.get(a.id) ?? [];
          const open = !closed.has(a.id);
          const away = unavailable?.has(a.id) ?? false;
          return (
            <div key={a.id} className="lane">
              <div className="lane__head" onClick={() => setClosed((s) => { const n = new Set(s); open ? n.add(a.id) : n.delete(a.id); return n; })}>
                {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <Avatar id={a.id} label={a.short} size={22} />
                {a.name}
                <span className="muted">{mine.length} issue · {a.origin}</span>
                {away && <span className="pill pill--late"><PauseCircle size={11} />tidak tersedia</span>}
              </div>
              {open && COLUMNS.map((c, col) => (
                <Cell key={c.title} dev={a.id} col={col} droppable={dragEnabled && col === 0} blocked={away && col === 1}>
                  {order(col, mine.filter(c.match)).map((i) => (
                    <Card key={i.key} issue={i} palette={palette} changed={changed?.has(i.key)}
                          short={a.short} draggable={movable(i)} onOpen={onOpen} />
                  ))}
                </Cell>
              ))}
            </div>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {active && <Card issue={active} palette={palette} short={short(active.assignee_id)}
                         draggable={false} onOpen={() => undefined} overlay />}
      </DragOverlay>
    </DndContext>
  );
}
