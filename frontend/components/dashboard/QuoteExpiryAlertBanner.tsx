'use client'

import { AlertTriangle, Flag, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  dismissFollowUpBannerForToday,
  isFollowUpBannerDismissedToday,
} from '@/lib/dashboardFollowUpBannerDismiss'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import type { ActionQueuesResponse } from '@/lib/api'

type Props = {
  data: ActionQueuesResponse['quote_expiry']
  className?: string
}

export default function QuoteExpiryAlertBanner({ data, className }: Props) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(isFollowUpBannerDismissedToday())
  }, [])

  if (!data.has_expiring_quotes || dismissed) {
    return null
  }

  const handleDismiss = () => {
    dismissFollowUpBannerForToday()
    setDismissed(true)
  }

  return (
    <div
      className={cn(
        'relative rounded-xl border border-amber-200 bg-amber-50/90 shadow-sm',
        'border-l-4 border-l-amber-500',
        className,
      )}
      role="alert"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-amber-800/70 transition-colors hover:bg-amber-100 hover:text-amber-900"
        aria-label="Dismiss follow-up reminder for today"
      >
        <X className="size-4" />
      </button>

      <div className="flex gap-3 p-4 pr-10 sm:p-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-amber-950">
            {formatCompactINR(data.expiring_value)} in open quotes need follow-up
          </p>
          <p className="mt-1 text-[12px] text-amber-900/80">
            Overdue, due today, tomorrow, or within 2 days — plus quotes with no follow-up date set.
          </p>
          <ul className="mt-3 space-y-2">
            {data.accounts.map((account) => {
              const missing = account.no_follow_up_logged
              return (
                <li
                  key={account.account_name}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px]',
                    missing ? 'bg-red-50 text-red-950' : 'text-gray-900',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('font-medium', missing ? 'text-red-900' : 'text-gray-900')}>
                      {account.account_name}
                    </span>
                    {missing ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                        <Flag className="size-3" aria-hidden />
                        No follow-up date
                      </span>
                    ) : account.has_overdue ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      missing ? 'text-red-900' : 'text-gray-900',
                    )}
                  >
                    {formatCompactINR(account.expiring_value)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
