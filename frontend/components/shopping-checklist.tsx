"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { formatRm } from "@/lib/format-rm";
import { CatalogueItemImage } from "./catalogue-item-image";
import { StoreChainLogo } from "./store-chain-logo";
import { DropdownChevron, UIIcon } from "./ui-icon";
import {
  buildChecklistExportModel,
  type ChecklistExportModel,
} from "@/lib/checklist-export";
import {
  effectiveChecklistLineTotal,
  effectiveChecklistQuantity,
  effectiveChecklistUnitPrice,
  checklistProgress,
  validateManualChecklistItem,
  type ChecklistItem,
  type ChecklistStatus,
  type ManualChecklistItemInput,
  type ShoppingChecklist,
} from "@/lib/shopping-checklist";

import { nextTripItemId, type NextTripItem } from "@/lib/next-trip";

export interface ShoppingChecklistCopy {
  nextTrip: string;
  nextTripChecklistTitle: string;
  nextTripHint: string;
  nextTripEmpty: string;
  saveForNextTrip: string;
  savedForNextTrip: string;
  removeFromNextTrip: string;
  useSavedItems: string;
  addToChecklist: string;
  revertItem: string;
  checklistHint: string;
  checklistTotal: string;
  checklistEstimatedTotal: string;
  noActiveChecklist: string;
  noActiveChecklistHint: string;
  startOrResumeShoppingTrip: string;
  checklistTitle: string;
  checklistItems: string;
  checklistStore: (store: string) => string;
  checklistCreated: (date: string) => string;
  checklistProgress: (bought: number, total: number) => string;
  plannedSubtotal: string;
  estimatedPlannedSubtotal: string;
  checklistPriceDisclosure: (count: number) => string;
  checklistQuantity: string;
  checklistUnitPrice: string;
  checklistLineTotal: string;
  checklistPriceUnavailable: string;
  checklistPriceEstimate: string;
  manualItem: string;
  bought: string;
  notBought: string;
  markBought: (name: string) => string;
  markNotBought: (name: string) => string;
  clearItemStatus: (name: string) => string;
  addChecklistItem: string;
  editChecklistItem: string;
  itemName: string;
  itemQuantity: string;
  itemUnitPrice: string;
  itemNameRequired: string;
  itemQuantityError: string;
  itemPriceError: string;
  actualUnitPrice: string;
  actualQuantity: string;
  quantitySourcePlanned: string;
  quantitySourceActual: string;
  shopperRecorded: string;
  saveItem: string;
  cancel: string;
  deleteItem: string;
  deleteItemConfirm: (name: string) => string;
  deleteChecklist: string;
  deleteChecklistConfirm: string;
  checklistEmpty: string;
  recordTrip: string;
  recordTripConfirm: string;
  recordTripAgain: string;
  tripRecorded: string;
  exportChecklist: string;
  exportChecklistIntro: string;
  downloadAsImage: string;
  downloadAsPdf: string;
  exportChecklistEmpty: string;
  exportChecklistFailed: string;
  close: string;
}

export interface ShoppingChecklistScreenProps {
  checklist: ShoppingChecklist;
  locale: "en" | "ms";
  copy: ShoppingChecklistCopy;
  onToggleStatus: (itemId: string, status: Exclude<ChecklistStatus, "neutral">) => void;
  onAddManual: (input: ManualChecklistItemInput) => void;
  onEditItem: (itemId: string, input: ManualChecklistItemInput) => void;
  onRevertItem: (itemId: string) => void;
  savedItems: NextTripItem[];
  onRestoreSavedItem: (item: NextTripItem) => void | Promise<void>;
  onRemoveSavedItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onDeleteChecklist: () => void;
  alreadyRecorded: boolean;
  onRecordTrip: () => void;
}

export interface EmptyChecklistScreenProps {
  locale: "en" | "ms";
  copy: ShoppingChecklistCopy;
  savedItems: NextTripItem[];
  onUseSavedItems: () => void;
  onRemoveSavedItem: (itemId: string) => void;
  onStartOrResume: () => void;
}

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  iconOnly?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ChecklistItemErrors {
  itemName?: string;
  quantity?: string;
  unitPriceRm?: string;
}

interface ChecklistItemDialogProps {
  open: boolean;
  item: ChecklistItem | null;
  locale: "en" | "ms";
  copy: ShoppingChecklistCopy;
  onSave: (input: ManualChecklistItemInput) => void;
  onCancel: () => void;
}

function useNativeDialog(
  open: boolean,
  onCancel: () => void,
  initialFocusRef?: React.RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      dialog.showModal();
      initialFocusRef?.current?.focus();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [initialFocusRef, open]);

  useEffect(() => () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    returnFocusRef.current?.focus();
  }, []);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onCancelRef.current();
  };

  return { dialogRef, handleCancel };
}

