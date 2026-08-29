// Ringgit display helper for the SARA Credit / Cash Needed lines (AC 2.3.3/2.3.4):
// zero renders verbatim as "RM0", any other amount with two decimals.
export function formatRm(amount: number): string {
  return amount === 0 ? "RM0" : `RM${amount.toFixed(2)}`;
}
