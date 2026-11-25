// The frame of every page: one menu bar on top, like the menu of an Odoo app, and the record
// below it at full width. The "Asal angka" sheet is available on every page.
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Route as RouteIcon, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useLearn } from "../learn/Learn";
import { SourceProvider } from "../odoo/source";

export function projectColor(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 42%)`;
}

export default function Shell() {
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Infinity });
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // "MK01-56" opens task id 55 of MK01; anything else searches the projects list
  const jump = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    const m = q.match(/^([A-Z][A-Z0-9]+)-(\d+)$/);
    if (m) navigate(`/proyek/${m[1]}/tugas/${Number(m[2]) - 1}`);
    else if (/^[A-Z][A-Z0-9]+$/.test(q)) navigate(`/proyek/${q}`);
    setQuery("");
  };

  const ok = meta.data?.models_match_test_lock;
  const learn = useLearn();
  const tourName = /^\/simulasi\/run\/[^/]+\/kejadian\//.test(location.pathname) ? "kejadian" : null;
  return (
    <SourceProvider>
      <div className="shell">
        <header className="topbar">
          <Link to="/" className="topbar__brand"><img src="/logo.svg" alt="" />ScheduleSim</Link>
          <nav className="topbar__nav" aria-label="Utama">
            <NavLink to="/belajar">Belajar</NavLink>
            <NavLink to="/" end className={({ isActive }) => (isActive || location.pathname.startsWith("/proyek") ? "active" : "")}>Proyek</NavLink>
            <NavLink to="/simulasi">Simulasi</NavLink>
            <NavLink to="/hasil-uji">Hasil uji tesis</NavLink>
            <NavLink to="/metode">Tentang metode</NavLink>
            <NavLink to="/istilah">Istilah</NavLink>
          </nav>
          <form className="topbar__search" onSubmit={jump} role="search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Buka tugas, misalnya MK01-56" aria-label="Buka tugas atau proyek" />
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
                  title={`Hash SHA-256 berkas model dibandingkan dengan dokumen kunci uji. arls-ppo ${meta.data.arls_ppo_commit ?? ""}`}>
              {ok ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
              {ok ? "Model = kunci uji" : "Model tidak cocok"}
            </Link>
          )}
        </header>
        <main className="main"><Outlet /></main>
      </div>
    </SourceProvider>
  );
}
