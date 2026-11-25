import { useQuery } from "@tanstack/react-query";
import { Lightbulb, Lock, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/atoms";
import { projectColor } from "../components/Shell";

const GROUPS = ["Proyek sendiri", "Brandimarte (latih)", "Benchmark (latih)", "Benchmark (validasi)"];

export default function ProjectsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  return (
    <div className="page">
      <div className="crumbs">ScheduleSim</div>
      <div className="page__head">
        <h1 className="page__title">Proyek</h1>
        <Link to="/proyek/baru" className="btn btn--primary" style={{ marginLeft: "auto" }}>
          <Plus size={16} />Proyek baru</Link>
      </div>
      <p className="page__sub">
        Setiap proyek adalah instans penjadwalan dari tesis: job menjadi epic, operasi menjadi issue,
        dan mesin menjadi pengembang. Buka proyek untuk melihat jadwal awalnya, lalu simulasikan
        gangguan untuk melihat cara setiap metode memperbaiki jadwal.
      </p>
      <Link to="/belajar" className="learn-banner">
        <Lightbulb size={20} />
        <span><b>Baru di sini?</b> Mulai dari <u>Belajar dari nol</u>: sembilan pelajaran pendek dengan contoh kecil dan
          soal latihan, dari "apa itu jadwal" sampai cara ARLS-PPO memilih perbaikan.</span>
      </Link>
      <div className="notice notice--warn">
        <Lock size={16} style={{ flex: "none", marginTop: 2 }} />
        <span>MK03, MK04, MK09, dan 35 instans benchmark uji adalah data uji tesis dan tidak bisa dibuka
          di sini. Hasilnya dibaca langsung dari berkas hasil di halaman{" "}
          <Link to="/hasil-uji">Hasil uji tesis</Link>.</span>
      </div>
      {isLoading && <Spinner />}
      {GROUPS.map((g) => {
        const items = data?.filter((p) => p.group === g) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={g}>
            <h2 className="section-title">{g} <span className="muted small">{items.length}</span></h2>
            <div className="cards">
              {items.map((p) => (
                <Link key={p.key} to={`/proyek/${p.key}?view=board`} className="pcard">
                  <span className="sidebar__project-icon" style={{ background: projectColor(p.key) }}>
                    {p.key.slice(0, 2)}</span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="muted small">
                      <span className="mono">{p.key}</span>
                      {p.n_tasks !== undefined && ` · ${p.n_tasks} issue · ${p.n_devs} pengembang`}
                    </div>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
