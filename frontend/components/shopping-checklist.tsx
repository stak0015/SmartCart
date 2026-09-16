"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { formatRm } from "@/lib/format-rm";
import {
  actualLineTotalRm,
  checklistProgress,
  plannedChecklistSubtotal,
  validateActualQuantity,
  validateActualUnitPrice,
  validateManualChecklistItem,
  type ChecklistItem,
  type ChecklistStatus,
  type ManualChecklistItemInput,
  type ShoppingChecklist,
} from "@/lib/shopping-checklist";

export interface ShoppingChecklistCopy {
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
  close: string;
}

export interface ShoppingChecklistScreenProps {
  checklist: ShoppingChecklist;
  locale: "en" | "ms";
  copy: ShoppingChecklistCopy;
  onToggleStatus: (itemId: string, status: Exclude<ChecklistStatus, "neutral">) => void;
  onAddManual: (input: ManualChecklistItemInput) => void;
  onEditItem: (itemId: string, input: ManualChecklistItemInput) => void;
  onSetActualPrice: (itemId: string, actualPriceRm: number | null) => void;
  onSetActualQuantity: (itemId: string, actualQuantity: number | null) => void;
  onDeleteItem: (itemId: string) => void;
  onDeleteChecklist: () => void;
  alreadyRecorded: boolean;
  onRecordTrip: () => void;
}

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
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
  onSaveActualEntry?: (entry: { actualPriceRm: number | null; actualQuantity: number | null }) => void;
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
      className="m-auto w-[calc(100%_-_2rem)] max-w-[28rem] rounded-2xl border border-[#dce5e0] bg-white p-0 text-[#10231d] shadow-2xl backdrop:bg-[#10231d]/55"
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-xl font-extrabold leading-7">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-[#53635c]">
          {body}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-[#9eb0a7] bg-white px-4 text-sm font-bold text-[#17362c] hover:bg-[#f1f5f3]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-11 rounded-xl px-4 text-sm font-bold text-white ${
              destructive
                ? "bg-[#ba1a1a] hover:bg-[#93000a]"
                : "bg-[#087f5b] hover:bg-[#066c4d]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface ExportChecklistDialogProps {
  open: boolean;
  copy: ShoppingChecklistCopy;
  onDownloadImage: () => void;
  onDownloadPdf: () => void;
  onCancel: () => void;
}

