// Record of one method inside a run: its events one per row (ending with "Akhir episode"), and
// every change it made over the episode.
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Flag, GitCompareArrows } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { Ladder } from "../../components/atoms";
import { HistoryList } from "../../components/views/IssueForm";
import { angka } from "../../format";
import { Info } from "../../learn/Learn";
import { specLabel } from "../../odoo/runUrl";
import { NumSrc } from "../../odoo/source";
import { ControlBar, Field, Fields, ListTable, Notebook, Pager, Sheet, SmartButton, SmartButtons } from "../../odoo/ui";
import type { EventSummary } from "../../types";
import { endHref, eventHref, methodHref, methodLabel, RunGate, runHref, useSim, type Sim } from "./common";
import { namesOf, nodeEndTard, nodeEpisodeJ } from "./sources";

type Row = { kind: "event"; e: EventSummary } | { kind: "end" };

function Body({ sim, mk }: { sim: Sim; mk: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const idx = sim.results.findIndex((r) => r.key === mk);
  const r = sim.results[idx];
  const events = useQuery({ queryKey: ["events", sim.runId, mk], queryFn: () => api.events(sim.runId!, mk),
                            enabled: !!r, staleTime: Infinity });
  const log = useQuery({ queryKey: ["log", sim.runId, mk], queryFn: () => api.log(sim.runId!, mk),
                         enabled: !!r, staleTime: Infinity });
  const n = events.data?.length ?? 0;
  const end = useQuery({ queryKey: ["frame", sim.runId, mk, n - 1, "after"], enabled: n > 0,
                         queryFn: () => api.frame(sim.runId!, mk, n - 1, "after"), staleTime: Infinity });
  if (!r) return <div className="o-page"><div className="o-empty">Metode {mk} tidak ada di run ini. <Link to={runHref(sim.q)}>Kembali ke run</Link>.</div></div>;
  const tab = params.get("tab") ?? "kejadian";
  const ep = log.data;
  const names = ep ? namesOf(ep.names, { q: sim.q, mk }) : null;
  const rows: Row[] = [...(events.data ?? []).map((e) => ({ kind: "event" as const, e })), { kind: "end" as const }];
  const changes = (end.data?.history ?? []).filter((h) => h.kind === "assignee" || h.kind === "rank");
  const href = (t: string) => methodHref(sim.q, mk, t);
  const neighbour = (d: number) => {
    const o = sim.results[idx + d];
    return o ? methodHref(sim.q, o.key, tab) : null;
  };
  return (
    <div className="o-page">
      <ControlBar crumbs={[{ label: "Simulasi", to: "/simulasi" }, { label: specLabel(sim.spec), to: runHref(sim.q) },
                           { label: methodLabel(r) }]}
        right={<Pager index={idx} total={sim.results.length} label="Metode" prev={neighbour(-1)} next={neighbour(1)} />} />
      <Sheet title={methodLabel(r)}
        subtitle={r.method === "aor"
          ? "Metode pembanding: gangguan dimasukkan lalu jadwal dibiarkan (selalu tingkat 0). Dipakai sebagai patokan seberapa buruk jadwal tanpa perbaikan."
          : "Pada setiap kejadian metode ini memilih satu tingkat perbaikan untuk setiap gangguan. Buka satu kejadian untuk melihat jadwal sebelum dan sesudahnya."}
        badge={typeof r.model_seed === "number" ? <span className="o-badge">seed model {r.model_seed}</span> : undefined}
        smart={
          <SmartButtons>
            <SmartButton icon={CalendarClock} value={n || "…"} label="Kejadian" to={href("kejadian")} />
            <SmartButton icon={GitCompareArrows} value={angka(r.changes, 0)} label="Perubahan ΣU" to={href("perubahan")} />
            <SmartButton icon={Flag} value="Akhir" label="episode" to={endHref(sim.q, mk)} />
          </SmartButtons>
        }>
        <Fields cols={3}>
          <Field label={<>J episode <Info term="J" /></>}>
            {ep && names ? <NumSrc node={() => nodeEpisodeJ(ep, names, (k) => eventHref(sim.q, mk, k))}>{angka(r.J, 3)}</NumSrc> : angka(r.J, 3)}
          </Field>
          <Field label="Tard/E akhir">
            {ep && names ? <NumSrc node={() => nodeEndTard(ep, names)}>{angka(r.tard, 3)}</NumSrc> : angka(r.tard, 3)}
          </Field>
          <Field label="Keputusan">{r.decisions} sub-keputusan pada {n} kejadian</Field>
        </Fields>
        <Notebook current={tab} hrefOf={href} tabs={[
          { id: "kejadian", label: "Kejadian", count: n },
          { id: "perubahan", label: "Perubahan", count: changes.length },
        ]}>
          {tab === "kejadian" && (
            <ListTable rows={rows} rowKey={(x) => (x.kind === "end" ? "end" : x.e.index)}
              onRow={(x) => navigate(x.kind === "end" ? endHref(sim.q, mk) : eventHref(sim.q, mk, x.e.index))}
              caption="Satu baris = satu kejadian. Klik untuk membuka jadwal kejadian itu. Baris terakhir adalah akhir episode."
              columns={[
                { label: "Kejadian", cell: (x) => (x.kind === "end" ? <b>Akhir episode</b> : <b>Kejadian {x.e.index + 1}</b>) },
                { label: "Jam", num: true, cell: (x) => (x.kind === "end" ? "" : angka(x.e.time, 1)) },
                { label: "Gangguan", cell: (x) => (x.kind === "end" ? <span className="muted">tidak ada gangguan lagi</span>
                  : <span className="small">{x.e.disruptions.map((d) => d.label).join(", ")}</span>) },
                { label: <>Tingkat dipakai <Info term="ladder" /></>, cell: (x) => (x.kind === "end" ? "" : (
                  <span className="o-ladders">{x.e.levels.map((l, j) => <Ladder key={j} level={r.method === "aor" ? null : l} />)}</span>)) },
                { label: "U", num: true, cell: (x) => (x.kind === "end" ? "" : x.e.changes) },
                { label: "Tard/E ③", num: true, cell: (x) => (x.kind === "end" ? angka(r.tard, 3) : angka(x.e.tard_after, 3)) },
                { label: "J", num: true, cell: (x) => (x.kind === "end" ? <b>{angka(r.J, 3)}</b> : angka(x.e.J_after_batch, 3)) },
              ]}
              footer={["", "", "", "Σ", String(r.changes), "", ""]} />
          )}
          {tab === "perubahan" && (
            <HistoryList entries={changes} empty="Metode ini tidak mengubah assignee atau urutan antrean selama episode." />
          )}
        </Notebook>
      </Sheet>
    </div>
  );
}

export default function MethodForm() {
  const sim = useSim();
  const { mk = "" } = useParams();
  return <RunGate sim={sim}>{() => <Body sim={sim!} mk={mk} />}</RunGate>;
}

