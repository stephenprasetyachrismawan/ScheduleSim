import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, BookA, BookOpen, Lightbulb, CalendarRange, FlaskConical, FolderKanban, GraduationCap,
  KanbanSquare, ListTree, Route as RouteIcon, Search, ShieldCheck, ShieldAlert, SquarePen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useLearn } from "../learn/Learn";

const LAST = "schedulesim:last-project";

function remember(key: string | null) {
  try {
    if (key) localStorage.setItem(LAST, key);
  } catch { /* private window: no memory, no problem */ }
}

function recall(): string {
  try {
    return localStorage.getItem(LAST) ?? "MK01";
  } catch {
    return "MK01";
  }
}

export function projectColor(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 42%)`;
}

export default function Shell() {
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Infinity });
  const match = useMatch("/proyek/:key/*");
  const [search] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeProject = match?.params.key ?? search.get("project");
  const [current, setCurrent] = useState<string>(routeProject ?? recall());
  useEffect(() => {
    if (routeProject && routeProject !== "baru") {
      setCurrent(routeProject);
      remember(routeProject);
    }
  }, [routeProject]);
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects, staleTime: 60_000 });
  const info = projects.data?.find((p) => p.key === current);
  const view = search.get("view") ?? "list";
  const onProject = location.pathname.startsWith(`/proyek/${current}`);
  const [query, setQuery] = useState("");

  const jump = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    const m = q.match(/^([A-Z][A-Z0-9]+)-(\d+)$/);
    if (m) navigate(`/proyek/${m[1]}?view=form&issue=${q}`);
    else if (q) navigate(`/proyek/${current}?view=list&q=${encodeURIComponent(query.trim())}`);
    setQuery("");
  };

  const ok = meta.data?.models_match_test_lock;
  const learn = useLearn();
  const tourName = location.pathname.startsWith("/simulasi") ? "simulasi" : null;
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="topbar__brand"><img src="/logo.svg" alt="" />ScheduleSim</Link>
        <nav className="topbar__nav" aria-label="Utama">
          <NavLink to="/belajar">Belajar</NavLink>
          <NavLink to="/" end>Proyek</NavLink>
          <NavLink to={`/simulasi?project=${current}`}>Simulasi</NavLink>
          <NavLink to="/hasil-uji">Hasil uji tesis</NavLink>
          <NavLink to="/metode">Tentang metode</NavLink>
          <NavLink to="/istilah">Istilah</NavLink>
        </nav>
        <form className="topbar__search" onSubmit={jump} role="search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Cari issue, misalnya MK01-12" aria-label="Cari issue" />
        </form>
        <button className={`learn-toggle ${learn.on ? "on" : ""}`} aria-pressed={learn.on}
                onClick={() => learn.setOn(!learn.on)}
                title="Mode belajar: tampilkan penjelasan istilah (ⓘ) dan tur halaman">
          <GraduationCap size={16} />Mode belajar<span className="learn-toggle__dot" />
        </button>
        {learn.on && tourName && (
          <button className="btn btn--sm" onClick={() => learn.startTour(tourName)} data-tour-start>
            <RouteIcon size={14} />Tur halaman ini</button>
        )}
        {meta.data && (
          <Link to="/metode" className={`topbar__badge ${ok ? "" : "topbar__badge--bad"}`}
                title="Hash SHA-256 berkas model dibandingkan dengan dokumen kunci uji">
            {ok ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            {ok ? "Model = kunci uji" : "Model tidak cocok"}
          </Link>
        )}
      </header>
      <div className="body">
        <aside className="sidebar" aria-label="Navigasi proyek">
          <div className="sidebar__project">
            <span className="sidebar__project-icon" style={{ background: projectColor(current) }}>
              {current.slice(0, 2)}
            </span>
            <div>
              <div className="sidebar__project-name">{info?.name ?? current}</div>
              <div className="sidebar__project-group">{info?.group ?? "Proyek"}</div>
            </div>
          </div>
          <NavLink className={({ isActive }) => `nav nav--learn ${isActive ? "active" : ""}`} to="/belajar">
            <Lightbulb size={17} />Belajar dari nol</NavLink>
          <div className="sidebar__label">Perencanaan</div>
          <NavLink className={() => `nav ${onProject && view === "list" ? "active" : ""}`}
                   to={`/proyek/${current}?view=list`}><ListTree size={17} />List</NavLink>
          <NavLink className={() => `nav ${onProject && view === "board" ? "active" : ""}`}
                   to={`/proyek/${current}?view=board`}><KanbanSquare size={17} />Board</NavLink>
          <NavLink className={() => `nav ${onProject && view === "gantt" ? "active" : ""}`}
                   to={`/proyek/${current}?view=gantt`}><CalendarRange size={17} />Timeline</NavLink>
          <NavLink className={() => `nav ${onProject && view === "form" ? "active" : ""}`}
                   to={`/proyek/${current}?view=form`}><SquarePen size={17} />Form issue</NavLink>
          <div className="sidebar__label">Penjadwalan ulang</div>
          <NavLink className={({ isActive }) => `nav ${isActive ? "active" : ""}`}
                   to={`/simulasi?project=${current}`}><FlaskConical size={17} />Simulasi gangguan</NavLink>
          <div className="sidebar__label">Tesis</div>
          <NavLink className={({ isActive }) => `nav ${isActive ? "active" : ""}`} to="/hasil-uji">
            <BarChart3 size={17} />Hasil uji tesis</NavLink>
          <NavLink className={({ isActive }) => `nav ${isActive ? "active" : ""}`} to="/metode">
            <BookOpen size={17} />Tentang metode</NavLink>
          <NavLink className={({ isActive }) => `nav ${isActive ? "active" : ""}`} to="/istilah">
            <BookA size={17} />Istilah</NavLink>
          <NavLink className={({ isActive }) => `nav ${isActive ? "active" : ""}`} to="/" end>
            <FolderKanban size={17} />Semua proyek</NavLink>
          <div className="sidebar__foot">
            ARLS-PPO, resep E15 E9c<br />
            arls-ppo <span className="mono">{meta.data?.arls_ppo_commit ?? "…"}</span>
          </div>
        </aside>
        <main className="main"><Outlet /></main>
      </div>
    </div>
  );
}
