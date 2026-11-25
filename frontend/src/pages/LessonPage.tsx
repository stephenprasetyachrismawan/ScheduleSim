// One lesson: small steps with a picture and a "Perhatikan" box, then a short quiz.
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/atoms";
import MiniGantt from "../components/MiniGantt";
import { KOPI_RUN, useLessonData } from "../learn/lessonData";
import { LESSONS, makeCtx, type Ctx, type Question, type Visual } from "../learn/lessons";
import { getProgress, order, saveProgress, type LessonProgress } from "../learn/progress";

function GanttVisual({ v, c }: { v: Extract<Visual, { kind: "gantt" }>; c: Ctx }) {
  const frame = useQuery({ queryKey: ["frame", c.d.runId, v.method, v.k, v.phase],
                           queryFn: () => api.frame(c.d.runId, v.method, v.k, v.phase), staleTime: Infinity });
  if (!frame.data) return <div className="lesson-visual lesson-visual--wait"><Spinner /></div>;
  return (
    <MiniGantt frame={frame.data} highlight={v.highlight?.(c)} notes={v.notes?.(c)} showGhost={v.ghost !== false}
               caption={v.caption} />
  );
}

function QuestionCard({ q, c, n, chosen, onChoose }: { q: Question; c: Ctx; n: number; chosen: number | undefined;
                                                     onChoose: (i: number) => void }) {
  const opts = q.options(c);
  const shown = order(q.id, opts.length);
  const answered = chosen !== undefined;
  const [reveal, setReveal] = useState(false);
  const solved = chosen === 0 || reveal;
  return (
    <div className={`qcard ${answered ? (chosen === 0 ? "qcard--ok" : "qcard--no") : ""}`}>
      <div className="qcard__q"><span className="qcard__n">Soal {n}</span>{q.q(c)}</div>
      <div className="qcard__opts" role="radiogroup">
        {shown.map((i) => (
          <button key={i} role="radio" aria-checked={chosen === i}
                  className={`qopt ${solved && i === 0 ? "qopt--right" : ""} ${answered && chosen === i && i !== 0 ? "qopt--wrong" : ""}`}
                  onClick={() => onChoose(i)}>
            {opts[i]}
          </button>
        ))}
      </div>
      {answered && chosen === 0 && (
        <div className="qcard__why ok"><CheckCircle2 size={16} /><span><b>Benar.</b> {q.why(c)}</span></div>
      )}
      {answered && chosen !== 0 && !reveal && (
        <div className="qcard__why no"><XCircle size={16} />
          <span><b>Belum tepat.</b> Coba pilih jawaban lain, atau{" "}
            <button className="linkbtn" onClick={() => setReveal(true)}>lihat jawaban dan penjelasannya</button>.</span></div>
      )}
      {answered && chosen !== 0 && reveal && (
        <div className="qcard__why reveal"><CheckCircle2 size={16} /><span><b>Jawabannya yang hijau.</b> {q.why(c)}</span></div>
      )}
    </div>
  );
}

export default function LessonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const idx = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[idx];
  const { data, error, loading } = useLessonData();
  const c = useMemo(() => (data ? makeCtx(data) : null), [data]);
  const [p, setP] = useState<LessonProgress>(() => getProgress(id ?? ""));
  useEffect(() => { setP(getProgress(id ?? "")); }, [id]);
  const total = lesson ? lesson.steps.length + 1 : 0;          // the last "step" is the quiz
  const step = Math.min(p.step, total - 1);
  const update = (next: Partial<LessonProgress>) => {
    const np = { ...p, ...next };
    setP(np);
    saveProgress(lesson.id, np);
  };
  const go = (s: number) => update({ step: Math.max(0, Math.min(total - 1, s)) });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  if (!lesson) return <div className="page"><p>Pelajaran tidak ditemukan. <Link to="/belajar">Kembali ke daftar</Link></p></div>;
  const inQuiz = step === lesson.steps.length;
  const s = lesson.steps[Math.min(step, lesson.steps.length - 1)];
  const allRight = lesson.quiz.every((q) => p.answers[q.id] === 0);
  const nextLesson = LESSONS[idx + 1];

  return (
    <div className="page lesson">
      <div className="crumbs"><Link to="/belajar">Belajar</Link> / Pelajaran {idx + 1} dari {LESSONS.length}</div>
      <div className="page__head"><h1 className="page__title">{lesson.title}</h1></div>
      <p className="page__sub">{lesson.goal}</p>
      <div className="lesson__dots" aria-label="Langkah">
        {Array.from({ length: total }, (_, i) => (
          <button key={i} className={`dot ${i === step ? "on" : ""} ${i < step ? "past" : ""}`} onClick={() => go(i)}
                  aria-label={i === lesson.steps.length ? "Soal" : `Langkah ${i + 1}`} aria-current={i === step}>
            {i === lesson.steps.length ? "?" : i + 1}</button>
        ))}
      </div>

      {loading && <div className="notice"><Spinner />Menyiapkan contoh (proyek Kedai kopi dijalankan dengan kode penelitian)…</div>}
      {error && <div className="notice notice--warn">{error.message}</div>}

      {c && !inQuiz && (
        <div className={`lesson__body ${s.visual ? "" : "lesson__body--text"}`}>
          <div className="lesson__text">
            <div className="lesson__count">Langkah {step + 1} dari {lesson.steps.length}</div>
            <h2 className="lesson__title">{s.title}</h2>
            <div className="lesson__prose">{s.body(c)}</div>
            {s.look && (
              <div className="lesson__look"><Eye size={16} /><div><b>Perhatikan.</b> {s.look(c)}</div></div>
            )}
          </div>
          {s.visual && (
            <div className="lesson__visual">
              {s.visual.kind === "gantt" ? <GanttVisual v={s.visual} c={c} /> : s.visual.render(c)}
            </div>
          )}
        </div>
      )}

      {c && inQuiz && (
        <div className="lesson__quiz">
          <h2 className="lesson__title">Cek pemahaman</h2>
          <p className="muted">Pilih satu jawaban. Penjelasannya langsung muncul, dan Anda boleh mencoba lagi.</p>
          {lesson.quiz.map((q, i) => (
            <QuestionCard key={q.id} q={q} c={c} n={i + 1} chosen={p.answers[q.id]}
                          onChoose={(choice) => update({ answers: { ...p.answers, [q.id]: choice },
                                                         done: lesson.quiz.every((x) => (x.id === q.id ? choice : p.answers[x.id]) === 0) })} />
          ))}
          {allRight && <div className="notice lesson__done"><CheckCircle2 size={16} />Semua soal benar. Pelajaran ini selesai.</div>}
        </div>
      )}

      <div className="lesson__nav">
        <button className="btn" onClick={() => go(step - 1)} disabled={step === 0}><ArrowLeft size={15} />Kembali</button>
        <span className="muted small">tombol panah ← → juga bisa</span>
        {!inQuiz ? (
          <button className="btn btn--primary" onClick={() => go(step + 1)}>
            {step === lesson.steps.length - 1 ? "Ke soal" : "Lanjut"}<ArrowRight size={15} /></button>
        ) : nextLesson ? (
          <button className="btn btn--primary" onClick={() => navigate(`/belajar/${nextLesson.id}`)}>
            Pelajaran berikutnya: {nextLesson.title}<ArrowRight size={15} /></button>
        ) : (
          <Link className="btn btn--primary" to={KOPI_RUN}>Coba sendiri di Simulasi<ArrowRight size={15} /></Link>
        )}
      </div>
    </div>
  );
}
