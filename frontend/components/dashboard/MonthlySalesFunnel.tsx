'use client'

import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import type { SalesFunnelResponse } from '@/lib/api'

const STAGE_COLORS = {
  enquiries: 'bg-[#D4E8D9]',
  quoted: 'bg-[#8FBC9A]',
  po_won: 'bg-[#2A6B3C]',
} as const

type Props = {
  data: SalesFunnelResponse
  className?: string
}

function formatCount(n: number): string {
  return `${n} nos`
}

export default function MonthlySalesFunnel({ data, className }: Props) {
  const stages = [
    {
      key: 'enquiries' as const,
      label: 'Enquiries',
      countLabel: formatCount(data.enquiries.count),
      valueLabel: null as string | null,
      barWidthPct: data.enquiries.bar_width_pct,
      conversionLabel: null as string | null,
    },
    {
      key: 'quoted' as const,
      label: 'Quoted',
      countLabel: formatCount(data.quoted.count),
      valueLabel: data.quoted.value > 0 ? formatCompactINR(data.quoted.value) : null,
      barWidthPct: data.quoted.bar_width_pct,
      conversionLabel:
        data.quoted.conversion_from_enquiries_pct > 0
          ? `${data.quoted.conversion_from_enquiries_pct}% → Quoted`
          : null,
    },
    {
      key: 'po_won' as const,
      label: 'PO won',
      countLabel: formatCount(data.po_won.count),
      valueLabel: data.po_won.value > 0 ? formatCompactINR(data.po_won.value) : null,
      barWidthPct: data.po_won.bar_width_pct,
      conversionLabel:
        data.po_won.conversion_from_quoted_pct > 0
          ? `${data.po_won.conversion_from_quoted_pct}% → Won`
          : null,
    },
  ]

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold text-gray-900">
        Funnel ({data.month_label.slice(0, 3)})
      </h3>

      <div className="mt-4 flex flex-1 flex-col gap-1">
        {stages.map((stage, index) => (
          <div key={stage.key}>
            {stage.conversionLabel && (
              <p className="mb-1.5 pl-0.5 text-[11px] font-medium text-surface-muted">
                {stage.conversionLabel}
              </p>
            )}
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-medium text-gray-800">{stage.label}</span>
              <span className="shrink-0 text-right text-[12px] text-gray-700 tabular-nums">
                {stage.countLabel}
                {stage.valueLabel && (
                  <>
                    <span className="mx-1 text-gray-300" aria-hidden>
                      ·
                    </span>
                    <span className="font-semibold text-gray-900">{stage.valueLabel}</span>
                  </>
                )}
              </span>
            </div>
            <div className="h-7 w-full rounded-md bg-[#EEF1EA] sm:h-8">
              <div
                className={cn(
                  'flex h-full min-w-[4rem] items-center rounded-md px-2 transition-all duration-500 sm:min-w-[5rem]',
                  STAGE_COLORS[stage.key],
                  stage.barWidthPct < 25 && 'justify-end',
                )}
                style={{ width: `${Math.max(stage.barWidthPct, 8)}%` }}
              >
                {stage.barWidthPct >= 25 && (
                  <span className="truncate text-[11px] font-medium text-gray-900/80">
                    {stage.label}
                  </span>
                )}
              </div>
            </div>
            {index < stages.length - 1 && <div className="h-2" aria-hidden />}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-surface-muted">
        Bars scaled by value · count shown alongside
      </p>
    </div>
  )
}
