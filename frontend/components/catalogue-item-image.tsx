"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { catalogueImageUrl } from "@/lib/catalogue-image";
import { UIIcon } from "./ui-icon";

/**
 * Displays a PriceCatcher product image and falls back cleanly when the
 * catalogue has no valid downloaded image for the item.
 */
export function CatalogueItemImage({ imageUrl, fallbackSize = 48 }: { imageUrl?: string | null; fallbackSize?: number }) {
  const optimizedImageUrl = catalogueImageUrl(imageUrl);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedImageUrl(null);
  }, [optimizedImageUrl]);

  if (!optimizedImageUrl || failedImageUrl === optimizedImageUrl) {
    return <UIIcon name="bag" size={fallbackSize} />;
  }

  return (
    <Image
      src={optimizedImageUrl}
      alt=""
      fill
      sizes="(max-width: 720px) 76px, 180px"
      loading="lazy"
      decoding="async"
      unoptimized
      className="catalogue-item-image"
      onError={() => setFailedImageUrl(optimizedImageUrl)}
    />
  );
}
