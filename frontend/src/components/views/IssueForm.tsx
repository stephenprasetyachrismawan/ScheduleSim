import {
  ArrowLeftRight, ChevronLeft, ChevronRight, CirclePlus, Clock3, Flag, History as HistoryIcon,
  ListOrdered, PauseCircle, RotateCcw,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { angka } from "../../format";
import type { Assignee, EventDetail, HistoryEntry, Issue } from "../../types";
import { Avatar, EpicTag, LEVEL_NAMES, LEVEL_SHORT, Ladder, Lozenge, PriorityIcon, TypeIcon } from "../atoms";

const KIND: Record<HistoryEntry["kind"], { icon: ReactNode; color: string; label: string }> = {
  created: { icon: <CirclePlus size={14} />, color: "#d6452e", label: "Gangguan" },
  estimate: { icon: <Clock3 size={14} />, color: "#b86e00", label: "Gangguan" },
  reopened: { icon: <RotateCcw size={14} />, color: "#a8321a", label: "Gangguan" },
  priority: { icon: <Flag size={14} />, color: "#9a5bd9", label: "Gangguan" },
  unavailable: { icon: <PauseCircle size={14} />, color: "#5a6475", label: "Gangguan" },
  assignee: { icon: <ArrowLeftRight size={14} />, color: "var(--lv2)", label: "Perbaikan" },
  rank: { icon: <ListOrdered size={14} />, color: "var(--lv1)", label: "Perbaikan" },
};

export function HistoryList({ entries, empty }: { entries: HistoryEntry[]; empty?: string }) {
  if (entries.length === 0) return <div className="muted small">{empty ?? "Belum ada riwayat."}</div>;
  return (
    <div>
      {[...entries].reverse().map((h, n) => {
        const k = KIND[h.kind];
        return (
          <div key={n} className="entry">
            <span className="entry__icon" style={{ background: `color-mix(in srgb, ${k.color} 16%, white)`, color: k.color }}>{k.icon}</span>
            <div>
              <div className="entry__time">jam ke-{angka(h.t)} · kejadian {h.event + 1} · {k.label}
                {h.issue ? ` · ${h.issue}` : ""}</div>
              <div className="entry__text">{h.text}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  issue: Issue;
  list: Issue[];
  history: HistoryEntry[];
  assignees: Assignee[];
  palette: Map<number, number>;
  event?: EventDetail | null;
  onNavigate: (key: string) => void;
  toolbar?: ReactNode;
}

type Tab = "detail" | "devs" | "deps" | "model";

export default function IssueForm({ issue, list, history, assignees, palette, event, onNavigate, toolbar }: Props) {
  const [tab, setTab] = useState<Tab>("detail");
  const idx = list.findIndex((i) => i.key === issue.key);
  const byKey = new Map(list.map((i) => [i.key, i]));
  const dev = assignees.find((a) => a.id === issue.assignee_id);
  const mine = history.filter((h) => h.issue === issue.key
    || (h.kind === "unavailable" && h.assignee === issue.assignee));
  const stage = issue.status === "Done" ? 2 : issue.status === "In Progress" ? 1 : 0;
  const subs = event?.subs.filter((s) =>
    event.affected[s.j]?.issues.includes(issue.key)) ?? [];
  const touched = event?.change_items.some((c) => list.find((i) => i.id === c.task)?.key === issue.key);

  return (
    <div className="form">
      <div className="form__main">
        <div className="form__bar">
          <span className="crumbs">{issue.origin.instance}<ChevronRight size={13} />{issue.epic}<ChevronRight size={13} />
            <span className="key">{issue.key}</span></span>
          {toolbar}
          <span className="pager" style={{ marginLeft: "auto" }}>
            {idx + 1} / {list.length}
            <button className="btn btn--ghost btn--sm" disabled={idx <= 0} aria-label="Issue sebelumnya"
                    onClick={() => onNavigate(list[idx - 1].key)}><ChevronLeft size={15} /></button>
            <button className="btn btn--ghost btn--sm" disabled={idx >= list.length - 1} aria-label="Issue berikutnya"
                    onClick={() => onNavigate(list[idx + 1].key)}><ChevronRight size={15} /></button>
          </span>
          <div className="statusbar" aria-label="Status">
            <span className={`${stage === 0 ? "on" : ""} ${issue.status === "Reopened" ? "reop" : ""}`}>
              {issue.status === "Reopened" ? "Reopened" : "To Do"}</span>
            <span className={stage === 1 ? "on" : ""}>In Progress</span>
            <span className={stage === 2 ? "on" : ""}>Done</span>
          </div>
        </div>
        <div className="sheet">
          <div className="sheet__key"><TypeIcon unplanned={issue.unplanned} />
            <span className="key">{issue.key}</span><Lozenge status={issue.status} />
            {issue.late && <span className="lozenge lozenge--late">Melewati tenggat</span>}
            {touched && <span className="lozenge" style={{ background: "color-mix(in srgb, var(--lv2) 20%, white)", color: "#7a5200" }}>Diubah kejadian ini</span>}
          </div>
          <h2 className="sheet__title">{issue.summary}</h2>
          <div className="sheet__cols">
            <div>
              <div className="prop"><span>Epic</span><span><EpicTag issue={issue} palette={palette} /></span></div>
              <div className="prop"><span>Assignee</span><span className="who">
                <Avatar id={issue.assignee_id} label={dev?.short ?? "?"} size={22} />{issue.assignee}
                <span className="muted small">({issue.origin.machine})</span></span></div>
              <div className="prop"><span>Prioritas</span><span className="who"><PriorityIcon priority={issue.priority} />
                {issue.priority} <span className="muted small mono">{angka(issue.priority_value, 2)}</span></span></div>
              <div className="prop"><span>Original estimate</span><span className="mono">{angka(issue.estimate)} jam</span></div>
              <div className="prop"><span>Sisa kerja</span><span className="mono">{angka(issue.remaining)} jam
                {issue.status === "In Progress" && <span className="muted"> ({angka(issue.progress * 100, 0)}% berjalan)</span>}</span></div>
            </div>
            <div>
              <div className="prop"><span>Mulai</span><span className="mono">jam ke-{angka(issue.start)}</span></div>
              <div className="prop"><span>Selesai</span><span className="mono">jam ke-{angka(issue.end)}</span></div>
              <div className="prop"><span>Tenggat</span><span className="mono">jam ke-{angka(issue.due)}</span></div>
              <div className="prop"><span>Keterlambatan</span>
                <span className={`mono ${issue.late ? "late-text" : "muted"}`}>{issue.late ? `${angka(issue.lateness)} jam` : "tidak terlambat"}</span></div>
              <div className="prop"><span>Rank di antrean</span><span className="mono">{issue.rank ?? "–"}</span></div>
            </div>
          </div>
          <div className="tabs" role="tablist">
            {([["detail", "Detail"], ["devs", "Pengembang layak"], ["deps", "Dependensi"],
               ...(event ? [["model", "Keputusan model"]] : [])] as [Tab, string][]).map(([t, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""}
                      onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>
          {tab === "detail" && (
            <div className="prose">
              {issue.unplanned ? (
                <p>Pekerjaan tidak terencana yang datang saat proyek berjalan. Ukuran dan kedatangannya
                  mengikuti model gangguan yang dikalibrasi dari data Jira TAWOS, sama dengan tesis.</p>
              ) : (
                <p>Operasi ke-{issue.origin.operation} dari job {issue.origin.job} pada instans{" "}
                  <span className="mono">{issue.origin.instance}</span>. Job dipetakan menjadi epic, operasi menjadi
                  issue, dan mesin menjadi pengembang.</p>
              )}
              <p className="muted">Tenggat ditetapkan dari jadwal awal S0: waktu selesai di S0 ditambah setengah upaya.
                Waktu ditulis dalam jam model, tanpa kalender.</p>
            </div>
          )}
          {tab === "devs" && (
            <table className="grid" style={{ maxWidth: 520 }}>
              <thead><tr><th>Pengembang</th><th>Mesin</th><th className="num">Upaya (jam)</th><th /></tr></thead>
              <tbody>
                {Object.entries(issue.origin.eligible).map(([m, h]) => {
                  const a = assignees.find((x) => x.origin === m);
                  return (
                    <tr key={m}><td>{a ? <span className="who"><Avatar id={a.id} label={a.short} size={20} />{a.name}</span> : m}</td>
                      <td className="mono">{m}</td><td className="num">{angka(h)}</td>
                      <td>{a?.id === issue.assignee_id && <span className="lozenge lozenge--prog">assignee</span>}</td></tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {tab === "deps" && (
            <div className="sheet__cols">
              {([["Diblokir oleh", issue.blocked_by], ["Memblokir", issue.blocks]] as [string, string[]][]).map(([label, keys]) => (
                <div key={label}>
                  <div className="muted small" style={{ fontWeight: 650, marginBottom: 6 }}>{label}</div>
                  {keys.length === 0 && <div className="muted small">Tidak ada.</div>}
                  {keys.map((k) => {
                    const o = byKey.get(k);
                    return (
                      <div key={k} className="prop" style={{ gridTemplateColumns: "90px 1fr auto" }}>
                        <span className="key key--link" onClick={() => onNavigate(k)}>{k}</span>
                        <span>{o?.summary}</span>{o && <Lozenge status={o.status} />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          {tab === "model" && event && (
            <div>
              {subs.length === 0 && <div className="muted small">Issue ini tidak termasuk himpunan terdampak A_j pada kejadian {event.index + 1}.</div>}
              {subs.map((s) => (
                <div key={s.j} className="sub">
                  <div className="sub__head">Gangguan {s.j + 1}: {event.affected[s.j]?.label}
                    {s.used !== null && <><Ladder level={s.used} />{LEVEL_SHORT[s.used]} {LEVEL_NAMES[s.used]}</>}
                    <span className={`outcome outcome--${s.outcome}`}>{s.outcome.replace("_", " ")}</span></div>
                  <div className="small muted">J {angka(s.J_before, 3)} → {angka(s.J_after, 3)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <aside className="chatter" aria-label="Riwayat">
        <h3><HistoryIcon size={15} />Riwayat</h3>
        <HistoryList entries={mine}
                     empty="Belum ada gangguan atau perubahan untuk issue ini. Riwayat terisi saat simulasi berjalan." />
      </aside>
    </div>
  );
}
