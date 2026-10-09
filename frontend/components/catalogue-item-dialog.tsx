"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { UIIcon } from "./ui-icon";

export { cataloguePrice } from "../lib/catalogue-price";

export function CatalogueItemDialog({ open, title, details, quantity, back, alternatives, onClose, onAdd, canAdd, locale }: {
  open: boolean; title: string; details: ReactNode; quantity: ReactNode;
  // Epic 7 (US 7.2): "Back to [previous item]" control, shown only when the
  // shopper has walked into an alternative.
  back?: ReactNode;
  // Epic 7 (AC 7.1.1): rendered below the item details, inside the dialog.
  alternatives?: ReactNode;
  onClose: () => void; onAdd: () => void; canAdd: boolean; locale: "en" | "ms";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  return <dialog ref={dialogRef} className="catalogue-item-dialog" aria-labelledby="catalogue-item-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    } }}>
    <div className="catalogue-dialog-content">
      <header><h2 id="catalogue-item-title">{title}</h2><button autoFocus type="button" className="icon-button" onClick={onClose} aria-label={locale === "en" ? "Close item details" : "Tutup butiran item"}><UIIcon name="close"/></button></header>
      {back}
      {details}
      {alternatives}
      <div className="catalogue-dialog-quantity"><h3>{locale === "en" ? "Quantity" : "Kuantiti"}</h3>{quantity}</div>
    </div>
    <footer><button type="button" className="primary-button" disabled={!canAdd} onClick={onAdd}><UIIcon name="basket"/>{locale === "en" ? "Add to basket" : "Tambah ke bakul"}</button></footer>
  </dialog>;
}
