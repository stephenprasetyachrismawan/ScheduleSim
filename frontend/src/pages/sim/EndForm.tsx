// Record "Akhir episode": the schedule after the last event, run until every task is finished,
// with the final lateness, all changes, and J of the episode. This is where a method's story ends.
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Flag, Sigma } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import type { ViewName } from "../../components/ControlPanel";
import Workspace from "../../components/Workspace";
import { angka } from "../../format";
import { Info } from "../../learn/Learn";
import { specLabel } from "../../odoo/runUrl";
import { NumSrc } from "../../odoo/source";
import { ControlBar, Field, Fields, Pager, Sheet, SmartButton, SmartButtons } from "../../odoo/ui";
import { endHref, eventHref, methodHref, methodLabel, RunGate, runHref, taskHref, useSim, type Sim } from "./common";
import { namesOf, nodeEndTard, nodeEpisodeJ } from "./sources";

function Body({ sim, mk }: { sim: Sim; mk: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const idx = sim.results.findIndex((r) => r.key === mk);
  const r = sim.results[idx];
  const events = useQuery({ queryKey: ["events", sim.runId, mk], queryFn: () => api.events(sim.runId!, mk),
                            enabled: !!r, staleTime: Infinity });
  const n = events.data?.length ?? 0;
  const frame = useQuery({ queryKey: ["frame", sim.runId, mk, n - 1, "after"], enabled: n > 0,
                           queryFn: () => api.frame(sim.runId!, mk, n - 1, "after"), staleTime: Infinity });
  const log = useQuery({ queryKey: ["log", sim.runId, mk], queryFn: () => api.log(sim.runId!, mk),
                         enabled: !!r, staleTime: Infinity });
  if (!r) return null;
  const f = frame.data;
  const ep = log.data;
  const names = ep ? namesOf(ep.names, { q: sim.q, mk }) : null;
  const view = (params.get("view") as ViewName) ?? "gantt";
  const finish = f && f.issues.length ? Math.max(...f.issues.map((i) => i.end)) : null;
  const late = f ? f.issues.filter((i) => i.late).length : 0;
  const neighbour = (d: number) => {
    const o = sim.results[idx + d];
    return o ? endHref(sim.q, o.key) : null;
  };
  return (
    <div className="o-page">
      <ControlBar crumbs={[{ label: "Simulasi", to: "/simulasi" }, { label: specLabel(sim.spec), to: runHref(sim.q) },
                           { label: methodLabel(r), to: methodHref(sim.q, mk) }, { label: "Akhir episode" }]}
        right={<Pager index={idx} total={sim.results.length} label="Metode" prev={neighbour(-1)} next={neighbour(1)} />}>
        <div className="o-actions">
          {n > 0 && <button className="btn" onClick={() => navigate(eventHref(sim.q, mk, n - 1))}><ArrowLeft size={15} />Kejadian terakhir ({n})</button>}
        </div>
      </ControlBar>
      <Sheet title={<><Flag size={20} className="o-title-icon" /> Akhir episode</>}
        subtitle={<>{methodLabel(r)}. Sesudah kejadian {n} tidak ada gangguan lagi. Jadwal di bawah adalah jadwal sesudah
          keputusan terakhir; tugas dikerjakan sesuai jadwal itu sampai semuanya selesai
          {finish !== null && <> pada jam ke-{angka(finish, 1)}</>}.</>}
        smart={
          <SmartButtons>
            <SmartButton icon={CalendarClock} value={n} label="Kejadian" to={methodHref(sim.q, mk)} />
            <SmartButton icon={Sigma} value={angka(r.changes, 0)} label="Perubahan ΣU" to={methodHref(sim.q, mk, "perubahan")} />
          </SmartButtons>
        }>
        <Fields cols={3}>
          <Field label={<>J episode <Info term="J" /></>}>
            {ep && names ? <NumSrc node={() => nodeEpisodeJ(ep, names, (k) => eventHref(sim.q, mk, k))}>{angka(r.J, 3)}</NumSrc> : angka(r.J, 3)}
          </Field>
          <Field label="Tard/E akhir">
            {ep && names ? <NumSrc node={() => nodeEndTard(ep, names)}>{angka(r.tard, 3)}</NumSrc> : angka(r.tard, 3)}
          </Field>
          <Field label="Tugas terlambat">{f ? `${late} dari ${f.issues.length} tugas` : "…"}</Field>
        </Fields>
        {!f ? <div className="o-empty o-empty--wait">Memuat jadwal akhir…</div> : (
          <Workspace issues={f.issues} assignees={f.assignees} epics={f.epics} history={f.history}
                     view={view} onView={(v) => navigate(`${endHref(sim.q, mk)}&view=${v}`, { replace: true })}
                     selected={null} onSelect={() => {}} pauses={f.pauses} ghost={null} t={null}
                     onOpenIssue={(key) => navigate(taskHref(sim.spec.p, Number(key.split("-").pop()) - 1, { q: sim.q, mk }))} />
        )}
      </Sheet>
    </div>
  );
}

export default function EndForm() {
  const sim = useSim();
  const { mk = "" } = useParams();
  return <RunGate sim={sim}>{() => <Body sim={sim!} mk={mk} />}</RunGate>;
}
