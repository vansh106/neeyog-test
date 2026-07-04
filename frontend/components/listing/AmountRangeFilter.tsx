'use client'

import { useCallback } from 'react'
import { cn, formatCurrency } from '@/lib/utils'

type Props = {
  label?: string
  min: number
  max: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
  disabled?: boolean
  className?: string
}

function formatCompactAmount(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`
  return formatCurrency(n)
}

export default function AmountRangeFilter({
  label = 'Amount',
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  disabled = false,
  className,
}: Props) {
  const span = Math.max(max - min, 1)
  const lowPct = ((valueMin - min) / span) * 100
  const highPct = ((valueMax - min) / span) * 100

  const onLow = useCallback(
    (v: number) => {
      onChange(Math.min(v, valueMax), valueMax)
    },
    [onChange, valueMax],
  )

  const onHigh = useCallback(
    (v: number) => {
      onChange(valueMin, Math.max(v, valueMin))
    },
    [onChange, valueMin],
  )

  if (max <= min) {
    return (
      <div
        className={cn(
          'rounded-md border border-[#E2E6DC] bg-white px-3 py-2.5 text-[11px] text-surface-muted shadow-sm',
          className,
        )}
      >
        {label.replace(/\s*:\s*$/, '')}: no data
      </div>
    )
  }

  const rangeClass =
    'pointer-events-none absolute h-1.5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-brand-green-600 [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-brand-green-600 [&::-moz-range-thumb]:shadow-sm'

  return (
    <div
      className={cn(
        'rounded-md border border-[#E2E6DC] bg-gradient-to-b from-white to-[#F4F6F1] px-3 py-2.5 shadow-sm',
        className,
      )}
    >
      {label ? (
        <div className="mb-1.5 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
          {label.replace(/\s*:\s*$/, '')}
        </div>
      ) : null}
      <div className="relative mx-0.5 h-6">
        <div className="absolute top-[11px] h-1.5 w-full rounded-full bg-[#E2E6DC]" />
        <div
          className="absolute top-[11px] h-1.5 rounded-full bg-brand-green-500"
          style={{ left: `${lowPct}%`, width: `${Math.max(highPct - lowPct, 0)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={Math.max(1, Math.round(span / 200))}
          value={valueMin}
          disabled={disabled}
          onChange={(e) => onLow(Number(e.target.value))}
          className={cn(rangeClass, 'top-[6px] z-[2]')}
          aria-label={`${label} minimum`}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={Math.max(1, Math.round(span / 200))}
          value={valueMax}
          disabled={disabled}
          onChange={(e) => onHigh(Number(e.target.value))}
          className={cn(rangeClass, 'top-[6px] z-[3]')}
          aria-label={`${label} maximum`}
        />
      </div>
      <div className="mt-1 flex justify-between gap-2 tabular-nums text-[10px] font-medium text-gray-700">
        <span>{formatCompactAmount(valueMin)}</span>
        <span className="text-surface-muted">—</span>
        <span>{formatCompactAmount(valueMax)}</span>
      </div>
    </div>
  )
}
