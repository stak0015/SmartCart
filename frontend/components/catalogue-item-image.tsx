"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Item } from "@/lib/api";
import { UIIcon } from "./ui-icon";

/**
 * Displays a PriceCatcher product image and falls back cleanly when the
 * catalogue has no valid downloaded image for the item.
 */
export function CatalogueItemImage({ item }: { item: Item }) {
  const imageUrl = item.image_url;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedImageUrl(null);
  }, [imageUrl]);

  if (!imageUrl || failedImageUrl === imageUrl) {
    return <UIIcon name="bag" size={48} />;
  }

  return (
    <Image
      src={imageUrl}
      alt=""
      fill
      sizes="(max-width: 720px) 76px, 180px"
      className="catalogue-item-image"
      onError={() => setFailedImageUrl(imageUrl)}
    />
  );
}
