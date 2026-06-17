'use client'

import LostQuoteReasonChart from '@/components/dashboard/LostQuoteReasonChart'
import WeeklyResponseSpeedTrend from '@/components/dashboard/WeeklyResponseSpeedTrend'
import WonValueBySourceGrid from '@/components/dashboard/WonValueBySourceGrid'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardChartsResponse } from '@/lib/api'

type Props = {
  data?: DashboardChartsResponse
  isPending?: boolean
}

export default function DashboardChartsRow({ data, isPending }: Props) {
  if (isPending) {
    return (
      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] rounded-xl" />
        ))}
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <LostQuoteReasonChart data={data.lost_reasons} />
      <WonValueBySourceGrid data={data.won_by_source} />
      <WeeklyResponseSpeedTrend data={data.weekly_response} />
    </section>
  )
}
