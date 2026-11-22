import { CalendarRange, Filter, KanbanSquare, Layers, List, SquarePen, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GroupBy, Filters } from "../lib/filter";
import { activeFilterCount } from "../lib/filter";
import type { Assignee, StatusName } from "../types";

export type ViewName = "list" | "board" | "form" | "gantt";

const VIEWS: { name: ViewName; label: string; icon: ReactNode }[] = [
  { name: "list", label: "List", icon: <List size={16} /> },
  { name: "board", label: "Board (kanban)", icon: <KanbanSquare size={16} /> },
  { name: "form", label: "Form", icon: <SquarePen size={16} /> },
  { name: "gantt", label: "Timeline (Gantt)", icon: <CalendarRange size={16} /> },
];

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "Tanpa pengelompokan" },
  { value: "epic", label: "Epic" },
  { value: "assignee", label: "Assignee" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Prioritas" },
];

const STATUSES: StatusName[] = ["To Do", "Reopened", "In Progress", "Done"];

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open, close]);
  return ref;
}

export function ViewSwitcher({ view, onChange }: { view: ViewName; onChange: (v: ViewName) => void }) {
  return (
    <div className="switcher" role="tablist" aria-label="Tampilan">
      {VIEWS.map((v) => (
        <button key={v.name} role="tab" aria-selected={view === v.name} title={v.label}
                className={view === v.name ? "on" : ""} onClick={() => onChange(v.name)}>
          {v.icon}<span className="sr-only">{v.label}</span>
        </button>
      ))}
    </div>
  );
}

interface Props {
  filters: Filters;
  onFilters: (f: Filters) => void;
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  view: ViewName;
  onView: (v: ViewName) => void;
  assignees: Assignee[];
  epics: string[];
  children?: ReactNode;
  showGroup?: boolean;
}

export default function ControlPanel({ filters, onFilters, groupBy, onGroupBy, view, onView,
                                       assignees, epics, children, showGroup = true }: Props) {
  const [menu, setMenu] = useState<"filter" | "group" | null>(null);
  const close = () => setMenu(null);
  const ref = useOutside(menu !== null, close);
  const toggle = <T,>(list: T[], v: T) => list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const devName = (id: number) => assignees.find((a) => a.id === id)?.name ?? `Pengembang ${id + 1}`;
  const count = activeFilterCount(filters);

  return (
    <div className="panel" ref={ref}>
      <div className="facets">
        <Filter size={14} color="var(--ink-3)" />
        {filters.statuses.map((s) => (
          <span key={s} className="facet">Status: {s}
            <button aria-label={`hapus ${s}`} onClick={() => onFilters({ ...filters, statuses: toggle(filters.statuses, s) })}><X size={12} /></button></span>
        ))}
        {filters.assignees.map((a) => (
          <span key={a} className="facet">Assignee: {devName(a)}
            <button aria-label="hapus" onClick={() => onFilters({ ...filters, assignees: toggle(filters.assignees, a) })}><X size={12} /></button></span>
        ))}
        {filters.epics.map((e) => (
          <span key={e} className="facet">Epic: {e}
            <button aria-label="hapus" onClick={() => onFilters({ ...filters, epics: toggle(filters.epics, e) })}><X size={12} /></button></span>
        ))}
        {filters.lateOnly && (
          <span className="facet">Terlambat
            <button aria-label="hapus" onClick={() => onFilters({ ...filters, lateOnly: false })}><X size={12} /></button></span>
        )}
        <input value={filters.text} placeholder="Cari key atau ringkasan…" aria-label="Cari issue"
               onChange={(e) => onFilters({ ...filters, text: e.target.value })} />
      </div>
      <div className="menu">
        <button className="btn btn--ghost" onClick={() => setMenu(menu === "filter" ? null : "filter")}
                aria-expanded={menu === "filter"}>
          <Filter size={15} />Filter{count > 0 ? ` (${count})` : ""}
        </button>
        {menu === "filter" && (
          <div className="menu__pop">
            <div className="menu__title">Status</div>
            {STATUSES.map((s) => (
              <button key={s} className={`menu__item ${filters.statuses.includes(s) ? "on" : ""}`}
                      onClick={() => onFilters({ ...filters, statuses: toggle(filters.statuses, s) })}>
                <input type="checkbox" readOnly checked={filters.statuses.includes(s)} tabIndex={-1} />{s}
              </button>
            ))}
            <button className={`menu__item ${filters.lateOnly ? "on" : ""}`}
                    onClick={() => onFilters({ ...filters, lateOnly: !filters.lateOnly })}>
              <input type="checkbox" readOnly checked={filters.lateOnly} tabIndex={-1} />Hanya yang melewati tenggat
            </button>
            <div className="menu__title">Assignee</div>
            {assignees.map((a) => (
              <button key={a.id} className={`menu__item ${filters.assignees.includes(a.id) ? "on" : ""}`}
                      onClick={() => onFilters({ ...filters, assignees: toggle(filters.assignees, a.id) })}>
                <input type="checkbox" readOnly checked={filters.assignees.includes(a.id)} tabIndex={-1} />{a.name}
              </button>
            ))}
            <div className="menu__title">Epic</div>
            {epics.map((e) => (
              <button key={e} className={`menu__item ${filters.epics.includes(e) ? "on" : ""}`}
                      onClick={() => onFilters({ ...filters, epics: toggle(filters.epics, e) })}>
                <input type="checkbox" readOnly checked={filters.epics.includes(e)} tabIndex={-1} />{e}
              </button>
            ))}
          </div>
        )}
      </div>
      {showGroup && (
        <div className="menu">
          <button className="btn btn--ghost" onClick={() => setMenu(menu === "group" ? null : "group")}
                  aria-expanded={menu === "group"}>
            <Layers size={15} />Group by: {GROUPS.find((g) => g.value === groupBy)?.label}
          </button>
          {menu === "group" && (
            <div className="menu__pop">
              {GROUPS.map((g) => (
                <button key={g.value} className={`menu__item ${groupBy === g.value ? "on" : ""}`}
                        onClick={() => { onGroupBy(g.value); close(); }}>{g.label}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {children}
      <ViewSwitcher view={view} onChange={onView} />
    </div>
  );
}
