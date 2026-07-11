'use client'

import { Lightbulb } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DashboardChartsResponse } from '@/lib/api'

type Props = {
  data: DashboardChartsResponse['lost_reasons']
  className?: string
}

export default function LostQuoteReasonChart({ data, className }: Props) {
  const maxCount = data.reasons[0]?.count ?? 0

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold text-gray-900">
        Lost quote reasons — {data.total} total
      </h3>

      {data.reasons.length === 0 ? (
        <p className="mt-6 text-[13px] text-surface-muted">No lost quotes recorded this month.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.reasons.map((row) => (
            <li key={row.reason}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                <span className="font-medium text-gray-800">{row.reason}</span>
                <span className="tabular-nums font-semibold text-gray-900">{row.count}</span>
              </div>
              <div className="h-6 w-full rounded-md bg-[#EEF1EA]">
                <div
                  className={cn(
                    'flex h-full items-center rounded-md px-2 text-[11px] font-medium text-white transition-all',
                    row.is_top ? 'bg-[#2A6B3C]' : 'bg-[#8FBC9A]',
                  )}
                  style={{
                    width: `${Math.max((row.count / Math.max(maxCount, 1)) * 100, 12)}%`,
                  }}
                >
                  {row.count}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.insights.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5">
          {data.insights.map((insight) => (
            <p
              key={insight}
              className="flex items-start gap-2 text-[12px] italic leading-snug text-amber-950"
            >
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
              {insight}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
