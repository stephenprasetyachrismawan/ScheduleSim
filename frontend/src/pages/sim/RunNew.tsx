// Form of a new run: the settings of one episode. "Jalankan" opens the run as its own record.
import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { angka, lambdaLabel } from "../../format";
import { Info } from "../../learn/Learn";
import { defaultSpec, rememberRun, specFrom, specQuery, type Mode, type RunSpec } from "../../odoo/runUrl";
import { ControlBar, Field, Fields, Sheet } from "../../odoo/ui";
import { runHref } from "./common";

export default function RunNew() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Infinity });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const [s, setS] = useState<RunSpec>(() => {
    const from = specFrom(params);
    return from ?? defaultSpec(params.get("p") ?? "MK01", Number(params.get("cap") ?? 1.5));
  });
  const set = (patch: Partial<RunSpec>) => setS((x) => ({ ...x, ...patch }));
  const methods = meta.data?.methods ?? [];
  const ppoSeed = s.m.find((k) => k.startsWith("ppo_"))?.split("@")[1] ?? "0";
  const toggle = (code: string) => {
    const keyOf = (c: string) => (c.startsWith("ppo_") ? `${c}@${ppoSeed}` : c);
    const on = s.m.some((k) => k.split("@")[0] === code);
    set({ m: on ? s.m.filter((k) => k.split("@")[0] !== code) : [...s.m, keyOf(code)] });
  };
  const setSeed = (v: string) => set({ m: s.m.map((k) => (k.startsWith("ppo_") ? `${k.split("@")[0]}@${v}` : k)) });
  const go = () => {
    const spec = { ...s, man: {} };
    rememberRun(spec);
    navigate(runHref(specQuery(spec)));
  };
  const groups = ["Proyek sendiri", "Brandimarte (latih)", "Benchmark (latih)", "Benchmark (validasi)"];

  return (
    <div className="o-page">
      <ControlBar crumbs={[{ label: "Simulasi", to: "/simulasi" }, { label: "Run baru" }]} />
      <Sheet title="Run baru" subtitle="Satu run = satu episode: proyek yang sama, gangguan yang sama, dijalankan dengan beberapa metode. Gangguan ditentukan oleh seed episode, jadi semua metode mendapat soal yang sama.">
        <Fields>
          <Field label={<>Proyek <Info term="instance" /></>}
                 hint={<Link to={`/proyek/${s.p}`}>Buka data master {s.p}</Link>}>
            <select className="select" value={s.p} onChange={(e) => set({ p: e.target.value })} data-tour="setup">
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {projects.data?.filter((p) => p.group === g).map((p) => <option key={p.key} value={p.key}>{p.key} · {p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label={<>Kapasitas <Info term="capacity" /></>}>
            <select className="select" value={s.cap} onChange={(e) => set({ cap: Number(e.target.value) })}>
              {(meta.data?.capacities ?? [1, 1.5, 2]).map((c) => <option key={c} value={c}>{angka(c)}</option>)}
            </select>
          </Field>
          <Field label={<>Intensitas gangguan <Info term="intensity" /></>}>
            <select className="select" value={s.int} onChange={(e) => set({ int: Number(e.target.value) })}>
              {(meta.data?.intensities ?? [0.05, 0.15, 0.3]).map((c) => <option key={c} value={c}>{angka(c, 2)}</option>)}
            </select>
          </Field>
          <Field label={<>Seed episode <Info term="seed" /></>} hint="Seed validasi tesis: 5000 dan 5001. Seed uji ditolak.">
            <input className="input mono" type="number" value={s.seed} onChange={(e) => set({ seed: Number(e.target.value) })} />
          </Field>
          <Field label={<>λ (change penalty) <Info term="lambda" /></>}>
            <select className="select" value={s.lam} onChange={(e) => set({ lam: Number(e.target.value) })}>
              {(meta.data?.lambdas ?? [0.1, 0.3, 1, 3, 10, 30]).map((l) => (
                <option key={l} value={l}>{lambdaLabel(l)}{meta.data?.labelled_lambdas.includes(l) ? " (berlabel)" : ""}</option>))}
            </select>
          </Field>
        </Fields>
        <Field wide label="Mode">
            <div className="segmented">
              {([["compare", "Bandingkan metode"], ["levels", "Manual: pilih tingkat"], ["drag", "Manual: geser kartu"]] as [Mode, string][]).map(([m, label]) => (
                <button key={m} type="button" className={s.mode === m ? "on" : ""} onClick={() => set({ mode: m })}>{label}</button>
              ))}
            </div>
          </Field>
        {s.mode === "compare" ? (
          <Field wide label={<>Metode <Info term="methods" /></>}>
            <div className="o-checks">
              {methods.map((m) => (
                <label key={m.code} className="check">
                  <input type="checkbox" checked={s.m.some((k) => k.split("@")[0] === m.code)} onChange={() => toggle(m.code)} />
                  {m.name}
                </label>
              ))}
              <label className="who small">seed model PPO
                <select className="select" value={ppoSeed} onChange={(e) => setSeed(e.target.value)}>
                  <option value="0">0</option><option value="1">1</option><option value="2">2</option>
                  <option value="all">0, 1, 2 dan rata-rata</option>
                </select></label>
            </div>
          </Field>
        ) : (
          <Field wide label="Guard" hint="Pilihan Anda dibandingkan dengan ARLS-PPO dan AOR pada gangguan yang sama.">
            <label className="check"><input type="checkbox" checked={s.guard} onChange={(e) => set({ guard: e.target.checked })} />
              Tolak pilihan saya bila menaikkan J <Info term="guard" /></label>
          </Field>
        )}
        <div className="o-sheet__actions">
          <button className="btn btn--primary" onClick={go} disabled={s.mode === "compare" && s.m.length === 0} data-tour="run">
            <Play size={15} />Jalankan</button>
          <span className="muted small">Hasil yang sudah pernah dihitung diambil dari cache, jadi langsung muncul.</span>
        </div>
      </Sheet>
    </div>
  );
}
