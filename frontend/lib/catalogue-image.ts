const LEGACY_CATALOGUE_IMAGE = /^\/pricecatcher\/([^/]+)\.png$/;

/**
 * Keep persisted basket rows compatible with the versioned thumbnail set.
 * New API responses already use this path, while older localStorage entries
 * may still contain the original PNG URL.
 */
export function catalogueImageUrl(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  const legacyMatch = imageUrl.match(LEGACY_CATALOGUE_IMAGE);
  return legacyMatch ? `/pricecatcher-v1/${legacyMatch[1]}.webp` : imageUrl;
}
