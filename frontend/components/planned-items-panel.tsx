"use client";
// Owner: Shun
import { useEffect, useRef, useState } from "react";
import type { NextTripItem } from "@/lib/next-trip";
import type { AppCopy, Locale } from "@/lib/i18n";
import { displayItemName } from "@/lib/item-name";
import { NextTripList } from "./shopping-checklist";
import type { ItemDetailsRequest } from "./item-details-dialog";
import { UIIcon } from "./ui-icon";

/**
 * US 4.8: Planned items while building a basket. A "Planned items" button on
 * the Shop and "Review your basket" screens opens a side panel, so the shopper
 * can add planned items without leaving the screen; the basket only changes
 * when they press "Add to basket".
 */
export function PlannedItemsPanel({ items, copy, locale, onAddToBasket, onRemove, onSchedule, onOpenItem }: {
  items: NextTripItem[]; copy: AppCopy; locale: Locale;
  onAddToBasket: (item: NextTripItem) => void;
  onRemove: (id: string) => void;
  onSchedule: (item: NextTripItem) => void;
  onOpenItem: (request: ItemDetailsRequest) => void;
}) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const label = locale === "en" ? "Planned items" : "Item dirancang";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) setAdded("");
  }, [open]);

  const add = (item: NextTripItem) => {
    onAddToBasket(item);
    const name = displayItemName((locale === "ms" ? item.itemNameMs : item.itemNameEn) || item.itemName, locale);
    setAdded(locale === "en" ? `${name} added to your basket.` : `${name} ditambah ke bakul anda.`);
  };

  return <>
    {/* AC 4.8.1: the button shows how many items are planned. */}
    <button type="button" className="planned-items-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <UIIcon name="bookmark" size={18}/>{label}<span>{items.length}</span>
    </button>
    <dialog ref={dialogRef} className="planned-items-drawer" aria-label={label}
      onCancel={event => { event.preventDefault(); setOpen(false); }}
      onClose={() => setOpen(false)}
      onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="planned-items-drawer-body">
        <header><h2>{label}</h2><button type="button" className="icon-button" aria-label={copy.close} onClick={() => setOpen(false)}><UIIcon name="close"/></button></header>
        <p className="planned-items-drawer-hint">{items.length
          ? (locale === "en" ? "Add planned items to your basket. They stay in Planned items until you save a plan." : "Tambah item dirancang ke bakul anda. Item kekal dalam Item dirancang sehingga anda menyimpan pelan.")
          : copy.nextTripEmpty}</p>
        {added && <p role="status" className="planned-items-drawer-added">{added}</p>}
        {/* AC 4.8.2: each planned item with its quantity and week. */}
        {items.length > 0 && <NextTripList title={label} items={items} locale={locale} copy={copy} onRemove={onRemove} onSchedule={onSchedule} onOpenItem={onOpenItem} onAddToBasket={add} showHint={false}/>}
      </div>
    </dialog>
  </>;
}
