// Learning mode: off by default, remembered per browser. When it is on, ⓘ marks next to
// terms and numbers open a short explanation, and pages can start a guided tour.
import { Info as InfoIcon, X } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type ReactNode,
} from "react";
import { GLOSSARY } from "./glossary";

const KEY = "schedulesim:mode-belajar";

interface LearnState {
  on: boolean;
  setOn: (on: boolean) => void;
  tour: string | null;
  startTour: (name: string) => void;
  endTour: () => void;
}

const Ctx = createContext<LearnState>({ on: false, setOn: () => {}, tour: null,
                                        startTour: () => {}, endTour: () => {} });

function read(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function LearnProvider({ children }: { children: ReactNode }) {
  const [on, setOnState] = useState(read);
  const [tour, setTour] = useState<string | null>(null);
  const setOn = useCallback((v: boolean) => {
    setOnState(v);
    if (!v) setTour(null);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* private window */ }
  }, []);
  return (
    <Ctx.Provider value={{ on, setOn, tour, startTour: setTour, endTour: () => setTour(null) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLearn = () => useContext(Ctx);

/** ⓘ next to a term; renders nothing while learning mode is off. */
export function Info({ term, children }: { term: keyof typeof GLOSSARY | string;
                                           children?: ReactNode }) {
  const { on } = useLearn();
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape"
        : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close);
                   document.removeEventListener("keydown", close); };
  }, [open]);
  if (!on) return null;
  const t = GLOSSARY[term];
  if (!t && !children) return null;
  return (
    <span className="info" ref={box}>
      <button type="button" className="info__btn" aria-label={`Penjelasan: ${t?.term ?? term}`}
              aria-expanded={open} aria-describedby={open ? id : undefined}
              onClick={(e) => {
                e.stopPropagation();
                const r = box.current?.getBoundingClientRect();
                setFlip(!!r && r.left + 320 > window.innerWidth);
                setOpen((o) => !o);
              }}>
        <InfoIcon size={13} strokeWidth={2.4} />
      </button>
      {open && (
        <span className={`info__pop ${flip ? "info__pop--left" : ""}`} role="tooltip" id={id}>
          {t && <strong>{t.term}{t.en && t.en.toLowerCase() !== t.term.toLowerCase()
            ? <em className="info__en"> ({t.en})</em> : null}</strong>}
          {t && <span className="info__body">{t.body}</span>}
          {t?.formula && <span className="info__formula">{t.formula}</span>}
          {children && <span className="info__body">{children}</span>}
          {t?.ref && <span className="info__ref">Naskah: {t.ref}</span>}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------------ tour
export interface TourStep {
  target: string;             // value of data-tour on the element to point at
  title: string;
  body: string;
}

/** Guided tour over elements marked with ``data-tour``; shown only while ``tour`` is active. */
export function Tour({ name, steps }: { name: string; steps: TourStep[] }) {
  const { tour, endTour } = useLearn();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const active = tour === name;
  const step = steps[Math.min(i, steps.length - 1)];

  useEffect(() => { if (active) setI(0); }, [active]);
  useLayoutEffect(() => {
    if (!active) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update);
                   window.removeEventListener("scroll", update, true); };
  }, [active, step]);
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
      if (e.key === "ArrowRight") setI((x) => Math.min(steps.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [active, endTour, steps.length]);

  if (!active) return null;
  const pad = 6;
  const card: React.CSSProperties = rect
    ? { top: Math.min(window.innerHeight - 220, rect.bottom + 12),
        left: Math.max(12, Math.min(window.innerWidth - 372, rect.left)) }
    : { top: "30%", left: "50%", transform: "translateX(-50%)" };
  return (
    <div className="tour" role="dialog" aria-modal="false" aria-label={`Tur: ${step.title}`}>
      {rect && <div className="tour__ring" style={{ top: rect.top - pad, left: rect.left - pad,
                                                   width: rect.width + 2 * pad,
                                                   height: rect.height + 2 * pad }} />}
      <div className="tour__card" style={card}>
        <div className="tour__head">
          <span className="tour__count">{i + 1} / {steps.length}</span>
          <button className="btn btn--ghost btn--sm" onClick={endTour} aria-label="Tutup tur">
            <X size={15} /></button>
        </div>
        <strong className="tour__title">{step.title}</strong>
        <p className="tour__body">{step.body}</p>
        {!rect && <p className="tour__body muted small">Bagian ini belum tampil. Jalankan simulasi dulu, lalu lanjutkan tur.</p>}
        <div className="tour__nav">
          <button className="btn btn--ghost btn--sm" onClick={endTour}>Lewati tur</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn--sm" disabled={i === 0} onClick={() => setI(i - 1)}>Kembali</button>
          {i < steps.length - 1
            ? <button className="btn btn--primary btn--sm" onClick={() => setI(i + 1)}>Lanjut</button>
            : <button className="btn btn--primary btn--sm" onClick={endTour}>Selesai</button>}
        </div>
      </div>
    </div>
  );
}
