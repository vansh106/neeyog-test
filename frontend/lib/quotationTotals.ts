/** Quotation financial summary: item total → + P&F + freight → taxable subtotal → + GST → grand total. */

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Sum of line items (stored as ``quotation.subtotal`` in the DB). */
export function quotationItemTotal(
  itemTotal: number,
  pfAmount: number,
  freightAmount: number,
): number {
  return roundMoney(itemTotal + pfAmount + freightAmount)
}

/** GST applied on item total + P&F + freight. */
export function quotationGstAmount(taxableSubtotal: number, gstRatePercent: number): number {
  return roundMoney(taxableSubtotal * (gstRatePercent / 100))
}

export function quotationGrandTotal(taxableSubtotal: number, gstAmount: number): number {
  return roundMoney(taxableSubtotal + gstAmount)
}

export type QuotationFinancialSummary = {
  itemTotal: number
  pfAmount: number
  freightAmount: number
  taxableSubtotal: number
  gstAmount: number
  grandTotal: number
}

/** Derive display totals from persisted quotation fields. */
export function quotationFinancialsFromStored(
  itemTotal: number,
  pfAmount: number,
  freightAmount: number,
  gstRatePercent: number,
  storedGstAmount?: number | null,
  storedGrandTotal?: number | null,
): QuotationFinancialSummary {
  const taxableSubtotal = quotationItemTotal(itemTotal, pfAmount, freightAmount)
  const gstAmount =
    storedGstAmount != null && Number.isFinite(storedGstAmount)
      ? roundMoney(storedGstAmount)
      : quotationGstAmount(taxableSubtotal, gstRatePercent)
  const grandTotal =
    storedGrandTotal != null && Number.isFinite(storedGrandTotal)
      ? roundMoney(storedGrandTotal)
      : quotationGrandTotal(taxableSubtotal, gstAmount)
  return {
    itemTotal: roundMoney(itemTotal),
    pfAmount: roundMoney(pfAmount),
    freightAmount: roundMoney(freightAmount),
    taxableSubtotal,
    gstAmount,
    grandTotal,
  }
}
