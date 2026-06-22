'use client'

import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import {
  clampDiscountPct,
  discountPctFromPrices,
  unitPriceFromBase,
} from '@/lib/poQuotedLinePricing'

export type QuotedLineNegotiation = {
  quantity: number
  unit_price: number
  base_unit_price: number
  customer_discount_pct: number
}

type Props = {
  value: QuotedLineNegotiation
  onChange: (next: QuotedLineNegotiation) => void
}

export default function PoQuotedLineNegotiationFields({ value, onChange }: Props) {
  const lineTotal = value.quantity * value.unit_price

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-[12px]">
          <span className="text-surface-muted">Customer discount (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={value.customer_discount_pct}
            onChange={(e) => {
              const pct = clampDiscountPct(Number(e.target.value) || 0)
              onChange({
                ...value,
                customer_discount_pct: pct,
                unit_price: unitPriceFromBase(value.base_unit_price, pct),
              })
            }}
          />
        </label>
        <label className="text-[12px]">
          <span className="text-surface-muted">Final unit price (₹)</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.unit_price}
            onChange={(e) => {
              const unit = Number(e.target.value) || 0
              onChange({
                ...value,
                unit_price: unit,
                customer_discount_pct: discountPctFromPrices(value.base_unit_price, unit),
              })
            }}
          />
        </label>
        <label className="text-[12px]">
          <span className="text-surface-muted">Quantity</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={value.quantity}
            onChange={(e) =>
              onChange({
                ...value,
                quantity: Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
        </label>
      </div>
      {value.base_unit_price > 0 && value.base_unit_price !== value.unit_price ? (
        <p className="text-[11px] text-surface-muted">
          Base price {formatCurrency(value.base_unit_price)} before discount
        </p>
      ) : null}
      <p className="text-[12px] text-surface-muted">
        Line total:{' '}
        <span className="font-mono font-medium text-gray-900">{formatCurrency(lineTotal)}</span>
      </p>
    </div>
  )
}
