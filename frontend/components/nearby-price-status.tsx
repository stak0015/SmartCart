import type { Locale } from "../lib/i18n";

export type CandidatePreparationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "failed"; message: string };

export function NearbyPriceStatus({ hasLocation, preparation, ready, storeCount, locale, onRetry }: {
  hasLocation: boolean;
  preparation: CandidatePreparationState;
  ready: boolean;
  storeCount: number;
  locale: Locale;
  onRetry?: () => void;
}) {
  const english = locale === "en";
  const loading = hasLocation && preparation.status === "loading";
  const message = !hasLocation
    ? (english ? "Set your location in Travel to load nearby stores." : "Tetapkan lokasi dalam Perjalanan untuk memuatkan kedai berdekatan.")
    : loading
      ? (english ? "Location selected. Loading nearby store prices…" : "Lokasi dipilih. Memuatkan harga kedai berdekatan…")
      : ready
        ? (english ? `Recorded prices across ${storeCount} nearby stores. Prices may vary in store.` : `Harga direkodkan daripada ${storeCount} kedai berdekatan. Harga di kedai mungkin berbeza.`)
        : (english ? "Location selected, but nearby prices could not be loaded." : "Lokasi dipilih, tetapi harga berdekatan tidak dapat dimuatkan.");

  return <div className="catalogue-price-context" aria-live="polite">
    <p>{message}</p>
    {hasLocation && preparation.status === "failed" && <p role="alert">{preparation.message}</p>}
    {hasLocation && !loading && !ready && onRetry && <button type="button" onClick={onRetry} className="mt-2 font-bold underline">
      {english ? "Retry nearby prices" : "Cuba semula harga berdekatan"}
    </button>}
  </div>;
}
