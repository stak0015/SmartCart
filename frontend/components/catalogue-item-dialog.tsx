"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Item } from "@/lib/api";
import { formatRm } from "@/lib/format-rm";
import { UIIcon } from "./ui-icon";

export function cataloguePrice(item: Item, locale: "en" | "ms") {
  const range = item.price_range;
  if (!range) return locale === "en" ? "Price unavailable" : "Harga tidak tersedia";
  return range.min_rm === range.max_rm ? formatRm(range.min_rm) : `${formatRm(range.min_rm)} – ${formatRm(range.max_rm)}`;
}

export function CatalogueItemDialog({ open, title, details, quantity, onClose, onAdd, canAdd, locale }: {
  open: boolean; title: string; details: ReactNode; quantity: ReactNode;
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
      {details}
      <div className="catalogue-dialog-quantity"><h3>{locale === "en" ? "Quantity" : "Kuantiti"}</h3>{quantity}</div>
    </div>
    <footer><button type="button" className="primary-button" disabled={!canAdd} onClick={onAdd}><UIIcon name="basket"/>{locale === "en" ? "Add to basket" : "Tambah ke bakul"}</button></footer>
  </dialog>;
}
