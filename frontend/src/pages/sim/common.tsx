// What every simulation record needs: the run settings from the URL, the run itself (sent again
// when the server no longer knows it), names, and links between records.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Spinner } from "../../components/atoms";
import { requestOf, specFrom, specQuery, type RunSpec } from "../../odoo/runUrl";
import type { MethodSummary, Phase, RunStatus } from "../../types";

export const PHASES: { id: string; phase: Phase; label: string }[] = [
  { id: "1", phase: "before", label: "① Sebelum gangguan" },
  { id: "2", phase: "aor", label: "② Gangguan masuk" },
  { id: "3", phase: "after", label: "③ Sesudah perbaikan" },
];

export function methodLabel(r: { name: string; method: string }): string {
  return r.method === "aor" ? `${r.name} (tanpa perbaikan)` : r.name;
}

export function issueKey(project: string, id: number): string {
  return `${project}-${id + 1}`;
}

export interface Sim {
  spec: RunSpec;
  q: string;                     // query string of the run
  runId: string | null;
  run: RunStatus | undefined;
  results: MethodSummary[];      // without the "mean" rows
  allResults: MethodSummary[];
  error: ApiError | null;
}

export function useRun(spec: RunSpec | null) {
  const qc = useQueryClient();
  const key = spec ? specQuery(spec) : null;
  const start = useQuery({ queryKey: ["runFor", key], queryFn: () => api.startRun(requestOf(spec!)),
                           enabled: !!spec, staleTime: Infinity, gcTime: Infinity, retry: false });
  const runId = start.data?.run_id ?? null;
  const status = useQuery({
    queryKey: ["run", runId], queryFn: () => api.run(runId!), enabled: !!runId, retry: false,
    staleTime: Infinity, refetchInterval: (q) => (q.state.data?.status === "running" ? 400 : false),
  });
  // the server forgot the run (it restarted): send the same settings again
  useEffect(() => {
    if ((status.error as ApiError | null)?.status === 404) qc.invalidateQueries({ queryKey: ["runFor", key] });
  }, [status.error, qc, key]);
  return { runId, run: status.data, error: (start.error ?? status.error) as ApiError | null };
}

export function useSim(): Sim | null {
  const [params] = useSearchParams();
  const spec = useMemo(() => specFrom(params), [params]);
  const r = useRun(spec);
  if (!spec) return null;
  const all = r.run?.results ?? [];
  return { spec, q: specQuery(spec), runId: r.runId, run: r.run, allResults: all,
           results: all.filter((x) => x.model_seed !== "mean"), error: r.error };
}

export const runHref = (q: string) => `/simulasi/run?${q}`;
export const methodHref = (q: string, mk: string, tab?: string) =>
  `/simulasi/run/${encodeURIComponent(mk)}?${q}${tab ? `&tab=${tab}` : ""}`;
export const eventHref = (q: string, mk: string, k: number, extra = "") =>
  `/simulasi/run/${encodeURIComponent(mk)}/kejadian/${k + 1}?${q}${extra}`;
export const endHref = (q: string, mk: string) => `/simulasi/run/${encodeURIComponent(mk)}/akhir?${q}`;
/** A task, opened from a run keeps the run (and the event and step) to come back to. */
export const taskHref = (project: string, id: number, ctx?: { q: string; mk: string; k?: number; langkah?: string }) =>
  `/proyek/${project}/tugas/${id}${ctx ? `?${ctx.q}&mk=${encodeURIComponent(ctx.mk)}${ctx.k !== undefined ? `&k=${ctx.k + 1}` : ""}${ctx.langkah ? `&langkah=${ctx.langkah}` : ""}` : ""}`;

/** Shows progress or the reason a run cannot be shown, and its children only when done. */
export function RunGate({ sim, children, undo }: { sim: Sim | null; children: () => ReactNode;
                                                   undo?: string | null }) {
  if (!sim) {
    return <div className="o-page"><div className="o-empty">Alamat ini tidak memuat pengaturan run.{" "}
      <Link to="/simulasi/baru">Buat run baru</Link>.</div></div>;
  }
  if (sim.error) {
    const e = sim.error;
    return (
      <div className="o-page">
        <div className={`notice ${e.status === 403 || e.status === 429 ? "notice--warn" : "notice--error"}`}>
          {e.status === 403 && <Lock size={16} />}<span>{e.message}</span></div>
        <Link className="btn" to={`/simulasi/baru?${sim.q}`}>Ubah pengaturan run</Link>
      </div>
    );
  }
  if (!sim.run || sim.run.status === "running") {
    const done = sim.run?.done ?? 0, total = sim.run?.total ?? 0;
    return (
      <div className="o-page"><div className="o-empty o-empty--wait">
        <Spinner /> {total ? <>Menjalankan {done} dari {total} metode dengan kode penelitian…
          <span className="progress"><i style={{ width: `${(100 * done) / total}%` }} /></span></>
          : "Menyiapkan run…"}
      </div></div>
    );
  }
  if (sim.run.status === "error") {
    const e = sim.run.error;
    return (
      <div className="o-page">
        <div className="notice notice--error">{e?.rule ? `Ditolak (aturan ${e.rule}): ` : ""}{e?.message}</div>
        {undo && <Link className="btn btn--primary" to={undo}>Batalkan pilihan manual terakhir</Link>}{" "}
        <Link className="btn" to={`/simulasi/baru?${sim.q}`}>Ubah pengaturan run</Link>
      </div>
    );
  }
  return <>{children()}</>;
}
