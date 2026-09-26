export interface PieAmount {
  categoryId: string;
  amountRm: number;
}

/** Group confirmed spending into the six largest categories and one remainder. */
export function groupPieCategories<T extends PieAmount>(rows: readonly T[]) {
  const orderedRows = [...rows].sort((left, right) =>
    right.amountRm - left.amountRm || left.categoryId.localeCompare(right.categoryId));
  const totalRm = orderedRows.reduce((sum, row) => sum + row.amountRm, 0);
  const positiveRows = orderedRows.filter(row => row.amountRm > 0);
  const leading = positiveRows.slice(0, 6);
  const otherAmountRm = positiveRows.slice(6).reduce((sum, row) => sum + row.amountRm, 0);
  const slices = [
    ...leading.map(row => ({ categoryId: row.categoryId, amountRm: row.amountRm })),
    ...(otherAmountRm > 0 ? [{ categoryId: "other-categories", amountRm: otherAmountRm }] : []),
  ];
  return { orderedRows, totalRm, slices };
}
