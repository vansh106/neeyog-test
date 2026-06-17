'use client'

import { useMemo, useState } from 'react'

import DashboardActionFunnelRow from '@/components/dashboard/DashboardActionFunnelRow'
import DashboardChartsRow from '@/components/dashboard/DashboardChartsRow'
import DashboardTrendsRow from '@/components/dashboard/DashboardTrendsRow'
import PipelineRegister from '@/components/dashboard/PipelineRegister'
import DashboardKpiRow from '@/components/dashboard/DashboardKpiRow'
import MonthlyBookingTargetTracker from '@/components/dashboard/MonthlyBookingTargetTracker'
import PageShell from '@/components/layout/PageShell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useActionQueues,
  useBookingTargetTracker,
  useDashboardCharts,
  useDashboardKpis,
  usePipelineRegister,
  useSalesFunnel,
  useTeamUsers,
} from '@/lib/queries'
import { useAuthStore } from '@/stores/authStore'

const ORG_SCOPE = '__org__'

export default function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.isAdminOrAbove())
  const [scopeUserId, setScopeUserId] = useState<string>(ORG_SCOPE)

  const { data: teamUsers = [] } = useTeamUsers(false)

  const selectableUsers = useMemo(
    () =>
      (teamUsers as Array<{ id: string; full_name: string; tier: string; is_active: boolean }>)
        .filter((u) => u.is_active && u.tier !== 'superadmin')
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [teamUsers],
  )

  const userIdParam = isAdmin && scopeUserId !== ORG_SCOPE ? scopeUserId : undefined

  const {
    data: bookingData,
    isPending: bookingPending,
    isError: bookingError,
    error: bookingErr,
  } = useBookingTargetTracker(userIdParam)

  const {
    data: kpiData,
    isPending: kpiPending,
    isError: kpiError,
    error: kpiErr,
  } = useDashboardKpis(userIdParam)

  const {
    data: actionQueueData,
    isPending: actionQueuePending,
    isError: actionQueueError,
    error: actionQueueErr,
  } = useActionQueues(userIdParam)

  const {
    data: funnelData,
    isPending: funnelPending,
    isError: funnelError,
    error: funnelErr,
  } = useSalesFunnel(userIdParam)

  const {
    data: chartsData,
    isPending: chartsPending,
    isError: chartsError,
    error: chartsErr,
  } = useDashboardCharts(userIdParam)

  const {
    data: pipelineData,
    isPending: pipelinePending,
    isError: pipelineError,
    error: pipelineErr,
  } = usePipelineRegister(userIdParam)

  const loading = bookingPending || kpiPending
  const actionFunnelPending = actionQueuePending || funnelPending
  const hasError =
    bookingError || kpiError || actionQueueError || funnelError || chartsError || pipelineError
  const error = bookingErr ?? kpiErr ?? actionQueueErr ?? funnelErr ?? chartsErr ?? pipelineErr

  const scopeSelector = isAdmin ? (
    <Select value={scopeUserId} onValueChange={setScopeUserId}>
      <SelectTrigger className="w-[220px] bg-white">
        <SelectValue placeholder="View analytics for…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ORG_SCOPE}>Whole organization</SelectItem>
        {selectableUsers.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : undefined

  return (
    <PageShell title="Dashboard" actions={scopeSelector}>
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-[220px] w-full rounded-xl border border-[#E2E6DC] bg-white/80" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-xl border border-[#E2E6DC] bg-[#FAF8F4]/80" />
            ))}
          </div>
        </div>
      )}

      {hasError && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900">
          {error instanceof Error ? error.message : 'Failed to load dashboard analytics'}
        </div>
      )}

      {!loading && bookingData && (
        <MonthlyBookingTargetTracker
          monthLabel={bookingData.month_label}
          totalTarget={bookingData.total_target}
          achievedValue={bookingData.achieved_value}
          pctAchieved={bookingData.pct_achieved}
          expectedPacePct={bookingData.expected_pace_pct}
          workingDaysLeft={bookingData.working_days_left}
          requiredDailyPace={bookingData.required_daily_pace}
        />
      )}

      {!loading && kpiData && <DashboardKpiRow data={kpiData} />}

      <DashboardActionFunnelRow
        actionQueueData={actionQueueData}
        funnelData={funnelData}
        isPending={actionFunnelPending}
      />

      <DashboardChartsRow data={chartsData} isPending={chartsPending} />

      <DashboardTrendsRow data={chartsData} isPending={chartsPending} />

      {pipelinePending && (
        <section className="mt-4">
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </section>
      )}

      {pipelineData && !pipelinePending && (
        <PipelineRegister data={pipelineData} userId={userIdParam} />
      )}
    </PageShell>
  )
}
