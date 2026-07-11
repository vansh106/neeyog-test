'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import type { ActionQueuesResponse } from '@/lib/api'

type Props = {
  data: ActionQueuesResponse['so_dates_pending']
  className?: string
}

export default function SoDatePendingAlertBanner({ data, className }: Props) {
  const count = data.count
  const hasPending = count > 0
  const preview = data.items.slice(0, 3)
  const remaining = count - preview.length

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm border-l-4',
        hasPending
          ? 'border-amber-200 bg-amber-50/90 border-l-amber-500'
          : 'border-[#E2E6DC] bg-[#FAFAF8] border-l-brand-green-500',
        className,
      )}
      role="status"
    >
      <div className="flex gap-3 p-4 sm:p-5">
        {hasPending ? (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-green-600" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[14px] font-semibold',
              hasPending ? 'text-amber-950' : 'text-gray-900',
            )}
          >
            {count} purchase order{count === 1 ? '' : 's'} need SO date
          </p>
          <p className={cn('mt-1 text-[12px]', hasPending ? 'text-amber-900/80' : 'text-surface-muted')}>
            SO date was not entered within 24 hours of PO creation.
          </p>

          {hasPending && (
            <>
              <ul className="mt-3 space-y-2">
                {preview.map((item) => (
                  <li
                    key={item.po_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/60 px-2 py-1.5 text-[13px] text-gray-900"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{item.po_number}</span>
                      <span className="text-surface-muted"> · {item.client_name}</span>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-amber-900">
                      {item.due_label}
                      {item.total_amount > 0 && (
                        <span className="ml-2 tabular-nums text-gray-900">
                          {formatCompactINR(item.total_amount)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {remaining > 0 && (
                <p className="mt-2 text-[12px] text-amber-900/80">+{remaining} more</p>
              )}
              <Link
                href="/purchase-orders"
                className="mt-3 inline-block text-[12px] font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                Open purchase orders
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
