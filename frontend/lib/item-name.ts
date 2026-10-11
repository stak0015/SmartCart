export function uppercaseItemName(value: string): string {
  return value.toLocaleUpperCase("ms-MY");
}

/** English item names are shown in capitals; Malay names keep their own casing. */
export function displayItemName(name: string, locale: "en" | "ms"): string {
  return locale === "en" ? name.toUpperCase() : name;
}
