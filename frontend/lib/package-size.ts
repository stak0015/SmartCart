export type PackageSizeLocale = "en" | "ms";

const ENGLISH_PORTION_LABELS: Record<string, string> = {
  "gelas besar": "Large glass",
  "gelas kecil": "Small glass",
  paket: "packet",
  sebungkus: "1 packet",
  sebiji: "1 piece",
  segelas: "1 glass",
  sekeping: "1 piece",
  seketul: "1 piece",
  semangkuk: "1 bowl",
  senaskah: "1 copy",
  sepinggan: "1 plate",
  sepiring: "1 plate",
};

function countLabel(count: string, singular: string, plural: string): string {
  return `${count} ${Number(count) === 1 ? singular : plural}`;
}

export function localizedPackageSize(
  value: string | null | undefined,
  locale: PackageSizeLocale,
): string | null {
  if (!value) return null;
  if (locale === "ms") return value;

  const trimmed = value.trim();
  const exactTranslation = ENGLISH_PORTION_LABELS[trimmed.toLocaleLowerCase("ms-MY")];
  if (exactTranslation) return exactTranslation;

  return trimmed
    .replace(/\b(\d+)\s*biji\b/gi, (_match, count: string) => countLabel(count, "piece", "pieces"))
    .replace(/\b(\d+)\s*batang\b/gi, (_match, count: string) => countLabel(count, "piece", "pieces"))
    .replace(/\b(\d+)\s*beg\b/gi, (_match, count: string) => countLabel(count, "bag", "bags"))
    .replace(/\b(\d+)\s*ekor\b/gi, (_match, count: string) => countLabel(count, "whole item", "whole items"))
    .replace(/\bseekor\b/gi, "whole item")
    .replace(/\bliter\b/gi, "litre");
}
