// "Asal angka": a side sheet that shows where one number comes from: its formula, the numbers
// that go into it (each one can be opened further), the rows it adds up, and the code that
// computed it. Every number shown here is read from the API; nothing is computed again.
import { ArrowUpRight, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export interface SourceNode {
  title: string;          // "E (rata-rata upaya)"
  value?: string;         // "3,6909"
  render: () => ReactNode;
}

interface SourceState {
  open: (n: SourceNode) => void;
  push: (n: SourceNode) => void;
}

const Ctx = createContext<SourceState>({ open: () => {}, push: () => {} });
export const useSource = () => useContext(Ctx);

export function SourceProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<SourceNode[]>([]);
  const location = useLocation();
  const close = useCallback(() => setStack([]), []);
  useEffect(() => { setStack([]); }, [location.pathname]);
  useEffect(() => {
    if (!stack.length) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [stack.length, close]);
  const top = stack[stack.length - 1];
  return (
    <Ctx.Provider value={{ open: (n) => setStack([n]), push: (n) => setStack((s) => [...s, n]) }}>
      {children}
      {top && (
        <>
          <div className="o-drawer__shade" onClick={close} />
          <aside className="o-drawer" role="dialog" aria-label={`Asal angka: ${top.title}`}>
            <div className="o-drawer__head">
              <nav className="o-crumbs o-crumbs--small" aria-label="Jejak asal angka">
                <span className="o-crumb"><span className="o-drawer__kicker">Asal angka</span><span className="o-crumb__sep">/</span></span>
                {stack.map((n, i) => (
                  <span key={i} className={`o-crumb ${i === stack.length - 1 ? "o-crumb--last" : ""}`}>
                    {i < stack.length - 1
                      ? <button className="linkbtn" onClick={() => setStack((s) => s.slice(0, i + 1))}>{n.title}</button>
                      : <span>{n.title}</span>}
                    {i < stack.length - 1 && <span className="o-crumb__sep">/</span>}
                  </span>
                ))}
              </nav>
              <button className="btn btn--ghost btn--sm" onClick={close} aria-label="Tutup"><X size={16} /></button>
            </div>
            {top.value && <div className="o-drawer__value"><span>{top.title}</span><b className="mono">{top.value}</b></div>}
            <div className="o-drawer__body">{top.render()}</div>
          </aside>
        </>
      )}
    </Ctx.Provider>
  );
}

/** The small ↗ next to a number; opens (or, inside the sheet, goes deeper into) its source. */
export function Src({ node, deeper }: { node: () => SourceNode | null; deeper?: boolean }) {
  const s = useSource();
  return (
    <button type="button" className="o-src" title="Lihat asal angka ini"
            aria-label={`Asal angka: ${node()?.title ?? ""}`}
            onClick={(e) => { e.stopPropagation(); const n = node(); if (n) (deeper ? s.push : s.open)(n); }}>
      <ArrowUpRight size={13} />
    </button>
  );
}

/** A number followed by its ↗. */
export function NumSrc({ children, node, deeper }: { children: ReactNode; node: () => SourceNode | null;
                                                     deeper?: boolean }) {
  return <span className="o-numsrc"><span className="mono">{children}</span><Src node={node} deeper={deeper} /></span>;
}

/** Formula, then the numbers put in, then the result. */
export function Formula({ rumus, isi, hasil }: { rumus: ReactNode; isi?: ReactNode; hasil: ReactNode }) {
  return (
    <div className="o-formula">
      <div className="o-formula__row"><span>rumus</span><code>{rumus}</code></div>
      {isi && <div className="o-formula__row"><span>angka</span><code>{isi}</code></div>}
      <div className="o-formula__row o-formula__row--res"><span>hasil</span><code>{hasil}</code></div>
    </div>
  );
}

export function CodeRef({ file, fn, note }: { file: string; fn: string; note?: string }) {
  const url = `https://github.com/stephenprasetyachrismawan/arls-ppo/blob/v1.1.0/${file}`;
  return (
    <div className="o-coderef">
      Dihitung oleh <a href={url} target="_blank" rel="noreferrer" className="mono">{file.split("/").pop()}</a>
      {" "}fungsi <span className="mono">{fn}</span>{note ? `, ${note}` : ""}.
    </div>
  );
}
