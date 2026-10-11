"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { UIIcon } from "./ui-icon";

export { cataloguePrice } from "../lib/catalogue-price";

export function CatalogueItemDialog({ open, title, details, quantity, back, nutrition, alternatives, trends, onClose, onAdd, canAdd, locale }: {
  open: boolean; title: string; details: ReactNode | ((priceTrendsButton: ReactNode) => ReactNode); quantity: ReactNode;
  // Epic 7 (US 7.2): "Back to [previous item]" control, shown only when the
  // shopper has walked into an alternative.
  back?: ReactNode;
  // Epic 7 (AC 7.1.1): rendered below the item details, inside the dialog.
  alternatives?: ReactNode | ((onOpenInsights: (panel: ReactNode) => void) => ReactNode);
  // Item nutrition is an independent detail section; it may be available even
  // when there are no healthier-alternative recommendations.
  nutrition?: ReactNode;
  onClose: () => void; onAdd: () => void; canAdd: boolean; locale: "en" | "ms";
  trends?: (onClose: () => void) => ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [insights, setInsights] = useState<ReactNode>(null);
  const insightTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (insights) dialogRef.current?.querySelector<HTMLElement>('#catalogue-insights-title')?.focus({ preventScroll: true });
  }, [insights]);
  useEffect(() => {
    if ((!trendsOpen && !insights) || !window.matchMedia('(max-width: 899px)').matches) return;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector(insights ? '#catalogue-alternative-insights' : '#catalogue-price-trends')?.scrollIntoView({block: 'start', behavior: 'smooth'}));
    return () => cancelAnimationFrame(frame);
  }, [trendsOpen, insights]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return <dialog ref={dialogRef} className={`catalogue-item-dialog${trendsOpen || insights ? ' catalogue-item-dialog-with-trends' : ''}`} aria-labelledby="catalogue-item-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    } }}>
    <div className="catalogue-dialog-layout"><div className="catalogue-item-card"><div className="catalogue-dialog-content">
      <header><h2 id="catalogue-item-title">{title}</h2><button autoFocus type="button" className="icon-button" onClick={onClose} aria-label={locale === "en" ? "Close item details" : "Tutup butiran item"}><UIIcon name="close"/></button></header>
      {back}
      {typeof details === 'function' ? details(trends && <button type="button" className="price-trends-trigger" aria-label={locale === 'en' ? (trendsOpen ? 'Hide price trends' : 'See price trends') : (trendsOpen ? 'Sembunyikan trend harga' : 'Lihat trend harga')} title={locale === 'en' ? 'Price trends' : 'Trend harga'} aria-expanded={trendsOpen} aria-controls="catalogue-price-trends" onClick={() => { setInsights(null); setTrendsOpen(value => !value); }}><UIIcon name="priceTrends" size={20}/></button>) : details}
      {typeof alternatives === 'function' ? alternatives(panel => { insightTrigger.current = document.activeElement as HTMLElement; setTrendsOpen(false); setInsights(panel); }) : alternatives}
      {nutrition && <details className="catalogue-nutrition-disclosure"><summary>{locale === 'en' ? 'Nutrition information' : 'Maklumat pemakanan'}<UIIcon name="chevronDown" size={18}/></summary>{nutrition}</details>}
      <div className="catalogue-dialog-quantity"><h3>{locale === "en" ? "Quantity" : "Kuantiti"}</h3>{quantity}</div>
    </div>
    <footer><button type="button" className="primary-button" disabled={!canAdd} onClick={onAdd}><UIIcon name="basket"/>{locale === "en" ? "Add to basket" : "Tambah ke bakul"}</button></footer>
    </div>{trendsOpen && trends && <div id="catalogue-price-trends" className="catalogue-trends-card">{trends(() => { setTrendsOpen(false); dialogRef.current?.querySelector<HTMLButtonElement>('.price-trends-trigger')?.focus(); })}</div>}
    {insights && <aside id="catalogue-alternative-insights" className="catalogue-trends-card" aria-labelledby="catalogue-insights-title"><header className="catalogue-insights-header"><h3 id="catalogue-insights-title" tabIndex={-1}>{locale === 'en' ? 'Why this alternative?' : 'Mengapa alternatif ini?'}</h3><button type="button" className="icon-button" aria-label={locale === 'en' ? 'Close insights' : 'Tutup pandangan'} onClick={() => { setInsights(null); insightTrigger.current?.focus(); }}><UIIcon name="close"/></button></header>{insights}</aside>}</div>
  </dialog>;
}
