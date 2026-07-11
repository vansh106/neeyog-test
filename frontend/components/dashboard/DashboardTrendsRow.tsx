'use client'

import CategoryPerformanceMatrix from '@/components/dashboard/CategoryPerformanceMatrix'
import SixMonthWonValueTrend from '@/components/dashboard/SixMonthWonValueTrend'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardChartsResponse } from '@/lib/api'

type Props = {
  data?: DashboardChartsResponse
  isPending?: boolean
}

export default function DashboardTrendsRow({ data, isPending }: Props) {
  if (isPending) {
    return (
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-[300px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[300px] rounded-xl lg:col-span-2" />
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
      <SixMonthWonValueTrend data={data.won_value_trend} className="lg:col-span-3" />
      <CategoryPerformanceMatrix data={data.category_performance} className="lg:col-span-2" />
    </section>
  )
}
