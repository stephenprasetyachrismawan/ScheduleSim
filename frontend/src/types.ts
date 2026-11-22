// Shapes of the ScheduleSim API (backend/schedulesim/api.py). Every number in them comes
// from arls-ppo; the frontend only displays them.

export type StatusName = "To Do" | "In Progress" | "Done" | "Reopened";

export interface Origin {
  instance: string;
  job: number | null;
  operation: number | null;
  machine: string;
  eligible: Record<string, number>;
}

export interface Issue {
  id: number;
  key: string;
  summary: string;
  epic: string;
  epic_id: number | null;
  unplanned: boolean;
  status: StatusName;
  status_code: string;
  assignee: string;
  assignee_id: number;
  estimate: number;
  progress: number;
  remaining: number;
  start: number;
  end: number;
  due: number;
  late: boolean;
  lateness: number;
  rank: number | null;
  priority: "Highest" | "High" | "Medium" | "Low";
  priority_value: number;
  blocked_by: string[];
  blocks: string[];
  origin: Origin;
}

export interface Epic {
  id: number;
  key: string;
  name: string;
  color: number;
}

export interface Assignee {
  id: number;
  name: string;
  short: string;
  origin: string;
  capacity: number;
}

export interface HistoryEntry {
  event: number;
  phase: "aor" | "after";
  t: number;
  kind: "created" | "estimate" | "reopened" | "priority" | "unavailable" | "assignee" | "rank";
  issue: string | null;
  assignee: string | null;
  text: string;
}

export interface Sub {
  j: number;
  type: string;
  affected: number[];
  requested: number | null;
  used: number | null;
  outcome: "dipakai" | "ditolak_penjaga" | "gagal" | "tingkat_0" | "aor" | "manual_geser";
  J_before: number;
  J_after: number;
  changes_after: number;
  J_candidate?: number;
  changes_candidate?: number;
  features?: number[];
  mask?: number[];
  probs?: number[] | null;
  options?: Record<string, number>;
}

export interface Disruption {
  type: string;
  label: string;
  time: number;
  payload: Record<string, unknown>;
}

export interface EventDetail {
  index: number;
  time: number;
  type: string;
  disruptions: Disruption[];
  affected: { type: string; label: string; issues: string[] }[];
  tard_before: number;
  tard_aor: number;
  tard_after: number;
  subs: Sub[];
  changes: number;
  J_after_batch: number;
  change_items: { task: number; kind: "assignee" | "rank" }[];
  moves?: { task: number; to_dev: number; to_pos?: number }[];
}

export type Phase = "before" | "aor" | "after";

export interface Span {
  dev: number;
  start: number;
  end: number;
}

export interface Frame {
  t: number;
  phase: Phase;
  event: EventDetail;
  issues: Issue[];
  history: HistoryEntry[];
  pauses: Record<string, [number, number][]>;
  ghost: Record<string, Span> | null;
  epics: Epic[];
  assignees: Assignee[];
  meta: { method: string; method_name: string; lam: number; mean_effort: number;
          model_seed: number | null; feature_names: string[];
          model_files: { path: string; sha256: string }[] };
}

export interface EventSummary {
  index: number;
  time: number;
  disruptions: { type: string; label: string; time: number }[];
  levels: (number | null)[];
  outcomes: Sub["outcome"][];
  changes: number;
  changes_total: number;
  tard_before: number;
  tard_aor: number;
  tard_after: number;
  J_after_batch: number;
}

export interface MethodSummary {
  key: string;
  method: string;
  name: string;
  model_seed: number | "mean" | null;
  J: number;
  tard: number;
  changes: number;
  decisions: number;
  ms_selector_p95: number | null;
  ms_decision_mean: number | null;
  levels: { diminta: number[]; dipakai: number[]; gagal: number; ditolak_penjaga: number } | null;
  hard_violations: number;
}

export interface RunStatus {
  run_id: string;
  status: "running" | "done" | "error";
  done: number;
  total: number;
  context: { key: string; name: string; capacity: number; intensity: number; seed: number;
             lam: number };
  results: MethodSummary[];
  error: { message: string; rule: string | null; task?: number | null; dev?: number | null } | null;
}

export interface ProjectListItem {
  key: string;
  name: string;
  group: string;
  editable: boolean;
  n_tasks?: number;
  n_devs?: number;
}

export interface ProjectSpec {
  key: string;
  name: string;
  developers: { name: string }[];
  epics: { name: string; issues: { summary: string; efforts: Record<string, number> }[] }[];
  links: { from: [number, number]; to: [number, number] }[];
}

export interface ProjectBoard {
  project: { key: string; name: string; group: string; source: string; editable: boolean;
             capacity: number };
  epics: Epic[];
  assignees: Assignee[];
  issues: Issue[];
  spec: ProjectSpec | null;
}

export interface MethodInfo {
  code: string;
  name: string;
  learned: boolean;
  guard: boolean;
  model_seeds: number[] | null;
}

export interface Meta {
  methods: MethodInfo[];
  manual_methods: { code: string; name: string }[];
  lambdas: number[];
  labelled_lambdas: number[];
  capacities: number[];
  intensities: number[];
  validation_seeds: number[];
  test_seeds: [number, number][];
  disruption_types: Record<string, string>;
  feature_names: string[];
  models: { path: string; expected: string; actual: string | null; ok: boolean }[];
  models_match_test_lock: boolean;
  arls_ppo_commit: string | null;
}
