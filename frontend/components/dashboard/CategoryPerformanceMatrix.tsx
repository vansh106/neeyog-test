'use client'

import { useMemo } from 'react'
import { Lightbulb } from 'lucide-react'

import { formatCompactINR } from '@/lib/formatCompactINR'
import {
  buildHierarchicalCategoryRows,
  categoryPerformanceInsight,
} from '@/lib/categoryPerformanceNav'
import { cn } from '@/lib/utils'
import type { DashboardChartsResponse } from '@/lib/api'

function winRateClass(tier: string): string {
  if (tier === 'high') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (tier === 'low') return 'bg-red-50 text-red-800 border-red-200'
  if (tier === 'medium') return 'bg-amber-50 text-amber-900 border-amber-200'
  return 'bg-gray-50 text-gray-600 border-gray-200'
}

type Props = {
  data: DashboardChartsResponse['category_performance']
  className?: string
}

function renderInsight(text: string, highlight: string | null) {
  if (!highlight || !text.includes(highlight)) {
    return text
  }
  const [before, after] = text.split(highlight)
  return (
    <>
      {before}
      <span className="font-semibold not-italic underline decoration-amber-600/60">{highlight}</span>
      {after}
    </>
  )
}

export default function CategoryPerformanceMatrix({ data, className }: Props) {
  const rows = useMemo(
    () => buildHierarchicalCategoryRows(data.categories),
    [data.categories],
  )
  const { insight, highlight_token } = useMemo(
    () => categoryPerformanceInsight(rows),
    [rows],
  )

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold text-gray-900">
        Category performance — won value vs win rate
      </h3>

      {rows.length === 0 ? (
        <p className="mt-6 text-[13px] text-surface-muted">No category data this month.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#ECEEE8] text-left text-[11px] font-semibold uppercase tracking-wide text-surface-muted">
                  <th className="pb-2 pr-3 font-semibold">Category</th>
                  <th className="pb-2 pr-3 font-semibold">Won value</th>
                  <th className="pb-2 font-semibold">Value win %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.category_key} className="border-b border-[#F3F4F0] last:border-0">
                    <td
                      className={cn(
                        'py-2.5 pr-3 font-medium text-gray-900',
                        row.is_group && row.depth === 0 && 'font-semibold',
                      )}
                      style={{ paddingLeft: `${12 + row.depth * 16}px` }}
                    >
                      {row.category_label}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="relative min-w-[120px]">
                        <div
                          className="absolute inset-y-0 left-0 rounded bg-[#2A6B3C]/10"
                          style={{ width: `${Math.max(row.bar_width_pct, 6)}%` }}
                          aria-hidden
                        />
                        <span className="relative font-semibold tabular-nums text-gray-900">
                          {formatCompactINR(row.won_value)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-md border px-2 py-0.5 text-[12px] font-semibold tabular-nums',
                          winRateClass(row.win_rate_tier),
                        )}
                      >
                        {row.win_rate_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {insight && (
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5">
              <p className="flex items-start gap-2 text-[12px] italic leading-snug text-amber-950">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
                {renderInsight(insight, highlight_token)}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
