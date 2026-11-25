// The settings of a run live in the URL, so reloading a page, the Back button, and a shared
// link always come back to the same record. The server keeps runs in memory only; when it no
// longer knows a run (after a restart), the page sends the same settings again and the result
// comes back at once from the trace cache.
import type { ManualRequest, MethodRequest, RunRequest } from "../api";

export type Mode = "compare" | "levels" | "drag";

export interface RunSpec {
  p: string;            // project key
  cap: number;
  int: number;
  seed: number;
  lam: number;
  m: string[];          // "ppo_bc_ppo_g@0", "ppo_bc_ppo_g@all", "fix3_g", ...
  mode: Mode;
  guard: boolean;       // manual modes only
  man: ManualRequest;   // manual choices: levels "k:j" -> level, moves per event
}

export const DEFAULT_METHODS = ["ppo_bc_ppo_g@0", "fix3_g", "acak_g", "aor"];

export function defaultSpec(p = "MK01", cap = 1.5): RunSpec {
  return { p, cap, int: 0.15, seed: 5000, lam: 3, m: DEFAULT_METHODS, mode: "compare", guard: false,
           man: {} };
}

export function specFrom(params: URLSearchParams): RunSpec | null {
  const p = params.get("p");
  if (!p) return null;
  const num = (k: string, d: number) => {
    const v = Number(params.get(k));
    return params.has(k) && Number.isFinite(v) ? v : d;
  };
  let man: ManualRequest = {};
  try { man = JSON.parse(params.get("man") ?? "{}"); } catch { man = {}; }
  const mode = (params.get("mode") as Mode) ?? "compare";
  return {
    p, cap: num("cap", 1.5), int: num("int", 0.15), seed: num("seed", 5000), lam: num("lam", 3),
    m: (params.get("m") ?? DEFAULT_METHODS.join(",")).split(",").filter(Boolean),
    mode: ["compare", "levels", "drag"].includes(mode) ? mode : "compare",
    guard: params.get("guard") === "1", man,
  };
}

/** Query string of a run, in a fixed order so the same run always has the same URL; "@" and ","
 *  stay readable ("m=ppo_bc_ppo_g@0,aor"). */
export function specQuery(s: RunSpec): string {
  const enc = (v: string) => encodeURIComponent(v).replace(/%40/g, "@").replace(/%2C/g, ",");
  const parts: [string, string][] = [["p", s.p], ["cap", String(s.cap)], ["int", String(s.int)],
                                     ["seed", String(s.seed)], ["lam", String(s.lam)]];
  if (s.mode === "compare") parts.push(["m", s.m.join(",")]);
  else {
    parts.push(["mode", s.mode]);
    if (s.guard) parts.push(["guard", "1"]);
    if (Object.keys(s.man.levels ?? {}).length || Object.keys(s.man.moves ?? {}).length)
      parts.push(["man", JSON.stringify({ levels: s.man.levels ?? {}, moves: s.man.moves ?? {} })]);
  }
  return parts.map(([k, v]) => `${k}=${enc(v)}`).join("&");
}

export function requestOf(s: RunSpec): RunRequest {
  if (s.mode !== "compare") {
    return { project: s.p, capacity: s.cap, intensity: s.int, seed: s.seed, lam: s.lam,
             methods: [{ method: "ppo_bc_ppo_g", model_seed: 0 }, { method: "aor" }],
             manual: { levels: s.man.levels ?? {}, moves: s.man.moves ?? {}, guard: s.guard } };
  }
  const methods: MethodRequest[] = s.m.map((key) => {
    const [method, seed] = key.split("@");
    if (seed === undefined) return { method };
    return { method, model_seed: seed === "all" ? "all" : Number(seed) };
  });
  return { project: s.p, capacity: s.cap, intensity: s.int, seed: s.seed, lam: s.lam, methods };
}

/** Short name of a run for breadcrumbs: "MK01 · 1,5 · 0,15 · 5000 · λ 3". */
export function specLabel(s: RunSpec): string {
  const f = (v: number) => String(v).replace(".", ",");
  const tail = s.mode === "levels" ? " · manual: pilih tingkat" : s.mode === "drag" ? " · manual: geser kartu" : "";
  return `${s.p} · ${f(s.cap)} · ${f(s.int)} · ${s.seed} · λ ${f(s.lam)}${tail}`;
}

// ------------------------------------------------------------------ recent runs of this browser
const RECENT = "schedulesim:run-terakhir";

export interface Recent { q: string; label: string; at: number }

export function recentRuns(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function rememberRun(s: RunSpec): void {
  try {
    const q = specQuery(s);
    const list = [{ q, label: specLabel(s), at: Date.now() }, ...recentRuns().filter((r) => r.q !== q)];
    localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 12)));
  } catch { /* private window: no list, no problem */ }
}