export function ConfirmationDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  iconOnly = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, handleCancel } = useNativeDialog(open, onCancel, cancelRef);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={handleCancel}
      className="m-auto w-[calc(100%_-_2rem)] max-w-[28rem] rounded-2xl border border-[#dce5e0] bg-white p-0 text-[#10152e] shadow-2xl backdrop:bg-[#10152e]/55"
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-xl font-extrabold leading-7">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-[#526078]">
          {body}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            aria-label={cancelLabel}
            title={cancelLabel}
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#9eb0a7] bg-white px-4 text-sm font-bold text-[#10152e] hover:bg-[#f1f5f3]"
          >
            {iconOnly ? <ActionIcon name="close" /> : cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            aria-label={confirmLabel}
            title={confirmLabel}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-white ${
              destructive
                ? "bg-[#ba1a1a] hover:bg-[#93000a]"
                : "bg-[#007d38] hover:bg-[#066c4d]"
            }`}
          >
            {iconOnly ? <ActionIcon name={destructive ? "trash" : "check"} /> : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface ExportChecklistDialogProps {
  open: boolean;
  copy: ShoppingChecklistCopy;
  errorMessage: string | null;
  onDownloadImage: () => void;
  onDownloadPdf: () => void;
  onCancel: () => void;
}

// AC 5.7.1: one accessible Export action offering both download formats.
function ExportChecklistDialog({
  open,
  copy,
  errorMessage,
  onDownloadImage,
  onDownloadPdf,
  onCancel,
}: ExportChecklistDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const imageRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, handleCancel } = useNativeDialog(open, onCancel, imageRef);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={handleCancel}
      className="m-auto w-[calc(100%_-_2rem)] max-w-[28rem] rounded-2xl border border-[#dce5e0] bg-white p-0 text-[#10152e] shadow-2xl backdrop:bg-[#10152e]/55"
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-xl font-extrabold leading-7">
          {copy.exportChecklist}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-[#526078]">
          {copy.exportChecklistIntro}
        </p>
        {errorMessage && (
          <p role="alert" className="mt-3 rounded-lg bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#ba1a1a]">
            {errorMessage}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={imageRef}
            type="button"
            aria-label={copy.downloadAsImage}
            title={copy.downloadAsImage}
            onClick={onDownloadImage}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#007d38] px-4 text-sm font-bold text-white hover:bg-[#066c4d]"
          >
            <ActionIcon name="image" />
          </button>
          <button
            type="button"
            aria-label={copy.downloadAsPdf}
            title={copy.downloadAsPdf}
            onClick={onDownloadPdf}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#007d38] px-4 text-sm font-bold text-white hover:bg-[#066c4d]"
          >
            <ActionIcon name="pdf" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            aria-label={copy.cancel}
            title={copy.cancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#9eb0a7] bg-white px-4 text-sm font-bold text-[#10152e] hover:bg-[#f1f5f3]"
          >
            <ActionIcon name="close" />
          </button>
        </div>
      </div>
    </dialog>
  );
}

// AC 5.7.4: the fixed-width export layout. It renders only the export model
// (AC 5.7.3 privacy boundary), wraps long names instead of clipping them,
// and uses the app's hex palette so on-device capture stays faithful. On
// screen it lives off-viewport; in print output it is the only content.
function ChecklistExportSheet({ model }: { model: ChecklistExportModel }) {
  return (
    <div className="w-[800px] bg-white p-8 text-[#10152e]">
      <p className="text-sm font-bold text-[#007d38]">{model.title}</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-8 [overflow-wrap:anywhere]">
        {model.storeName}
      </h1>
      <p className="mt-1 text-xs text-[#526078]">{model.dateText}</p>
      <ul className="mt-4 border-t border-[#dce5e0]">
        {model.rows.map((row, index) => (
          <li key={index} className="border-b border-[#e2e9e5] py-2.5">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5 [overflow-wrap:anywhere]">
                  {row.name}
                </p>
                {row.packageSize && (
                  <p className="mt-0.5 text-xs text-[#718078]">{row.packageSize}</p>
                )}
                {row.shopperAddedLabel && (
                  <p className="mt-0.5 text-xs font-semibold text-[#286d67]">
                    {row.shopperAddedLabel}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right text-xs leading-5 text-[#526078]">
                <p>
                  {row.quantity}
                  {row.quantitySourceLabel ? ` (${row.quantitySourceLabel})` : ""}
                </p>
                <p className="font-semibold text-[#10152e]">
                  {row.referenceUnitPriceText}
                </p>
                {row.actualUnitPriceText && (
                  <p className="text-[#007d38]">{row.actualUnitPriceText}</p>
                )}
                <p>{row.outcomeLabel}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistItemDialog({ open, item, locale, copy, onSave, onCancel }: ChecklistItemDialogProps) {
  const titleId = useId();
  const nameId = useId();
  const quantityId = useId();
  const priceId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const { dialogRef, handleCancel } = useNativeDialog(open, onCancel, nameRef);
  const original = item?.originalValues;
  const originalName = original ? ((locale === "ms" ? original.itemNameMs : original.itemNameEn) || original.itemName) : "";
  const [itemName, setItemName] = useState(item ? localizedItemName(item, locale) : "");
  const [quantity, setQuantity] = useState(item ? String(effectiveChecklistQuantity(item)) : "1");
  const [unitPriceRm, setUnitPriceRm] = useState(item ? effectiveChecklistUnitPrice(item)?.toFixed(2) ?? "" : "");
  const [errors, setErrors] = useState<ChecklistItemErrors>({});
  const originalPrice = original?.unitPriceRm?.toFixed(2) ?? "";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateManualChecklistItem({ itemName, quantity, unitPriceRm });
    if (!validation.success) {
      setErrors({
        itemName: validation.errors.itemName ? copy.itemNameRequired : undefined,
        quantity: validation.errors.quantity ? copy.itemQuantityError : undefined,
        unitPriceRm: validation.errors.unitPriceRm ? copy.itemPriceError : undefined,
      });
      return;
    }
    onSave(validation.value);
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={handleCancel}
      className="checklist-item-dialog m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[32rem] overflow-y-auto rounded-2xl border border-[#dce5e0] bg-white p-0 text-[#10152e] shadow-2xl backdrop:bg-[#10152e]/55">
      <form onSubmit={submit} noValidate className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-extrabold">{item ? copy.editChecklistItem : copy.addChecklistItem}</h2>
          <IconButton label={copy.close} onClick={onCancel}><ActionIcon name="close" /></IconButton>
        </div>
        <div className="dialog-context">{item ? (locale === "en" ? "Edit existing item" : "Edit item sedia ada") : (locale === "en" ? "Add manual item" : "Tambah item manual")}</div>
        {item && <div className="dialog-original"><strong>{localizedItemName(item, locale)}</strong><p>{item.packageSize}</p><span>{locale === "en" ? "Original (planned) price" : "Harga asal (dirancang)"}</span><b>{original?.unitPriceRm == null ? "—" : formatRm(original.unitPriceRm)}</b></div>}
        <div className="dialog-fields mt-5 grid gap-4">
          <div>
            <label htmlFor={nameId} className="text-sm font-bold">{copy.itemName}</label>
            <div className="mt-1.5 flex gap-2">
              <input ref={nameRef} id={nameId} type="text" autoComplete="off" value={itemName}
                aria-invalid={Boolean(errors.itemName)} aria-describedby={errors.itemName ? nameId + "-error" : undefined}
                onChange={event => { setItemName(event.target.value); setErrors(current => ({ ...current, itemName: undefined })); }}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#9eb0a7] px-3 text-base aria-[invalid=true]:border-[#ba1a1a]" />
              {original && <IconButton label={copy.revertItem + ": " + copy.itemName} disabled={itemName === originalName}
                onClick={() => { setItemName(originalName); setErrors(current => ({ ...current, itemName: undefined })); }}><ActionIcon name="revert" /></IconButton>}
            </div>
            {errors.itemName && <p id={nameId + "-error"} role="alert" className="mt-1 text-xs text-[#93000a]">{errors.itemName}</p>}
          </div>
          <div>
            <label htmlFor={quantityId} className="text-sm font-bold">{copy.itemQuantity}</label>
            <div className="mt-1.5 flex gap-2">
              <input id={quantityId} type="number" inputMode="numeric" min={1} step={1} value={quantity}
                aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? quantityId + "-error" : undefined}
                onChange={event => { setQuantity(event.target.value); setErrors(current => ({ ...current, quantity: undefined })); }}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#9eb0a7] px-3 text-base aria-[invalid=true]:border-[#ba1a1a]" />
              {original && <IconButton label={copy.revertItem + ": " + copy.itemQuantity} disabled={quantity === String(original.quantity)}
                onClick={() => { setQuantity(String(original.quantity)); setErrors(current => ({ ...current, quantity: undefined })); }}><ActionIcon name="revert" /></IconButton>}
            </div>
            {errors.quantity && <p id={quantityId + "-error"} role="alert" className="mt-1 text-xs text-[#93000a]">{errors.quantity}</p>}
          </div>
          <div>
            <label htmlFor={priceId} className="text-sm font-bold">{copy.itemUnitPrice}</label>
            <div className="mt-1.5 flex gap-2">
              <input id={priceId} type="number" inputMode="decimal" min="0.01" step="0.01" value={unitPriceRm}
                aria-invalid={Boolean(errors.unitPriceRm)} aria-describedby={errors.unitPriceRm ? priceId + "-error" : undefined}
                onChange={event => { setUnitPriceRm(event.target.value); setErrors(current => ({ ...current, unitPriceRm: undefined })); }}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#9eb0a7] px-3 text-base aria-[invalid=true]:border-[#ba1a1a]" />
              {original && <IconButton label={copy.revertItem + ": " + copy.checklistUnitPrice} disabled={unitPriceRm === originalPrice}
                onClick={() => { setUnitPriceRm(originalPrice); setErrors(current => ({ ...current, unitPriceRm: undefined })); }}><ActionIcon name="revert" /></IconButton>}
            </div>
            {errors.unitPriceRm && <p id={priceId + "-error"} role="alert" className="mt-1 text-xs text-[#93000a]">{errors.unitPriceRm}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-[#e2e9e5] pt-4">
          <button type="button" className="secondary-button" onClick={onCancel}>{copy.cancel}</button>
          <button type="submit" className="primary-button">{copy.saveItem}</button>
        </div>
      </form>
    </dialog>
  );
}

function ActionIcon({ name }: { name: "check" | "close" | "revert" | "bookmark" | "history" | "list" | "trash" | "image" | "pdf" }) {
  const paths = {
    check: "m4 10.5 3.6 3.6L16 5.8",
    close: "m5 5 10 10M15 5 5 15",
    revert: "M4 4v5h5M4 9a6 6 0 1 1 1 6",
    bookmark: "M5 3h10v14l-5-3-5 3V3Z",
    history: "M10 5v5l3 2M3 3v5h5M3 8a7 7 0 1 1 0 5",
    list: "m3 5 1 1 2-2M9 5h8m-14 6 1 1 2-2M9 11h8M9 17h8",
    trash: "M4 6h12M7 6V3h6v3M6 6l1 11h6l1-11M9 9v5M11 9v5",
    image: "M3 3h14v14H3V3Zm0 11 4-4 4 4 3-3 3 3M12 6h1",
    pdf: "M5 2h7l4 4v12H5V2Zm7 0v5h4M8 11h5M8 14h5",
  };
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0"><path d={paths[name]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function IconButton({ label, children, tone = "default", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; children: ReactNode; tone?: "default" | "primary" | "danger";
}) {
  return <button type="button" aria-label={label} title={label} {...props}
    className={"inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d38] disabled:cursor-not-allowed disabled:opacity-35 " +
      (tone === "primary" ? "border-[#007d38] bg-[#007d38] text-white hover:bg-[#066c4d] " : tone === "danger" ? "border-[#e4d5d5] text-[#ba1a1a] hover:bg-[#fff2f2] " : "border-[#dce5e0] text-[#526078] hover:bg-[#edf7f2] ") + className}>{children}</button>;
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
      <path d="m4 10.5 3.6 3.6L16 5.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
      <path d="M4.5 6.5h11M8 3.5h4l1 3H7l1-3ZM6 6.5l.7 10h6.6l.7-10M8.5 9v4.5M11.5 9v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
      <path d="m12.8 4.2 3 3M4 16l.8-3.8L13.7 3.3a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-8.9 8.9L4 16Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 16h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function localizedItemName(item: ChecklistItem, locale: "en" | "ms") {
  if (item.source === "manual") return item.itemName;
  return (locale === "ms" ? item.itemNameMs : item.itemNameEn) || item.itemName;
}

function formatChecklistDate(value: string, locale: "en" | "ms") {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", {
    dateStyle: "medium",
  }).format(date);
}

function ChecklistRow({ item, locale, copy, saved, onToggleBought, onToggleNotBought, onEdit, onRevert, onDelete }: {
  item: ChecklistItem; locale: "en" | "ms"; copy: ShoppingChecklistCopy; saved: boolean;
  onToggleBought: () => void; onToggleNotBought: () => void; onEdit: () => void; onRevert: () => void; onDelete: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const name = localizedItemName(item, locale);
  const bought = item.status === "bought";
  const total = effectiveChecklistLineTotal(item);
  const quantity = effectiveChecklistQuantity(item);
  const original = item.originalValues;
  const edited = original != null && (item.itemName !== original.itemName || quantity !== original.quantity || effectiveChecklistUnitPrice(item) !== original.unitPriceRm);
  const estimated = item.actualPriceRm == null && item.priceSource !== "manual";

  const priceLabel = item.priceSource === "median" && item.actualPriceRm == null
    ? (locale === "en" ? "Median estimate" : "Anggaran median")
    : estimated ? (locale === "en" ? "Used store price" : "Harga kedai") : (locale === "en" ? "Actual price" : "Harga sebenar");
  return <li className={"checklist-row " + (actionsOpen ? "actions-open " : "") + (item.source === "manual" ? "manual-row" : "")}>
    <label className="checklist-checkbox"><input type="checkbox" checked={bought} onChange={onToggleBought} aria-label={bought ? copy.markNotBought(name) : copy.markBought(name)}/><span aria-hidden="true">{bought && <CheckIcon/>}</span></label>
    <div className="checklist-row-name">
      <span className="checklist-item-image" aria-hidden="true"><CatalogueItemImage imageUrl={item.imageUrl} fallbackSize={28}/></span>
      <div className="checklist-item-copy">
        <h3>{item.source === "manual" && <small className="manual-item-label">{locale === "en" ? "Manual item" : "Item manual"}</small>}{name}</h3>
        <p className="checklist-mobile-package">{item.packageSize || "—"} × {quantity}</p>
      </div>
    </div>
    <span className="checklist-package">{item.packageSize || "—"}</span>
    <span className="checklist-quantity">{quantity}</span>
    <span className="checklist-unit-price">{effectiveChecklistUnitPrice(item) == null ? "—" : effectiveChecklistUnitPrice(item)!.toFixed(2)}</span>
    <div className="checklist-row-total"><strong>{total == null ? <span title={copy.checklistPriceUnavailable}>—</span> : <>{estimated && <span title={copy.checklistPriceEstimate} aria-label={copy.checklistPriceEstimate}>≈ </span>}{formatRm(total)}</>}</strong><span className={"mobile-item-status " + (bought ? "is-bought" : "")}>{saved ? copy.savedForNextTrip : bought ? copy.bought : copy.notBought}</span></div>
    <div className="checklist-status"><span className={bought ? "status-bought" : "status-unbought"}>{saved ? copy.savedForNextTrip : bought ? copy.bought : copy.notBought}</span><small>{total == null ? copy.checklistPriceUnavailable : priceLabel}</small></div>
    <button type="button" className="row-disclosure" aria-label={copy.editChecklistItem + ": " + name} aria-expanded={actionsOpen} onClick={() => setActionsOpen(!actionsOpen)}><DropdownChevron/></button>
    <div className="checklist-row-actions"><div>
      {!bought && <IconButton label={saved ? copy.removeFromNextTrip + ": " + name : copy.saveForNextTrip + ": " + name} aria-pressed={saved} onClick={onToggleNotBought} className={saved ? "text-[#007d38] bg-[#ecf8f0]" : ""}><ActionIcon name="bookmark"/></IconButton>}
      <IconButton label={copy.editChecklistItem + ": " + name} onClick={onEdit}><PencilIcon/></IconButton>
      <IconButton label={copy.revertItem + ": " + name} disabled={!edited} onClick={onRevert}><ActionIcon name="revert"/></IconButton>
      <IconButton label={copy.deleteItem + ": " + name} onClick={onDelete}><TrashIcon/></IconButton>
    </div></div>
  </li>;
}

export function NextTripList({ items, locale, copy, onUse, onRestore, onRemove }: {
  items: NextTripItem[]; locale: "en" | "ms"; copy: ShoppingChecklistCopy;
  onUse?: () => void; onRestore?: (item: NextTripItem) => void | Promise<void>; onRemove: (id: string) => void;
}) {
  const headingId = useId();
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);

  const restoreItem = async (item: NextTripItem) => {
    if (!onRestore) return;
    setRestoringItemId(item.id);
    try {
      await onRestore(item);
    } finally {
      setRestoringItemId(null);
    }
  };

  return <section aria-labelledby={headingId} className="next-trip-panel">
    <div className="flex items-center justify-between gap-3">
      <h2 id={headingId} className="flex items-center gap-2 text-base font-extrabold text-[#10152e]"><ActionIcon name="bookmark" />{copy.nextTrip} <span className="rounded-full bg-[#f0eadb] px-2 py-0.5 text-xs">{items.length}</span></h2>
      {onUse && items.length > 0 && <button type="button" className="secondary-button saved-use" onClick={onUse}>{copy.useSavedItems} →</button>}
    </div>
    <p className="mt-2 text-xs leading-5 text-[#526078]">{items.length ? copy.nextTripHint : copy.nextTripEmpty}</p>
    {items.length > 0 && <ul className="mt-3 divide-y divide-[#e8e2d5]">
      {items.map(item => {
        const name = (locale === "ms" ? item.itemNameMs : item.itemNameEn) || item.itemName;
        return <li key={item.id} className="flex items-center gap-2 py-2">
          <span className="next-trip-item-image" aria-hidden="true"><CatalogueItemImage imageUrl={item.imageUrl} fallbackSize={26}/></span>
          <div className="next-trip-item-copy min-w-0 flex-1"><p className="next-trip-item-name break-words text-sm font-bold text-[#10152e]">{name}</p><p className="next-trip-item-meta text-xs text-[#526078]">{copy.checklistQuantity}: {item.quantity}{item.packageSize ? " · " + item.packageSize : ""}</p></div>
          {onRestore && <IconButton label={copy.addToChecklist + ": " + name} disabled={restoringItemId === item.id} onClick={() => void restoreItem(item)}><AddIcon /></IconButton>}
          <IconButton label={copy.removeFromNextTrip + ": " + name} onClick={() => onRemove(item.id)}><ActionIcon name="trash" /></IconButton>
        </li>;
      })}
    </ul>}
  </section>;
}

export function EmptyChecklistScreen({
  locale,
  copy,
  savedItems,
  onUseSavedItems,
  onRemoveSavedItem,
  onStartOrResume,
}: EmptyChecklistScreenProps) {
  return (
    <div className="screen-enter empty-checklist">
      <div className="empty-checklist-layout">
        <h1>{copy.checklistTitle}</h1><section className="empty-checklist-intro"><div className="empty-checklist-icon" aria-hidden="true"><ActionIcon name="list"/></div>

          <h2>{copy.noActiveChecklist}</h2>
          <p className="mt-2 text-sm leading-6 text-[#526078]">{copy.noActiveChecklistHint}</p>
          <button
            type="button"
            onClick={onStartOrResume}
            className="mt-5 min-h-12 w-full rounded-xl bg-[#007d38] px-5 text-sm font-extrabold text-white hover:bg-[#066c4d]"
          >
            {copy.startOrResumeShoppingTrip}
          </button>
        </section>
        <section aria-labelledby="next-trip-checklist-heading">
          <h2 id="next-trip-checklist-heading" className="sr-only">{copy.nextTripChecklistTitle}</h2>
          <NextTripList
            items={savedItems}
            locale={locale}
            copy={copy}
            onUse={savedItems.length > 0 ? onUseSavedItems : undefined}
            onRemove={onRemoveSavedItem}
          />
        </section>
      </div>
    </div>
  );
}

export function ShoppingChecklistScreen({
  checklist,
  locale,
  copy,
  onToggleStatus,
  onAddManual,
  onEditItem,
  onRevertItem,
  savedItems,
  onRestoreSavedItem,
  onRemoveSavedItem,
  onDeleteItem,
  onDeleteChecklist,
  alreadyRecorded,
  onRecordTrip,
}: ShoppingChecklistScreenProps) {
  const [manualDialog, setManualDialog] = useState<{ open: boolean; item: ChecklistItem | null }>({
    open: false,
    item: null,
  });
  const [itemPendingDelete, setItemPendingDelete] = useState<ChecklistItem | null>(null);
  const [deleteChecklistOpen, setDeleteChecklistOpen] = useState(false);
  const [recordTripOpen, setRecordTripOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const progress = checklistProgress(checklist);
  // AC 5.7.1: an empty checklist disables the export action and explains why.
  const isEmpty = checklist.items.length === 0;
  const totals = checklist.items.map(effectiveChecklistLineTotal).filter((value): value is number => value != null);
  const subtotal = totals.length ? totals.reduce((sum, value) => sum + value, 0) : null;
  const unavailableCount = checklist.items.length - totals.length;
  const containsEstimate = checklist.items.some(item => item.actualPriceRm == null && item.priceSource !== "manual" && item.unitPriceRm != null);

  const [itemFilter, setItemFilter] = useState<"all" | "bought" | "not_bought">("all");
  const closeManualDialog = () => setManualDialog({ open: false, item: null });

  // AC 5.7.4: export generation is fully on-device. The sheet renders the
  // privacy-bounded export model (AC 5.7.3) off-screen; PNG goes through
  // html-to-image, PDF through the print stylesheet + window.print(). A
  // failure surfaces a recoverable error in the dialog and leaves the
  // checklist untouched.
  const exportSheetRef = useRef<HTMLDivElement>(null);
  const [exportFailed, setExportFailed] = useState(false);
  // The export sheet portals to <body> only after mount (document is
  // unavailable during SSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const exportModel = buildChecklistExportModel(checklist, locale);

  const handleExportImage = async () => {
    setExportFailed(false);
    try {
      const node = exportSheetRef.current;
      if (!node) throw new Error("export sheet is not rendered");
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
      });
      const link = document.createElement("a");
      link.download = `smartcart-checklist-${checklist.createdAt.slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      setExportOpen(false);
    } catch {
      setExportFailed(true);
    }
  };

  const handleExportPdf = () => {
    setExportFailed(false);
    try {
      window.print();
      setExportOpen(false);
    } catch {
      setExportFailed(true);
    }
  };

  const saveManualItem = (input: ManualChecklistItemInput) => {
    if (manualDialog.item) {
      const item = manualDialog.item;
      const original = item.originalValues;
      const originalName = original && ((locale === "ms" ? original.itemNameMs : original.itemNameEn) || original.itemName);
      onEditItem(item.id, { ...input, itemName: input.itemName === localizedItemName(item, locale)
        ? item.itemName : original && input.itemName === originalName ? original.itemName : input.itemName });
    } else {
      onAddManual(input);
    }
    closeManualDialog();
  };

  return (
    <div className="screen-enter active-checklist pb-10">
      <div className="flex flex-col gap-3 px-4 pb-6 pt-4 sm:gap-4 sm:px-6 sm:pt-6">
        <section className="checklist-overview">
          <div className="checklist-store-identity">
            <span className="checklist-store-symbol" aria-hidden="true"><StoreChainLogo name={checklist.store.name} fallback={<UIIcon name="bag" size={28}/>} /></span>
            <span><span className="checklist-store-name">{checklist.store.name}</span><span className="checklist-store-address">{checklist.store.address}</span></span>
          </div>
          <h1 className="mt-1 break-words text-[26px] font-extrabold leading-8 tracking-[-0.5px] text-[#10152e] sm:text-[30px] sm:leading-9">
            {copy.checklistTitle}
          </h1>
          <p className="mt-1 text-xs text-[#718078]">
            {copy.checklistCreated(formatChecklistDate(checklist.createdAt, locale))}
          </p>
          <p className="mt-3 text-sm leading-6 text-[#526078]">{copy.checklistHint}</p>

          <div className="checklist-metrics mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#edf7f2] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.05em] text-[#286d67]">
                {copy.checklistProgress(progress.bought, progress.total)}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-[#007d38]">
                {progress.bought}/{progress.total}
              </p>
              <div
                role="progressbar"
                aria-label={copy.checklistProgress(progress.bought, progress.total)}
                aria-valuemin={0}
                aria-valuemax={Math.max(1, progress.total)}
                aria-valuenow={progress.bought}
                className="mt-3 h-2 overflow-hidden rounded-full bg-[#cce3d9]"
              >
                <div
                  className="h-full rounded-full bg-[#007d38] transition-[width]"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#f3f4f5] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.05em] text-[#526078]">
                {containsEstimate ? copy.checklistEstimatedTotal : copy.checklistTotal}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-[#10152e]">
                {subtotal == null ? "—" : formatRm(subtotal)}
              </p>
              {unavailableCount > 0 && (
                <p className="mt-2 text-xs leading-5 text-[#526078]">
                  {copy.checklistPriceDisclosure(unavailableCount)}
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="checklist-items-heading" className="checklist-items">
          <div className="checklist-filters">{(["all", "bought", "not_bought"] as const).map(filter => <button type="button" key={filter} aria-pressed={itemFilter === filter} onClick={() => setItemFilter(filter)}>{filter === "all" ? (locale === "en" ? "All" : "Semua") : filter === "bought" ? copy.bought : copy.notBought} ({filter === "all" ? checklist.items.length : checklist.items.filter(item => filter === "bought" ? item.status === "bought" : item.status !== "bought").length})</button>)}</div>
          <div className="mt-2 overflow-hidden rounded-xl border border-[#dce5e0] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#dce5e0] bg-[#e7f7f0] px-3 py-2.5 sm:px-4">
              <h2 id="checklist-items-heading" className="text-[20px] font-extrabold leading-7 text-[#10152e]">
                {copy.checklistItems}
              </h2>
            </div>
            {checklist.items.length > 0 ? (
              <><div className="checklist-columns" aria-hidden="true"><span/><span>{locale === "en" ? "Item" : "Item"}</span><span>{locale === "en" ? "Package" : "Pakej"}</span><span>{locale === "en" ? "Qty" : "Kuantiti"}</span><span>{locale === "en" ? "Price (RM)" : "Harga (RM)"}</span><span>{locale === "en" ? "Total (RM)" : "Jumlah (RM)"}</span><span>Status</span><span>{locale === "en" ? "Actions" : "Tindakan"}</span></div><ul>
                {checklist.items.filter(item => itemFilter === "all" || (itemFilter === "bought" ? item.status === "bought" : item.status !== "bought")).map(item => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    locale={locale}
                    copy={copy}
                    saved={savedItems.some(saved => saved.id === nextTripItemId(item))}
                    onRevert={() => onRevertItem(item.id)}
                    onToggleBought={() => onToggleStatus(item.id, "bought")}
                    onToggleNotBought={() => onToggleStatus(item.id, "not_bought")}
                    onEdit={() => setManualDialog({ open: true, item })}
                    onDelete={() => setItemPendingDelete(item)}
                  />
                ))}
              </ul></>
            ) : (
              <div className="p-6 text-center text-sm leading-6 text-[#526078]">
                {copy.checklistEmpty}
              </div>
            )}
          </div>
        </section>

        <div className="checklist-toolbar">
          <button type="button" className="secondary-button" onClick={() => setManualDialog({ open: true, item: null })}><AddIcon/>{copy.addChecklistItem}</button>
          <button
            type="button"
            disabled={isEmpty}
            onClick={() => setRecordTripOpen(true)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#007d38] px-4 text-sm font-extrabold text-white hover:bg-[#066c4d] disabled:cursor-not-allowed disabled:bg-[#a8bbb1]"
          >
            <ActionIcon name="history" />
            {copy.recordTrip}
          </button>
          <button
            type="button"
            disabled={isEmpty}
            onClick={() => setExportOpen(true)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#007d38] bg-white px-4 text-sm font-bold text-[#007d38] hover:bg-[#edf7f2] disabled:cursor-not-allowed disabled:border-[#c4d2ca] disabled:text-[#8a9891]"
          >
            <DownloadIcon /> {copy.exportChecklist}
          </button>
          <button
            type="button"
            onClick={() => setDeleteChecklistOpen(true)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#ba1a1a] bg-white px-4 text-sm font-bold text-[#ba1a1a] hover:bg-[#fff2f2]"
          >
            <TrashIcon /> {copy.deleteChecklist}
          </button>
        </div>
        <NextTripList items={savedItems} locale={locale} copy={copy} onRestore={onRestoreSavedItem} onRemove={onRemoveSavedItem} />
      </div>

      {manualDialog.open && (
        <ChecklistItemDialog
          key={manualDialog.item?.id ?? "new"}
          open
          item={manualDialog.item}
          locale={locale}
          copy={copy}
          onSave={saveManualItem}
          onCancel={closeManualDialog}
        />
      )}

      <ConfirmationDialog
        iconOnly
        open={itemPendingDelete != null}
        title={copy.deleteItem}
        body={itemPendingDelete ? copy.deleteItemConfirm(localizedItemName(itemPendingDelete, locale)) : ""}
        confirmLabel={copy.deleteItem}
        cancelLabel={copy.cancel}
        destructive
        onCancel={() => setItemPendingDelete(null)}
        onConfirm={() => {
          if (itemPendingDelete) onDeleteItem(itemPendingDelete.id);
          setItemPendingDelete(null);
        }}
      />

      <ConfirmationDialog
        open={recordTripOpen}
        title={copy.recordTrip}
        body={alreadyRecorded ? copy.recordTripAgain : copy.recordTripConfirm}
        confirmLabel={copy.recordTrip}
        cancelLabel={copy.cancel}
        onCancel={() => setRecordTripOpen(false)}
        onConfirm={() => {
          setRecordTripOpen(false);
          onRecordTrip();
        }}
      />

      <ConfirmationDialog
        iconOnly
        open={deleteChecklistOpen}
        title={copy.deleteChecklist}
        body={copy.deleteChecklistConfirm}
        confirmLabel={copy.deleteChecklist}
        cancelLabel={copy.cancel}
        destructive
        onCancel={() => setDeleteChecklistOpen(false)}
        onConfirm={() => {
          setDeleteChecklistOpen(false);
          onDeleteChecklist();
        }}
      />

      <ExportChecklistDialog
        open={exportOpen}
        copy={copy}
        errorMessage={exportFailed ? copy.exportChecklistFailed : null}
        onDownloadImage={() => void handleExportImage()}
        onDownloadPdf={handleExportPdf}
        onCancel={() => setExportOpen(false)}
      />

      {!isEmpty && mounted && createPortal(
        <div className="checklist-export-sheet" aria-hidden="true">
          {/* The capture target is the inner node: the outer wrapper sits
              off-viewport (left: -10000px) for print, and capturing it
              directly would draw the PNG content off-canvas. */}
          <div ref={exportSheetRef}>
            <ChecklistExportSheet model={exportModel} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
