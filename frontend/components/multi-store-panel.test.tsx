import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/i18n";
import { DEFAULT_MULTI_STORE_CONFIG } from "@/lib/multi-store";
import { MultiStorePanel } from "./multi-store-panel";

describe("multi-store route feedback", () => {
  it("does not show the removed estimate notice when multi-store planning is on", () => {
    const markup = renderToStaticMarkup(createElement(MultiStorePanel, {
      config: { ...DEFAULT_MULTI_STORE_CONFIG, enabled: true },
      onChange: () => {},
      copy: COPY.en,
    }));
    expect(markup).not.toContain("multi-store-estimate");
  });

  it("does not show route feedback when multi-store planning is off", () => {
    const markup = renderToStaticMarkup(createElement(MultiStorePanel, {
      config: DEFAULT_MULTI_STORE_CONFIG,
      onChange: () => {},
      copy: COPY.en,
    }));
    expect(markup).not.toContain("multi-store-estimate");
  });
});