// AC 5.7.1: one accessible Export action offering both download formats.
function ExportChecklistDialog({
  open,
  copy,
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
      className="m-auto w-[calc(100%_-_2rem)] max-w-[28rem] rounded-2xl border border-[#dce5e0] bg-white p-0 text-[#10231d] shadow-2xl backdrop:bg-[#10231d]/55"
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-xl font-extrabold leading-7">
          {copy.exportChecklist}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-[#53635c]">
          {copy.exportChecklistIntro}
        </p>
        <div className="mt-6 grid gap-3">
          <button
            ref={imageRef}
            type="button"
            onClick={onDownloadImage}
            className="min-h-11 rounded-xl bg-[#087f5b] px-4 text-sm font-bold text-white hover:bg-[#066c4d]"
          >
            {copy.downloadAsImage}
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="min-h-11 rounded-xl bg-[#087f5b] px-4 text-sm font-bold text-white hover:bg-[#066c4d]"
          >
            {copy.downloadAsPdf}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-[#9eb0a7] bg-white px-4 text-sm font-bold text-[#17362c] hover:bg-[#f1f5f3]"
          >
            {copy.cancel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ChecklistItemDialog({ open, item, locale, copy, onSave, onSaveActualEntry, onCancel }: ChecklistItemDialogProps) {
  const titleId = useId();
  const nameId = useId();
  const quantityId = useId();
  const priceId = useId();
  const nameErrorId = useId();
  const quantityErrorId = useId();
  const priceErrorId = useId();
  const actualPriceId = useId();
  const actualPriceErrorId = useId();
  const actualQuantityId = useId();
  const actualQuantityErrorId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const { dialogRef, handleCancel } = useNativeDialog(open, onCancel, nameRef);
  const [itemName, setItemName] = useState(item ? localizedItemName(item, locale) : "");
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : "1");
  const [unitPriceRm, setUnitPriceRm] = useState(
    item?.unitPriceRm == null ? "" : item.unitPriceRm.toFixed(2),
  );
  const [errors, setErrors] = useState<ChecklistItemErrors>({});
  // AC 5.3.1/5.3.4: the actual price/quantity fields only exist for lines
  // marked Purchased. A blank actual quantity means "use the planned one".
  const showActualEntry = item != null && item.status === "bought" && onSaveActualEntry != null;
  const [actualPrice, setActualPrice] = useState(
    item?.actualPriceRm == null ? "" : item.actualPriceRm.toFixed(2),
  );
  const [actualPriceError, setActualPriceError] = useState<string | undefined>(undefined);
  const [actualQuantity, setActualQuantity] = useState(
    item?.actualQuantity == null ? "" : String(item.actualQuantity),
  );
  const [actualQuantityError, setActualQuantityError] = useState<string | undefined>(undefined);

  const changeActualPrice = (value: string) => {
    setActualPrice(value);
    const invalid = value.trim() !== "" && !validateActualUnitPrice(value).success;
    setActualPriceError(invalid ? copy.itemPriceError : undefined);
  };

  const changeActualQuantity = (value: string) => {
    setActualQuantity(value);
    const invalid = value.trim() !== "" && !validateActualQuantity(value).success;
    setActualQuantityError(invalid ? copy.itemQuantityError : undefined);
  };

  const saveActualEntry = () => {
    const price = validateActualUnitPrice(actualPrice);
    const qty = validateActualQuantity(actualQuantity);
    setActualPriceError(price.success ? undefined : copy.itemPriceError);
    setActualQuantityError(qty.success ? undefined : copy.itemQuantityError);
    if (!price.success || !qty.success) return;
    onSaveActualEntry?.({ actualPriceRm: price.value, actualQuantity: qty.value });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate: ManualChecklistItemInput = { itemName, quantity, unitPriceRm };
    const validation = validateManualChecklistItem(candidate);

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
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[32rem] overflow-y-auto rounded-2xl border border-[#dce5e0] bg-white p-0 text-[#10231d] shadow-2xl backdrop:bg-[#10231d]/55"
    >
      <form onSubmit={submit} noValidate className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-extrabold leading-7">
            {item ? copy.editChecklistItem : copy.addChecklistItem}
          </h2>
          <button
            type="button"
            aria-label={copy.close}
            onClick={onCancel}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-2xl leading-none text-[#53635c] hover:bg-[#f1f5f3]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor={nameId} className="text-sm font-bold text-[#17362c]">
              {copy.itemName}
            </label>
            <input
              ref={nameRef}
              id={nameId}
              type="text"
              autoComplete="off"
              value={itemName}
              aria-invalid={Boolean(errors.itemName)}
              aria-describedby={errors.itemName ? nameErrorId : undefined}
              onChange={event => {
                setItemName(event.target.value);
                if (errors.itemName) setErrors(current => ({ ...current, itemName: undefined }));
              }}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[#9eb0a7] bg-white px-3 text-base text-[#10231d] aria-[invalid=true]:border-[#ba1a1a]"
            />
            {errors.itemName && (
              <p id={nameErrorId} role="alert" className="mt-1.5 text-xs font-semibold text-[#93000a]">
                {errors.itemName}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={quantityId} className="text-sm font-bold text-[#17362c]">
                {copy.itemQuantity}
              </label>
              <input
                id={quantityId}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={quantity}
                aria-invalid={Boolean(errors.quantity)}
                aria-describedby={errors.quantity ? quantityErrorId : undefined}
                onChange={event => {
                  setQuantity(event.target.value);
                  if (errors.quantity) setErrors(current => ({ ...current, quantity: undefined }));
                }}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-[#9eb0a7] bg-white px-3 text-base text-[#10231d] aria-[invalid=true]:border-[#ba1a1a]"
              />
              {errors.quantity && (
                <p id={quantityErrorId} role="alert" className="mt-1.5 text-xs font-semibold text-[#93000a]">
                  {errors.quantity}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={priceId} className="text-sm font-bold text-[#17362c]">
                {copy.itemUnitPrice}
              </label>
              <input
                id={priceId}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={unitPriceRm}
                aria-invalid={Boolean(errors.unitPriceRm)}
                aria-describedby={errors.unitPriceRm ? priceErrorId : undefined}
                onChange={event => {
                  setUnitPriceRm(event.target.value);
                  if (errors.unitPriceRm) setErrors(current => ({ ...current, unitPriceRm: undefined }));
                }}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-[#9eb0a7] bg-white px-3 text-base text-[#10231d] aria-[invalid=true]:border-[#ba1a1a]"
              />
              {errors.unitPriceRm && (
                <p id={priceErrorId} role="alert" className="mt-1.5 text-xs font-semibold text-[#93000a]">
                  {errors.unitPriceRm}
                </p>
              )}
            </div>
          </div>
        </div>

        {showActualEntry && (
          <div className="mt-4 rounded-xl border border-[#dce5e0] bg-[#f8faf9] p-3">
            <p className="text-[11px] font-semibold text-[#087f5b]">{copy.shopperRecorded}</p>
            <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={actualPriceId} className="text-sm font-bold text-[#17362c]">
                  {copy.actualUnitPrice}
                </label>
                <input
                  id={actualPriceId}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={actualPrice}
                  aria-invalid={Boolean(actualPriceError)}
                  aria-describedby={actualPriceError ? actualPriceErrorId : undefined}
                  onChange={event => changeActualPrice(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[#9eb0a7] bg-white px-3 text-base text-[#10231d] aria-[invalid=true]:border-[#ba1a1a]"
                />
                {actualPriceError && (
                  <p id={actualPriceErrorId} role="alert" className="mt-1.5 text-xs font-semibold text-[#93000a]">
                    {actualPriceError}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={actualQuantityId} className="text-sm font-bold text-[#17362c]">
                  {copy.actualQuantity}
                </label>
                <input
                  id={actualQuantityId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder={item ? String(item.quantity) : undefined}
                  value={actualQuantity}
                  aria-invalid={Boolean(actualQuantityError)}
                  aria-describedby={actualQuantityError ? actualQuantityErrorId : undefined}
                  onChange={event => changeActualQuantity(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[#9eb0a7] bg-white px-3 text-base text-[#10231d] aria-[invalid=true]:border-[#ba1a1a]"
                />
                {actualQuantityError && (
                  <p id={actualQuantityErrorId} role="alert" className="mt-1.5 text-xs font-semibold text-[#93000a]">
                    {actualQuantityError}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={saveActualEntry}
                className="min-h-11 rounded-xl bg-[#087f5b] px-4 text-sm font-bold text-white hover:bg-[#066c4d]"
              >
                {copy.saveItem}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-[#9eb0a7] bg-white px-4 text-sm font-bold text-[#17362c] hover:bg-[#f1f5f3]"
          >
            {copy.cancel}
          </button>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-[#087f5b] px-4 text-sm font-bold text-white hover:bg-[#066c4d]"
          >
            {copy.saveItem}
          </button>
        </div>
      </form>
    </dialog>
  );
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
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
      <path d="M4.5 6.5h11M8 3.5h4l1 3H7l1-3ZM6 6.5l.7 10h6.6l.7-10M8.5 9v4.5M11.5 9v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
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

function ChecklistRow({
  item,
  locale,
  copy,
  onToggleBought,
  onToggleNotBought,
  onEdit,
  onDelete,
}: {
  item: ChecklistItem;
  locale: "en" | "ms";
  copy: ShoppingChecklistCopy;
  onToggleBought: () => void;
  onToggleNotBought: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = localizedItemName(item, locale);
  const bought = item.status === "bought";
  const notBought = item.status === "not_bought";
  // AC 5.3.2/5.3.3: the shopper-recorded price and its line total render
  // alongside (never instead of) the official/reference price; a cleared
  // price renders nothing — never RM0.00.
  const actualPrice = item.actualPriceRm;
  const actualTotal = actualLineTotalRm(item);
  // AC 5.3.4: spending quantity is the recorded actual one when present;
  // the row always says whether planned or actual quantity was used.
  const effectiveQuantity = item.actualQuantity ?? item.quantity;
  const quantitySourceLabel = item.quantitySource === "actual"
    ? copy.quantitySourceActual
    : copy.quantitySourcePlanned;
  const rowTone = bought
    ? "bg-[#f5fbf8] hover:bg-[#eff8f3]"
    : "bg-white hover:bg-[#f8faf9]";
  const strikeThrough = bought ? "line-through decoration-2 decoration-[#087f5b]" : "";

  return (
    <li className={`flex min-h-12 items-center gap-1.5 border-b border-[#e2e9e5] px-3 py-1 transition-colors last:border-b-0 sm:px-4 ${rowTone}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={bought}
        aria-label={bought ? copy.clearItemStatus(name) : copy.markBought(name)}
        onClick={onToggleBought}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-[#edf7f2] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#087f5b]"
      >
        <span className={`flex h-5 w-5 items-center justify-center rounded-[4px] border ${bought ? "border-[#087f5b] bg-[#087f5b] text-white" : "border-[#9bc9b6] bg-white text-transparent"}`}>
          {bought && <CheckIcon />}
        </span>
      </button>

      <div className={`flex min-w-0 flex-1 items-center justify-between gap-2 whitespace-nowrap ${strikeThrough}`}>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-bold leading-5 text-[#17362c]" title={name}>
            {name}
          </h3>
          {item.packageSize && (
            <p className="mt-0.5 truncate text-[11px] text-[#718078]">{item.packageSize}</p>
          )}
          {notBought && (
            <p className="mt-0.5 text-[11px] font-semibold text-[#8a5a00]">{copy.notBought}</p>
          )}
        </div>
        <div className={`${actualPrice != null || item.actualQuantity != null ? "w-40" : "w-28"} shrink-0 text-right`}>
          <p className="flex items-center justify-end gap-1 text-[14px] font-extrabold tabular-nums text-[#17362c]">
            {item.priceSource === "median" && item.lineTotalRm != null && (
              <>
                <span aria-hidden="true" className="text-[#7a5b00]">≈</span>
                <span className="sr-only">{copy.checklistPriceEstimate}</span>
              </>
            )}
            {item.lineTotalRm == null
              ? <span className="text-xs font-semibold text-[#5f6368]"><span aria-hidden="true">—</span><span className="sr-only">{copy.checklistPriceUnavailable}</span></span>
              : formatRm(item.lineTotalRm)}
          </p>
          <p className="text-[11px] tabular-nums text-[#718078]">
            <span className="sr-only">{copy.checklistQuantity}: </span>
            {item.quantity} × <span className="sr-only">{copy.checklistUnitPrice}: </span>
            {item.unitPriceRm == null ? "—" : formatRm(item.unitPriceRm)}
          </p>
          {item.actualQuantity != null && (
            <p className="mt-0.5 whitespace-normal text-[11px] font-semibold tabular-nums text-[#087f5b]">
              {copy.actualQuantity}: {item.actualQuantity} ({quantitySourceLabel})
            </p>
          )}
          {actualPrice != null && actualTotal != null && (
            <p className="mt-0.5 whitespace-normal text-[11px] tabular-nums text-[#087f5b]">
              <span className="sr-only">{copy.actualUnitPrice}: </span>
              {formatRm(actualPrice)} × {effectiveQuantity} ({quantitySourceLabel})
              {" = "}<span className="font-bold">{formatRm(actualTotal)}</span>
              {" · "}{copy.shopperRecorded}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              aria-pressed={notBought}
              aria-label={notBought ? copy.clearItemStatus(name) : copy.markNotBought(name)}
              onClick={onToggleNotBought}
              className={`min-h-7 rounded-full border px-2 text-[10px] font-bold ${
                notBought
                  ? "border-[#8a5a00] bg-[#fdf3e0] text-[#8a5a00]"
                  : "border-[#c4d2ca] text-[#53635c] hover:bg-[#f1f5f3]"
              }`}
            >
              {copy.notBought}
            </button>
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-0.5">
            <button
              type="button"
              aria-label={`${copy.editChecklistItem}: ${name}`}
              title={copy.editChecklistItem}
              onClick={onEdit}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#087f5b] hover:bg-[#e1f2e9] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#087f5b]"
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              aria-label={`${copy.deleteItem}: ${name}`}
              title={copy.deleteItem}
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#718078] hover:bg-[#fff2f2] hover:text-[#ba1a1a] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ba1a1a]"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ShoppingChecklistScreen({
  checklist,
  locale,
  copy,
  onToggleStatus,
  onAddManual,
  onEditItem,
  onSetActualPrice,
  onSetActualQuantity,
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
  // Prefer the snapshot's persisted planned subtotal (AC 5.1.1); fall back to
  // live derivation for legacy payloads migrated without it.
  const subtotal = checklist.plannedSubtotalRm ?? plannedChecklistSubtotal(checklist);
  const unavailableCount = checklist.items.filter(item => item.lineTotalRm == null).length;
  const containsEstimate = checklist.items.some(
    item => item.priceSource === "median" && item.lineTotalRm != null,
  );

  const closeManualDialog = () => setManualDialog({ open: false, item: null });

  // AC 5.7.4 wires the actual PNG/PDF generation to these handlers.
  const handleExportImage = () => {};
  const handleExportPdf = () => {};

  const saveManualItem = (input: ManualChecklistItemInput) => {
    if (manualDialog.item) {
      onEditItem(manualDialog.item.id, input);
    } else {
      onAddManual(input);
    }
    closeManualDialog();
  };

  const saveActualEntry = (entry: { actualPriceRm: number | null; actualQuantity: number | null }) => {
    if (!manualDialog.item) return;
    onSetActualPrice(manualDialog.item.id, entry.actualPriceRm);
    onSetActualQuantity(manualDialog.item.id, entry.actualQuantity);
    closeManualDialog();
  };

  return (
    <div className="screen-enter pb-10">
      <div className="flex flex-col gap-3 px-4 pb-6 pt-3 sm:gap-4 sm:px-6 sm:pt-5">
        <section className="rounded-2xl border border-[#dce5e0] bg-white p-3 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-4">
          <p className="text-sm font-bold text-[#087f5b]">{copy.checklistTitle}</p>
          <h1 className="mt-1 break-words text-[26px] font-extrabold leading-8 tracking-[-0.5px] text-[#10231d] sm:text-[30px] sm:leading-9">
            {checklist.store.name}
          </h1>
          <p className="mt-1 text-xs text-[#718078]">
            {copy.checklistCreated(formatChecklistDate(checklist.createdAt, locale))}
          </p>
          {checklist.store.address && (
            <p className="mt-2 text-xs leading-5 text-[#617069]">{checklist.store.address}</p>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[#edf7f2] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.05em] text-[#286d67]">
                {copy.checklistProgress(progress.bought, progress.total)}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-[#087f5b]">
                {progress.bought}/{progress.total}
              </p>
              <div
                role="progressbar"
                aria-label={copy.checklistProgress(progress.bought, progress.total)}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.bought}
                className="mt-3 h-2 overflow-hidden rounded-full bg-[#cce3d9]"
              >
                <div
                  className="h-full rounded-full bg-[#087f5b] transition-[width]"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#f3f4f5] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.05em] text-[#53635c]">
                {containsEstimate ? copy.estimatedPlannedSubtotal : copy.plannedSubtotal}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-[#17362c]">
                {subtotal == null ? "—" : formatRm(subtotal)}
              </p>
              {unavailableCount > 0 && (
                <p className="mt-2 text-xs leading-5 text-[#617069]">
                  {copy.checklistPriceDisclosure(unavailableCount)}
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="checklist-items-heading">
          <div className="mt-2 overflow-hidden rounded-xl border border-[#dce5e0] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#dce5e0] bg-[#e7f7f0] px-3 py-2.5 sm:px-4">
              <h2 id="checklist-items-heading" className="text-[20px] font-extrabold leading-7 text-[#10231d]">
                {copy.checklistItems}
              </h2>
              <button
                type="button"
                onClick={() => setManualDialog({ open: true, item: null })}
                className="flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-[#087f5b] px-2.5 text-xs font-bold text-white hover:bg-[#066c4d] sm:px-3 sm:text-sm"
              >
                <AddIcon /> {copy.addChecklistItem}
              </button>
            </div>
            {checklist.items.length > 0 ? (
              <ul>
                {checklist.items.map(item => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    locale={locale}
                    copy={copy}
                    onToggleBought={() => onToggleStatus(item.id, "bought")}
                    onToggleNotBought={() => onToggleStatus(item.id, "not_bought")}
                    onEdit={() => setManualDialog({ open: true, item })}
                    onDelete={() => setItemPendingDelete(item)}
                  />
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-sm leading-6 text-[#617069]">
                {copy.checklistEmpty}
              </div>
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={() => setRecordTripOpen(true)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#087f5b] px-4 text-sm font-bold text-white hover:bg-[#066c4d]"
        >
          <CheckIcon /> {copy.recordTrip}
        </button>

        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={isEmpty}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#087f5b] bg-white px-4 text-sm font-bold text-[#087f5b] hover:bg-[#edf7f2] disabled:cursor-not-allowed disabled:border-[#c4d2ca] disabled:text-[#8a9891] disabled:hover:bg-white"
        >
          <DownloadIcon /> {copy.exportChecklist}
        </button>
        {isEmpty && (
          <p className="-mt-1 text-center text-xs text-[#617069]">
            {copy.exportChecklistEmpty}
          </p>
        )}

        <button
          type="button"
          onClick={() => setDeleteChecklistOpen(true)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#ba1a1a] bg-white px-4 text-sm font-bold text-[#ba1a1a] hover:bg-[#fff2f2]"
        >
          <TrashIcon /> {copy.deleteChecklist}
        </button>
      </div>

      {manualDialog.open && (
        <ChecklistItemDialog
          key={manualDialog.item?.id ?? "new"}
          open
          item={manualDialog.item}
          locale={locale}
          copy={copy}
          onSave={saveManualItem}
          onSaveActualEntry={manualDialog.item?.status === "bought" ? saveActualEntry : undefined}
          onCancel={closeManualDialog}
        />
      )}

      <ConfirmationDialog
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
        onDownloadImage={handleExportImage}
        onDownloadPdf={handleExportPdf}
        onCancel={() => setExportOpen(false)}
      />
    </div>
  );
}
