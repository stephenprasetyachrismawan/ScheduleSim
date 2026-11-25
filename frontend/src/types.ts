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
  public?: boolean;
  limits?: Record<string, number> | null;
}

// ------------------------------------------------------------------ number log (arls-ppo v1.1.0)
export interface FeatureItem {
  group: string;
  name: string;
  formula: string;
  inputs: Record<string, unknown>;
  value: number;
  note?: string;
}

export interface LateRow { tugas: number; pengembang: number; C: number; d: number; telat: number }

export interface QueueRow {
  dev: number;
  lama: number[];
  baru: number[];
  tetap: number[];
  posisi_lama: number[];
  lis: number;
  n: number;
  pindah_posisi: number[];
}

export interface LevelValue {
  level: number | string;
  feasible: boolean;
  reason?: string;
  tard?: number;
  E?: number;
  tard_over_E?: number;
  late?: LateRow[];
  moved_dev?: { tugas: number; dari: number; ke: number }[];
  queues?: QueueRow[];
  md?: number;
  mp?: number;
  U?: number;
  lam?: number;
  lamU?: number;
  J?: number;
}

export interface SelectorLog {
  kind: "ppo" | "boosting" | "rule" | "manual" | "unknown";
  guard?: boolean;
  chosen: number;
  allowed?: number[];
  // ppo
  x?: number[];
  mu?: number[];
  sd?: number[];
  raw?: number[];
  obs?: number[];
  clipped?: number[];
  h1?: number[];
  h2?: number[];
  layers?: number[];
  activation?: string;
  logits?: number[];
  z_max?: number;
  exp?: number[];
  sum_exp?: number;
  probs?: number[];
  // boosting / rule
  classes?: number[];
  model?: string;
  n_trees?: number | null;
  scores?: (number | null)[] | null;
  rule?: string;
  name?: string;
}

export interface DecisionLog {
  rule: "teacher" | "tingkat_0" | "operator_gagal" | "guard" | "tanpa_guard";
  requested: number;
  used: number;
  J_now: number;
  J_candidate?: number;
  limit?: number;
  accepted?: boolean;
  candidates?: Record<string, number>;
  text: string;
}

export interface SubLog {
  j: number;
  type: string;
  affected: number[];
  requested: number | null;
  used: number | null;
  outcome: Sub["outcome"];
  mask: number[] | null;
  J_before: number;
  J_after: number;
  changes_before: number | null;
  changes_after: number;
  features: FeatureItem[] | null;
  selector: SelectorLog | null;
  levels: Record<string, LevelValue>;
  decision: DecisionLog | null;
}

export interface EffectLog {
  type: string;
  time: number;
  direct: number[];
  affected: number[];
  late_shift: { tugas: number; C_sebelum: number; C_sesudah: number; d: number }[];
  shifts: { tugas: number; pengembang: number; mulai_sebelum: number; mulai_sesudah: number;
            C_sebelum: number; C_sesudah: number }[];
  detail?: Record<string, unknown>;
  error?: string;
}

export interface LogNames { project: string; devs: Record<string, string> }

export interface EventLog {
  index: number;
  time: number;
  tard_before: number;
  tard_aor: number;
  tard_after: number;
  J_after_batch: number;
  changes: number;
  disruptions: EffectLog[];
  manual: LevelValue | null;
  change_items: { task: number; kind: string }[];
  subs: SubLog[];
  lam: number;
  names: LogNames;
}

export interface InputLog {
  instance: string;
  n_tasks: number;
  n_jobs: number;
  n_devs: number;
  capacity: { m: number; total_nominal: number; n_devs: number; value: number; rumus: string };
  s0_rule: string;
  s0_rebuilt_equal: boolean;
  due_slack: number;
  due_rule: string;
  tasks: { tugas: number; job: number; op: number; layak: Record<string, number>; deps: number[];
           d_twk: number | null; pengembang: number; S: number; C: number; upaya: number;
           d: number }[];
  E: { sum: number; n: number; value: number; rumus: string };
  refs: { horizon: number; tard0_denom: number; n_ref: number; i_window: number; i_max: number };
}

export interface DisruptionLog {
  seed: number;
  seed_rule: string;
  seed_inputs: Record<string, unknown>;
  generator: string;
  horizon: number;
  m: number;
  params: Record<string, number>;
  n: number;
  window: number;
  window_rule: string;
  counts: Record<string, number>;
  events: { time: number; members: { type: string; time: number;
                                     payload: Record<string, unknown> }[] }[];
  regenerated_equal: boolean;
}

export interface EpisodeLog {
  meta: Frame["meta"] & { instance: string; capacity: number; intensity: number; seed: number };
  names: LogNames;
  disruption_types: Record<string, string>;
  input: InputLog | null;
  disruptions: DisruptionLog | null;
  events: { index: number; time: number; disruptions: string[]; levels: number[];
            outcomes: string[]; tard_aor: number; J_after_batch: number; changes: number }[];
  output: { tard: number; E: number; tard_over_E: number; late: LateRow[]; changes: number;
            lam: number; J: number; rumus: string } | null;
  result: { telat: number; ubah: number; J: number; keputusan: number };
  determinism: { episode_seed: number; disruption_seed: number | null; rng: string | null;
                 model_seed: number | null; model_files: { path: string; sha256: string }[];
                 arls_ppo_commit: string | null; cache_key: string;
                 not_deterministic: string[] };
}

export interface RerunResult {
  same: boolean;
  compared: number;
  differences: string[];
  n_differences?: number;
  seconds: number;
}
