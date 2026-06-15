'use client'

import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import type { ChargeMode } from '@/lib/quotationFinancialConfig'

const NET_TOTAL_AMOUNT_COL =
  'block w-full text-right font-mono text-[13px] tabular-nums leading-tight'

const NET_AMOUNT_INPUT_CLASS = cn(
  'h-6 min-h-0 w-[8ch] max-w-full min-w-0 shrink-0 rounded border border-input bg-white',
  'px-0 py-0 text-right font-mono text-[13px] tabular-nums leading-tight',
  'appearance-textfield [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
  'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

const DEFAULT_PERCENT_INPUT_CLASS =
  'h-7 w-[3.25rem] shrink-0 px-1.5 py-0 font-mono text-[13px] tabular-nums text-right'

export function ChargeModeToggle({
  mode,
  disabled,
  onPercent,
  onAmount,
}: {
  mode: ChargeMode
  disabled: boolean
  onPercent: () => void
  onAmount: () => void
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-surface-border bg-white">
      <button
        type="button"
        disabled={disabled}
        onClick={onPercent}
        className={cn(
          'px-2 py-0.5 text-[11px] font-semibold transition-colors',
          mode === 'percent' ? 'bg-brand-navy-500 text-white' : 'text-gray-700 hover:bg-[#F4F5F0]',
        )}
      >
        %
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onAmount}
        className={cn(
          'border-l border-surface-border px-2 py-0.5 text-[11px] font-semibold transition-colors',
          mode === 'amount' ? 'bg-brand-navy-500 text-white' : 'text-gray-700 hover:bg-[#F4F5F0]',
        )}
      >
        ₹
      </button>
    </div>
  )
}

export function NetChargeRow({
  label,
  checkboxAriaLabel,
  checked,
  onCheckedChange,
  controlsDisabled,
  mode,
  onModePercent,
  onModeAmount,
  draft,
  onDraftChange,
  percentPlaceholder,
  amountPlaceholder,
  percentAriaLabel,
  amountAriaLabel,
  appliedAmount,
  percentInputClassName,
  className,
}: {
  label: string
  checkboxAriaLabel: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  controlsDisabled: boolean
  mode: ChargeMode
  onModePercent: () => void
  onModeAmount: () => void
  draft: string
  onDraftChange: (value: string) => void
  percentPlaceholder: string
  amountPlaceholder: string
  percentAriaLabel: string
  amountAriaLabel: string
  appliedAmount: number | null | undefined
  percentInputClassName?: string
  className?: string
}) {
  const isPercent = mode === 'percent'
  const showApplied = checked && isPercent && appliedAmount != null && appliedAmount > 0

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_8.5rem] items-center gap-x-3 border-b border-[#E2E6DC] py-2.5 last:border-b-0',
        className,
      )}
    >
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            aria-label={checkboxAriaLabel}
            disabled={controlsDisabled}
            className="size-3.5 shrink-0 rounded border-[#B8BFB4] text-brand-green-600 focus:ring-brand-green-500/30"
          />
          <span className="whitespace-nowrap text-[13px] text-gray-900">{label}</span>
        </label>
        {checked && (
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
            <ChargeModeToggle
              mode={mode}
              disabled={controlsDisabled}
              onPercent={onModePercent}
              onAmount={onModeAmount}
            />
            {isPercent && (
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={controlsDisabled}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={percentPlaceholder}
                className={cn(DEFAULT_PERCENT_INPUT_CLASS, percentInputClassName)}
                aria-label={percentAriaLabel}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end leading-none">
        {checked &&
          (isPercent ? (
            showApplied ? (
              <span className={cn(NET_TOTAL_AMOUNT_COL, 'whitespace-nowrap text-gray-900')}>
                {formatCurrency(appliedAmount!)}
              </span>
            ) : null
          ) : (
            <div className="flex w-full items-center justify-end gap-0 font-mono text-[13px] tabular-nums">
              <span className="shrink-0 leading-tight">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                disabled={controlsDisabled}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={amountPlaceholder.replace(/[^\d.]/g, '') || '0.00'}
                className={NET_AMOUNT_INPUT_CLASS}
                aria-label={amountAriaLabel}
              />
            </div>
          ))}
      </div>
    </div>
  )
}
