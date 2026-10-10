"use client";

import type { SaraStoreStatus } from "@/lib/contracts";
import type { AppCopy } from "@/lib/i18n";

/**
 * A store's SARA partner label, extracted to its own module so both the single
 * store cards (smartcart-app.tsx) and the two-store plan detail (US 6.4) render
 * the identical tag.
 *
 * AC 6.4.3 requires each store in a plan to keep its own labels; sharing this one
 * component is what makes the plan detail's SARA tag match the store cards rather
 * than being a second, subtly different copy.
 */
export function SaraStoreTag({ status, copy }: { status: SaraStoreStatus; copy: AppCopy }) {
  if (status === "verified") {
    return <span className="inline-flex self-start rounded-md bg-[#e5f5ed] px-2 py-1 text-xs font-semibold text-[#166534]">{copy.verifiedSara}</span>;
  }
  if (status === "candidate") {
    return <span className="inline-flex self-start rounded-md bg-[#fff4ce] px-2 py-1 text-xs font-semibold text-[#755b00]">{copy.candidateSara}</span>;
  }
  return <span className="inline-flex self-start rounded-md bg-[#f3f4f5] px-2 py-1 text-xs font-medium text-[#5f6368]">{copy.unverifiedSara}</span>;
}
