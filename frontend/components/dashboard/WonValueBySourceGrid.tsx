'use client'

import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import type { DashboardChartsResponse } from '@/lib/api'

type Props = {
  data: DashboardChartsResponse['won_by_source']
  className?: string
}

export default function WonValueBySourceGrid({ data, className }: Props) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold text-gray-900">
        Won value by source — {formatCompactINR(data.total_won_value)} total
      </h3>

      {data.sources.length === 0 ? (
        <p className="mt-6 text-[13px] text-surface-muted">No POs won this month yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.sources.map((row) => (
            <li key={row.channel_key} className="relative overflow-hidden rounded-lg border border-[#ECEEE8] px-3 py-2.5">
              <div
                className="absolute inset-y-0 left-0 opacity-15"
                style={{
                  width: `${Math.max(row.share_pct, 4)}%`,
                  backgroundColor: row.bar_color,
                }}
                aria-hidden
              />
              <div className="relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-900">{row.channel_label}</p>
                  <p className="text-[11px] text-surface-muted">
                    {row.po_count} PO{row.po_count === 1 ? '' : 's'} · {row.share_pct}% of won value
                  </p>
                </div>
                <p className="text-[15px] font-semibold tabular-nums text-gray-900">
                  {formatCompactINR(row.won_value)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
