'use client'

import FollowUpDueQueue from '@/components/dashboard/FollowUpDueQueue'
import IncompleteEnquiriesQueue from '@/components/dashboard/IncompleteEnquiriesQueue'
import QuoteExpiryAlertBanner from '@/components/dashboard/QuoteExpiryAlertBanner'
import { Skeleton } from '@/components/ui/skeleton'
import type { ActionQueuesResponse } from '@/lib/api'

type Props = {
  data?: ActionQueuesResponse
  isPending?: boolean
}

export default function ActionQueueSection({ data, isPending }: Props) {
  if (isPending) {
    return (
      <section className="mt-8 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-[120px] w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="mt-8 space-y-4">
      <h2 className="text-[16px] font-semibold tracking-[-0.2px] text-gray-900">Action Queue</h2>

      <QuoteExpiryAlertBanner data={data.quote_expiry} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IncompleteEnquiriesQueue data={data.incomplete_enquiries} />
        <FollowUpDueQueue data={data.follow_ups_due} />
      </div>
    </section>
  )
}
