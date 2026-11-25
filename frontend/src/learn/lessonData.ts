// The one example every lesson uses: the fictional "Kedai kopi digital" project (12 tasks,
// 4 developers), run with the thesis code at capacity 1.5, intensity 0.15, validation seed
// 5000 and λ = 3. All numbers in the lessons are read from this run, never typed by hand.
import { defaultSpec, specQuery } from "../odoo/runUrl";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { EpisodeLog, EventLog, EventSummary, MethodSummary } from "../types";

export const SCENARIO = {
  project: "KOPI", capacity: 1.5, intensity: 0.15, seed: 5000, lam: 3,
  methods: [{ method: "ppo_bc_ppo_g", model_seed: 0 as const }, { method: "aor" }, { method: "seq" },
            { method: "fix3_g" }, { method: "acak_g" }],
};
export const PPO = "ppo_bc_ppo_g@0";
export const METHOD_KEYS = [PPO, "aor", "seq", "fix3_g", "acak_g"];
/** The same example run, opened as a record in Simulasi. */
export const KOPI_RUN = `/simulasi/run?${specQuery({ ...defaultSpec("KOPI", 1.5), m: METHOD_KEYS })}`;
/** Events of the PPO run whose full log the lessons read. */
export const LOGGED_EVENTS = [0, 1, 3];

export interface LessonData {
  runId: string;
  results: MethodSummary[];
  log: EpisodeLog;
  ev: Record<number, EventLog>;
  events: Record<string, EventSummary[]>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startScenario(): Promise<{ runId: string; results: MethodSummary[] }> {
  const { run_id } = await api.startRun(SCENARIO);
  for (let i = 0; i < 600; i++) {
    const s = await api.run(run_id);
    if (s.status === "done") return { runId: run_id, results: s.results };
    if (s.status === "error") throw new Error(s.error?.message ?? "run gagal");
    await sleep(500);
  }
  throw new Error("run contoh terlalu lama");
}

export function useLessonData(): { data: LessonData | null; error: Error | null; loading: boolean } {
  const run = useQuery({ queryKey: ["lesson-run"], queryFn: startScenario, staleTime: Infinity, retry: 1 });
  const runId = run.data?.runId;
  const log = useQuery({ queryKey: ["log", runId, PPO], queryFn: () => api.log(runId!, PPO),
                         enabled: !!runId, staleTime: Infinity });
  const evs = useQueries({ queries: LOGGED_EVENTS.map((k) => ({
    queryKey: ["log", runId, PPO, k], queryFn: () => api.logEvent(runId!, PPO, k), enabled: !!runId,
    staleTime: Infinity })) });
  const lists = useQueries({ queries: METHOD_KEYS.map((key) => ({
    queryKey: ["events", runId, key], queryFn: () => api.events(runId!, key), enabled: !!runId,
    staleTime: Infinity })) });
  const error = (run.error ?? log.error ?? evs.find((q) => q.error)?.error
                 ?? lists.find((q) => q.error)?.error ?? null) as Error | null;
  const ready = run.data && log.data && evs.every((q) => q.data) && lists.every((q) => q.data);
  if (!ready) return { data: null, error, loading: !error };
  return {
    data: {
      runId: run.data!.runId, results: run.data!.results, log: log.data!,
      ev: Object.fromEntries(LOGGED_EVENTS.map((k, i) => [k, evs[i].data!])),
      events: Object.fromEntries(METHOD_KEYS.map((key, i) => [key, lists[i].data!])),
    },
    error: null, loading: false,
  };
}
