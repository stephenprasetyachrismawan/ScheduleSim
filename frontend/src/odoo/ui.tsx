// Building blocks in the manner of Odoo: one record per screen, a breadcrumb to climb back
// up, a pager for the records of the same level, a status bar for stages, smart buttons that
// open related records, and tabs (a notebook) for the parts of a record.
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface Crumb { label: ReactNode; to?: string }

/** The bar on top of every record: breadcrumb on the left, pager and actions on the right. */
export function ControlBar({ crumbs, right, children }: { crumbs: Crumb[]; right?: ReactNode;
                                                          children?: ReactNode }) {
  return (
    <div className="o-bar">
      <div className="o-bar__row">
        <nav className="o-crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={i} className={`o-crumb ${last ? "o-crumb--last" : ""}`}>
                {c.to && !last ? <Link to={c.to}>{c.label}</Link> : <span aria-current={last ? "page" : undefined}>{c.label}</span>}
                {!last && <span className="o-crumb__sep">/</span>}
              </span>
            );
          })}
        </nav>
        {right && <div className="o-bar__right">{right}</div>}
      </div>
      {children && <div className="o-bar__row o-bar__row--actions">{children}</div>}
    </div>
  );
}

/** "3 / 16 ‹ ›": moves between the records of one level only. */
export function Pager({ index, total, prev, next, label }: { index: number; total: number;
                                                           prev?: string | null; next?: string | null;
                                                           label: string }) {
  return (
    <div className="o-pager" role="group" aria-label={`Pager ${label}`}>
      <span className="o-pager__value" aria-live="polite"><b>{index + 1}</b> / {total}</span>
      {prev ? <Link className="o-pager__btn" to={prev} aria-label={`${label} sebelumnya`}><ChevronLeft size={16} /></Link>
            : <span className="o-pager__btn is-off" aria-disabled="true" aria-label={`${label} sebelumnya`}><ChevronLeft size={16} /></span>}
      {next ? <Link className="o-pager__btn" to={next} aria-label={`${label} berikutnya`}><ChevronRight size={16} /></Link>
            : <span className="o-pager__btn is-off" aria-disabled="true" aria-label={`${label} berikutnya`}><ChevronRight size={16} /></span>}
    </div>
  );
}

/** Stages of a record, current one filled; earlier stages stay clickable. */
export function Statusbar({ steps, current, hrefOf, label }: {
  steps: { id: string; label: ReactNode }[]; current: string; hrefOf: (id: string) => string; label: string;
}) {
  return (
    <nav className="o-status" aria-label={label}>
      {steps.map((s) => (
        <Link key={s.id} to={hrefOf(s.id)} replace className={`o-status__step ${s.id === current ? "on" : ""}`}
              aria-current={s.id === current ? "step" : undefined}>{s.label}</Link>
      ))}
    </nav>
  );
}

export function SmartButtons({ children }: { children: ReactNode }) {
  return <div className="o-smart">{children}</div>;
}

/** A number with a label that opens the related records. */
export function SmartButton({ icon: Icon, value, label, to, onClick, title }: {
  icon: LucideIcon; value: ReactNode; label: string; to?: string; onClick?: () => void; title?: string;
}) {
  const body = (<><Icon size={18} className="o-smart__icon" /><span className="o-smart__text">
    <span className="o-smart__value">{value}</span><span className="o-smart__label">{label}</span></span></>);
  if (to) return <Link className="o-smart__btn" to={to} title={title}>{body}</Link>;
  return <button type="button" className="o-smart__btn" onClick={onClick} title={title}>{body}</button>;
}

/** The white sheet of a record. */
export function Sheet({ title, subtitle, badge, children, smart }: {
  title: ReactNode; subtitle?: ReactNode; badge?: ReactNode; children?: ReactNode; smart?: ReactNode;
}) {
  return (
    <section className="o-sheet">
      {smart}
      <div className="o-sheet__head">
        <h1 className="o-sheet__title">{title}</h1>
        {badge}
      </div>
      {subtitle && <p className="o-sheet__sub">{subtitle}</p>}
      {children}
    </section>
  );
}

export function Fields({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return <div className={`o-fields o-fields--${cols}`}>{children}</div>;
}

export function Field({ label, children, hint, wide }: { label: ReactNode; children: ReactNode; hint?: ReactNode;
                                                        wide?: boolean }) {
  return (
    <div className={`o-field ${wide ? "o-field--wide" : ""}`}>
      <div className="o-field__label">{label}</div>
      <div className="o-field__value">{children}{hint && <div className="o-field__hint">{hint}</div>}</div>
    </div>
  );
}

export interface Tab { id: string; label: ReactNode; count?: number }

/** Tabs of a record; the open tab is kept in the URL by the page. */
export function Notebook({ tabs, current, hrefOf, children }: {
  tabs: Tab[]; current: string; hrefOf: (id: string) => string; children: ReactNode;
}) {
  return (
    <div className="o-notebook">
      <div className="o-notebook__tabs" role="tablist">
        {tabs.map((t) => (
          <Link key={t.id} role="tab" replace to={hrefOf(t.id)} aria-selected={t.id === current}
                className={`o-notebook__tab ${t.id === current ? "on" : ""}`} data-tour={`tab-${t.id}`}>
            {t.label}{t.count !== undefined && <span className="o-notebook__count">{t.count}</span>}
          </Link>
        ))}
      </div>
      <div className="o-notebook__page" role="tabpanel">{children}</div>
    </div>
  );
}

export interface Column<T> {
  label: ReactNode;
  cell: (row: T) => ReactNode;
  num?: boolean;
  title?: string;
}

/** A list of records; a click on a row opens it. The footer row carries totals, like Odoo. */
export function ListTable<T>({ columns, rows, rowKey, onRow, footer, empty, selected, caption }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number;
  onRow?: (row: T) => void; footer?: ReactNode[]; empty?: ReactNode; selected?: (row: T) => boolean;
  caption?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <Empty>{empty}</Empty>;
  return (
    <div className="o-list">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead><tr>{columns.map((c, i) => <th key={i} className={c.num ? "num" : ""} title={c.title}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className={`${onRow ? "o-list__link" : ""} ${selected?.(r) ? "is-on" : ""}`}
                onClick={onRow ? () => onRow(r) : undefined}
                onKeyDown={onRow ? (e) => { if (e.key === "Enter") onRow(r); } : undefined}
                tabIndex={onRow ? 0 : undefined}>
              {columns.map((c, i) => <td key={i} className={c.num ? "num" : ""}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot><tr>{footer.map((f, i) => <td key={i} className={columns[i]?.num ? "num" : ""}>{f}</td>)}</tr></tfoot>
        )}
      </table>
    </div>
  );
}

/** An empty place always says why it is empty and what to do next. */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="o-empty">{children}</div>;
}
