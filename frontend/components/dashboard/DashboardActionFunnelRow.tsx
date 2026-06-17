'use client'

import ActionQueueCard from '@/components/dashboard/ActionQueueCard'
import MonthlySalesFunnel from '@/components/dashboard/MonthlySalesFunnel'
import QuoteExpiryAlertBanner from '@/components/dashboard/QuoteExpiryAlertBanner'
import { Skeleton } from '@/components/ui/skeleton'
import type { ActionQueuesResponse, SalesFunnelResponse } from '@/lib/api'

type Props = {
  actionQueueData?: ActionQueuesResponse
  funnelData?: SalesFunnelResponse
  isPending?: boolean
}

export default function DashboardActionFunnelRow({
  actionQueueData,
  funnelData,
  isPending,
}: Props) {
  if (isPending) {
    return (
      <section className="mt-4 space-y-4">
        <Skeleton className="h-[120px] w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </section>
    )
  }

  if (!actionQueueData && !funnelData) return null

  return (
    <section className="mt-4 space-y-4">
      {actionQueueData && <QuoteExpiryAlertBanner data={actionQueueData.quote_expiry} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {actionQueueData && <ActionQueueCard data={actionQueueData} />}
        {funnelData && <MonthlySalesFunnel data={funnelData} />}
      </div>
    </section>
  )
}
