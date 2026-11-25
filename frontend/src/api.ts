import type {
  EpisodeLog, EventLog, EventSummary, Frame, Meta, Phase, ProjectBoard, ProjectListItem,
  ProjectSpec, RerunResult, RunStatus,
} from "./types";

const OWNER = "schedulesim:token-pembuat";

/** Random token of this browser; on the public site only its maker may change a project. */
function ownerToken(): string {
  try {
    let t = localStorage.getItem(OWNER);
    if (!t) {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      t = Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(OWNER, t);
    }
    return t;
  } catch {
    return "";
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Owner-Token": ownerToken(),
               ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (body as { detail?: unknown }).detail;
    const message = typeof detail === "string" ? detail
      : Array.isArray(detail) ? detail.map((d) => d.msg ?? String(d)).join("; ")
      : `Permintaan gagal (${res.status})`;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

export interface MethodRequest { method: string; model_seed?: number | "all" }
export interface ManualRequest {
  levels?: Record<string, number>;
  moves?: Record<string, { task: number; to_dev: number; to_pos?: number }[]>;
  guard?: boolean;
}
export interface RunRequest {
  project: string;
  capacity: number;
  intensity: number;
  seed: number;
  lam: number;
  methods?: MethodRequest[];
  manual?: ManualRequest;
}

export const api = {
  meta: () => call<Meta>("/api/meta"),
  projects: () => call<ProjectListItem[]>("/api/projects"),
  project: (key: string, capacity = 1.5) =>
    call<ProjectBoard>(`/api/projects/${encodeURIComponent(key)}?capacity=${capacity}`),
  createProject: (spec: ProjectSpec) =>
    call<{ key: string }>("/api/projects", { method: "POST", body: JSON.stringify(spec) }),
  updateProject: (key: string, spec: ProjectSpec) =>
    call<{ key: string }>(`/api/projects/${key}`, { method: "PUT", body: JSON.stringify(spec) }),
  deleteProject: (key: string) => call<void>(`/api/projects/${key}`, { method: "DELETE" }),
  startRun: (req: RunRequest) =>
    call<{ run_id: string }>("/api/runs", { method: "POST", body: JSON.stringify(req) }),
  run: (id: string) => call<RunStatus>(`/api/runs/${id}`),
  events: (id: string, key: string) =>
    call<EventSummary[]>(`/api/runs/${id}/${encodeURIComponent(key)}/events`),
  frame: (id: string, key: string, k: number, phase: Phase) =>
    call<Frame>(`/api/runs/${id}/${encodeURIComponent(key)}/frames/${k}/${phase}`),
  results: () => call<Results>("/api/results"),
  log: (id: string, key: string) =>
    call<EpisodeLog>(`/api/runs/${id}/${encodeURIComponent(key)}/log`),
  logEvent: (id: string, key: string, k: number) =>
    call<EventLog>(`/api/runs/${id}/${encodeURIComponent(key)}/log/${k}`),
  rerun: (id: string, key: string) =>
    call<RerunResult>(`/api/runs/${id}/${encodeURIComponent(key)}/ulang`, { method: "POST" }),
};

export type Interval = [number, number, number];
export interface Results {
  main: Record<string, Record<string, { uk1: Interval; uk2: Interval }>>;
  claims: Record<string, Record<string, string>>;
  combined: Record<string, Record<string, { uk1: Interval; uk2: Interval }>>;
  benchmark_only: Record<string, Record<string, { uk1: Interval; uk2: Interval }>>;
  item1: Record<string, { uk1: Interval; uk2: Interval }>;
  stability: Record<string, Record<string, Interval>>;
  time: Record<string, { p95_pemilih_maks: number | null; di_bawah_50ms: boolean | null;
                         p95_total_maks?: number | null }>;
  violations: Record<string, { keras: number; episode: number; tanpa_periksa: number }>;
  tingkat?: unknown;
  note: string;
}
