import { useMemo, useState } from "react";
import { GLOSSARY, TERM_ORDER } from "../learn/glossary";

export default function GlossaryPage() {
  const [q, setQ] = useState("");
  const terms = useMemo(() => {
    const s = q.trim().toLowerCase();
    return TERM_ORDER.map((id) => [id, GLOSSARY[id]] as const).filter(([, t]) => !s
      || `${t.term} ${t.en ?? ""} ${t.body}`.toLowerCase().includes(s));
  }, [q]);
  return (
    <div className="page">
      <div className="crumbs">Tesis</div>
      <div className="page__head"><h1 className="page__title">Istilah</h1></div>
      <p className="page__sub">Istilah yang dipakai ScheduleSim, sama dengan Daftar Istilah naskah. Istilah teknis tetap
        dalam bahasa Inggris supaya rujukannya mudah dicari. Penjelasan yang sama muncul sebagai ⓘ bila Mode belajar
        dinyalakan.</p>
      <input className="input" style={{ maxWidth: 360, marginBottom: 14 }} placeholder="Cari istilah, misalnya guard"
             value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari istilah" />
      <dl className="glossary">
        {terms.map(([id, t]) => (
          <div key={id} className="glossary__item" id={id}>
            <dt>{t.term}{t.en && t.en.toLowerCase() !== t.term.toLowerCase() && <em className="info__en"> ({t.en})</em>}</dt>
            <dd>
              {t.body}
              {t.formula && <div className="info__formula">{t.formula}</div>}
              {t.ref && <div className="info__ref">Naskah: {t.ref}</div>}
            </dd>
          </div>
        ))}
        {terms.length === 0 && <p className="muted">Tidak ada istilah yang cocok.</p>}
      </dl>
    </div>
  );
}
