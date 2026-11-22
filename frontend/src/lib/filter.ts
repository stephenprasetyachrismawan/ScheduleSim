import type { Issue, StatusName } from "../types";

export type GroupBy = "none" | "epic" | "assignee" | "status" | "priority";

export interface Filters {
  text: string;
  assignees: number[];
  epics: string[];
  statuses: StatusName[];
  lateOnly: boolean;
}

export const emptyFilters: Filters = {
  text: "", assignees: [], epics: [], statuses: [], lateOnly: false,
};

export function activeFilterCount(f: Filters): number {
  return (f.text ? 1 : 0) + f.assignees.length + f.epics.length + f.statuses.length
    + (f.lateOnly ? 1 : 0);
}

export function filterIssues(issues: Issue[], f: Filters): Issue[] {
  const text = f.text.trim().toLowerCase();
  return issues.filter((i) =>
    (!text || i.key.toLowerCase().includes(text) || i.summary.toLowerCase().includes(text))
    && (f.assignees.length === 0 || f.assignees.includes(i.assignee_id))
    && (f.epics.length === 0 || f.epics.includes(i.epic))
    && (f.statuses.length === 0 || f.statuses.includes(i.status))
    && (!f.lateOnly || i.late));
}

export interface Group {
  key: string;
  label: string;
  items: Issue[];
  estimate: number;
  late: number;
}

const STATUS_ORDER: StatusName[] = ["To Do", "Reopened", "In Progress", "Done"];
const PRIORITY_ORDER = ["Highest", "High", "Medium", "Low"];

export function groupIssues(issues: Issue[], by: GroupBy): Group[] {
  if (by === "none") {
    return [{ key: "all", label: "Semua issue", items: issues,
              estimate: sum(issues.map((i) => i.estimate)),
              late: issues.filter((i) => i.late).length }];
  }
  const map = new Map<string, { label: string; order: number; items: Issue[] }>();
  for (const i of issues) {
    const [key, label, order] =
      by === "epic" ? [i.epic, i.epic, i.unplanned ? 1e6 : i.epic_id ?? 0]
      : by === "assignee" ? [String(i.assignee_id), i.assignee, i.assignee_id]
      : by === "status" ? [i.status, i.status, STATUS_ORDER.indexOf(i.status)]
      : [i.priority, i.priority, PRIORITY_ORDER.indexOf(i.priority)];
    const g = map.get(key) ?? { label, order, items: [] };
    g.items.push(i);
    map.set(key, g);
  }
  return [...map.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, g]) => ({ key, label: g.label, items: g.items,
                          estimate: sum(g.items.map((i) => i.estimate)),
                          late: g.items.filter((i) => i.late).length }));
}

export type SortKey = "key" | "summary" | "epic" | "status" | "assignee" | "priority"
  | "estimate" | "start" | "end" | "due" | "lateness";

export function sortIssues(issues: Issue[], key: SortKey, desc: boolean): Issue[] {
  const value = (i: Issue): number | string => {
    switch (key) {
      case "key": return i.id;
      case "status": return STATUS_ORDER.indexOf(i.status);
      case "priority": return PRIORITY_ORDER.indexOf(i.priority);
      case "assignee": return i.assignee_id;
      default: return i[key];
    }
  };
  const out = [...issues].sort((a, b) => {
    const x = value(a), y = value(b);
    return x < y ? -1 : x > y ? 1 : a.id - b.id;
  });
  return desc ? out.reverse() : out;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
