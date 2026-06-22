import type { QuotationLineItem } from '@/types'

export function clampDiscountPct(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function unitPriceFromBase(baseUnitPrice: number, discountPct: number): number {
  const base = Number.isFinite(baseUnitPrice) ? baseUnitPrice : 0
  const pct = clampDiscountPct(discountPct)
  return Math.round(base * (1 - pct / 100) * 100) / 100
}

export function discountPctFromPrices(baseUnitPrice: number, unitPrice: number): number {
  const base = Number.isFinite(baseUnitPrice) ? baseUnitPrice : 0
  if (base <= 0) return 0
  const unit = Number.isFinite(unitPrice) ? unitPrice : 0
  const pct = ((base - unit) / base) * 100
  return Math.round(clampDiscountPct(pct) * 100) / 100
}

export function resolveQuotedLineBaseUnitPrice(line: QuotationLineItem): number {
  const base = line.base_unit_price
  if (typeof base === 'number' && Number.isFinite(base) && base > 0) return base
  const unit = line.unit_price
  if (typeof unit === 'number' && Number.isFinite(unit) && unit > 0) return unit
  return 0
}

export function initialQuotedLinePricing(line: QuotationLineItem) {
  const base_unit_price = resolveQuotedLineBaseUnitPrice(line)
  const customer_discount_pct = clampDiscountPct(line.customer_discount_pct ?? 0)
  const unit_price =
    typeof line.unit_price === 'number' && Number.isFinite(line.unit_price)
      ? line.unit_price
      : unitPriceFromBase(base_unit_price, customer_discount_pct)
  return {
    base_unit_price,
    customer_discount_pct,
    unit_price,
    quoted_unit_price: unit_price,
  }
}
