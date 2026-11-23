import { ChevronDown, ChevronRight, ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { angka } from "../../format";
import { groupIssues, sortIssues, type GroupBy, type SortKey } from "../../lib/filter";
import type { Assignee, Issue } from "../../types";
import { Avatar, EpicTag, Lozenge, PriorityIcon, TypeIcon } from "../atoms";

interface Props {
  issues: Issue[];
  assignees: Assignee[];
  groupBy: GroupBy;
  selected?: string | null;
  changed?: Set<string>;
  onOpen: (key: string) => void;
  palette: Map<number, number>;
}

const COLUMNS: { key: SortKey; label: string; num?: boolean; title?: string }[] = [
  { key: "key", label: "Key" },
  { key: "summary", label: "Ringkasan" },
  { key: "epic", label: "Epic" },
  { key: "status", label: "Status" },
  { key: "assignee", label: "Assignee" },
  { key: "priority", label: "Prioritas" },
  { key: "estimate", label: "Estimasi (j)", num: true, title: "Original estimate pada assignee, jam" },
  { key: "start", label: "Mulai", num: true, title: "Jam model" },
  { key: "end", label: "Selesai", num: true, title: "Jam model" },
  { key: "due", label: "Tenggat", num: true, title: "Jam model; selesai di S0 + setengah upaya" },
  { key: "lateness", label: "Telat (j)", num: true },
];

export default function ListView({ issues, assignees, groupBy, selected, changed, onOpen, palette }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "key", desc: false });
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupIssues(sortIssues(issues, sort.key, sort.desc), groupBy),
                         [issues, sort, groupBy]);
  const short = (id: number) => assignees.find((a) => a.id === id)?.short ?? `P${id + 1}`;

  if (issues.length === 0) return <div className="empty">Tidak ada issue yang cocok dengan filter.</div>;
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} className={c.num ? "num" : ""} title={c.title}
                  onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : false }))}
                  aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"}>
                {c.label}{" "}
                {sort.key === c.key && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
              </th>
            ))}
            <th className="num" title="Posisi di antrean pengembang (hanya issue To Do)">Rank</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const open = !closed.has(g.key);
            return [
              groupBy !== "none" && (
                <tr key={`g-${g.key}`} className="group"
                    onClick={() => setClosed((s) => { const n = new Set(s); open ? n.add(g.key) : n.delete(g.key); return n; })}>
                  <td colSpan={6}>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {g.label}{" "}
                    <span className="muted">({g.items.length})</span>
                    {g.late > 0 && <span className="late-text small"> · {g.late} melewati tenggat</span>}
                  </td>
                  <td className="num">{angka(g.estimate)}</td>
                  <td colSpan={5} />
                </tr>
              ),
              ...(open ? g.items.map((i) => (
                <tr key={i.key} className={`row ${selected === i.key ? "selected" : ""}`}
                    onClick={() => onOpen(i.key)}>
                  <td><span className="key">{i.key}</span></td>
                  <td>
                    <div className="cell-summary">
                      <TypeIcon unplanned={i.unplanned} />
                      <span title={i.summary}>{i.summary}</span>
                      {changed?.has(i.key) && <span className="pill" style={{ background: "color-mix(in srgb, var(--lv2) 20%, white)" }}>diubah</span>}
                    </div>
                  </td>
                  <td><EpicTag issue={i} palette={palette} /></td>
                  <td><Lozenge status={i.status} /></td>
                  <td><span className="who"><Avatar id={i.assignee_id} label={short(i.assignee_id)} size={20} />{i.assignee}</span></td>
                  <td><span className="who"><PriorityIcon priority={i.priority} />{i.priority}</span></td>
                  <td className="num">{angka(i.estimate)}</td>
                  <td className="num">{angka(i.start)}</td>
                  <td className="num">{angka(i.end)}</td>
                  <td className="num">{angka(i.due)}</td>
                  <td className={`num ${i.late ? "late-text" : "muted"}`}>{i.late ? angka(i.lateness) : "–"}</td>
                  <td className="num muted">{i.rank ?? "–"}</td>
                </tr>
              )) : []),
            ];
          })}
          <tr className="total">
            <td colSpan={6}>Total {issues.length} issue · {issues.filter((i) => i.late).length} melewati tenggat</td>
            <td className="num">{angka(issues.reduce((a, i) => a + i.estimate, 0))}</td>
            <td colSpan={3} />
            <td className="num late-text">{angka(issues.reduce((a, i) => a + i.lateness, 0))}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
