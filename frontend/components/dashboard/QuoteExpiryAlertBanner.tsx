'use client'

import { AlertTriangle, CheckCircle2, Flag } from 'lucide-react'

import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import type { ActionQueuesResponse } from '@/lib/api'

type Props = {
  data: ActionQueuesResponse['quote_expiry']
  className?: string
}

export default function QuoteExpiryAlertBanner({ data, className }: Props) {
  const count = data.expired_count ?? 0
  const hasExpired = count > 0

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm border-l-4',
        hasExpired
          ? 'border-red-200 bg-red-50/90 border-l-red-600'
          : 'border-[#E2E6DC] bg-[#FAFAF8] border-l-brand-green-500',
        className,
      )}
      role="status"
    >
      <div className="flex gap-3 p-4 sm:p-5">
        {hasExpired ? (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-green-600" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[14px] font-semibold',
              hasExpired ? 'text-red-950' : 'text-gray-900',
            )}
          >
            {count} follow-up{count === 1 ? '' : 's'} expired — set a new date
            {data.expired_value > 0 && (
              <span className={cn('font-normal', hasExpired ? 'text-red-900/80' : 'text-surface-muted')}>
                {' '}
                ({formatCompactINR(data.expired_value)} pipeline)
              </span>
            )}
          </p>
          <p className={cn('mt-1 text-[12px]', hasExpired ? 'text-red-900/80' : 'text-surface-muted')}>
            Enquiries and quotations with a past follow-up date need a new follow-up date entered.
          </p>

          {hasExpired && data.accounts.length > 0 && (
            <ul className="mt-3 space-y-2">
              {data.accounts.map((account) => (
                <li
                  key={account.account_name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-100/60 px-2 py-1.5 text-[13px] text-red-950"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-medium">{account.account_name}</span>
                    {account.no_follow_up_logged ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-900">
                        <Flag className="size-3" aria-hidden />
                        No follow-up date
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-200 px-2 py-0.5 text-[11px] font-medium text-red-900">
                        Expired
                      </span>
                    )}
                  </div>
                  {account.expiring_value > 0 && (
                    <span className="font-semibold tabular-nums">{formatCompactINR(account.expiring_value)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
