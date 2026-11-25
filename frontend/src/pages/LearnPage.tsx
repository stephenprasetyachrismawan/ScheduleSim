import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { LESSONS } from "../learn/lessons";
import { getProgress } from "../learn/progress";
import { KOPI_RUN } from "../learn/lessonData";

export default function LearnPage() {
  const states = LESSONS.map((l) => getProgress(l.id));
  const next = LESSONS.find((_, i) => !states[i].done) ?? LESSONS[0];
  const total = LESSONS.reduce((t, l) => t + l.minutes, 0);
  return (
    <div className="page">
      <div className="crumbs">ScheduleSim</div>
      <div className="page__head"><h1 className="page__title">Belajar dari nol</h1></div>
      <p className="page__sub">Sembilan pelajaran pendek, satu konsep per pelajaran, kira-kira {total} menit semuanya. Setiap pelajaran
        dibagi menjadi langkah kecil dengan kotak <b>Perhatikan</b>, lalu ditutup dengan beberapa soal untuk mengecek pemahaman.
        Semua contoh memakai proyek fiktif <b>Kedai kopi digital</b> (12 tugas, 4 pengembang) yang dijalankan dengan kode penelitian
        yang sama, jadi setiap angka di pelajaran adalah angka sungguhan.</p>
      <Link to={`/belajar/${next.id}`} className="btn btn--primary" style={{ marginBottom: 18 }}>
        <PlayCircle size={16} />{states.some((s) => s.done || s.step > 0) ? "Lanjutkan belajar" : "Mulai dari pelajaran 1"}</Link>
      <ol className="lessons">
        {LESSONS.map((l, i) => {
          const s = states[i];
          const correct = l.quiz.filter((q) => s.answers[q.id] === 0).length;
          return (
            <li key={l.id}>
              <Link to={`/belajar/${l.id}`} className={`lesson-card ${s.done ? "done" : ""}`}>
                <span className="lesson-card__n">{i + 1}</span>
                <span className="lesson-card__text">
                  <strong>{l.title}</strong>
                  <span className="muted small">{l.goal}</span>
                </span>
                <span className="lesson-card__state small">
                  {s.done ? <><CheckCircle2 size={16} color="var(--success)" />{correct}/{l.quiz.length} soal benar</>
                    : <><Circle size={16} color="var(--line-strong)" />{l.steps.length} langkah · {l.minutes} menit</>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="muted small" style={{ marginTop: 16 }}>Sesudah selesai, coba sendiri di halaman <Link to={KOPI_RUN}>Simulasi</Link> dengan
        proyek yang sama, lalu buka tab Log hitung untuk melihat setiap angka secara lengkap.</p>
    </div>
  );
}
