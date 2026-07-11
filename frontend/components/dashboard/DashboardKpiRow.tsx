'use client'

import DashboardKpiCard from '@/components/dashboard/DashboardKpiCard'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { formatResponseHours } from '@/lib/formatResponseHours'
import type { DashboardKpisResponse } from '@/lib/api'

type DashboardKpiRowProps = {
  data: DashboardKpisResponse
}

function momTrend(pct: number, compareMonth: string) {
  const rounded = Math.abs(pct)
  const display = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1).replace(/\.0$/, '')
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  const direction = pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const
  const sentiment = pct > 0 ? 'positive' as const : pct < 0 ? 'negative' as const : 'neutral' as const
  return {
    label: `${sign}${display}% vs ${compareMonth}`,
    direction,
    sentiment,
  }
}

function ptsTrend(pts: number, compareMonth: string) {
  const rounded = Math.abs(pts)
  const display = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1).replace(/\.0$/, '')
  const sign = pts > 0 ? '+' : pts < 0 ? '−' : ''
  const direction = pts > 0 ? 'up' as const : pts < 0 ? 'down' as const : 'flat' as const
  const sentiment = pts > 0 ? 'positive' as const : pts < 0 ? 'negative' as const : 'neutral' as const
  return {
    label: `${sign}${display} pts vs ${compareMonth}`,
    direction,
    sentiment,
  }
}

export default function DashboardKpiRow({ data }: DashboardKpiRowProps) {
  const { quoted_value, po_received, win_rate, avg_response, compare_month_label } = data

  const quotedTrend = momTrend(quoted_value.mom_pct_change, compare_month_label)
  const winRateTrend = ptsTrend(win_rate.pts_change, compare_month_label)

  const hasWeek1 = avg_response.week1_hours != null && avg_response.hours != null
  const responseImproved = hasWeek1 && avg_response.hours! < avg_response.week1_hours!
  const responseTrend = hasWeek1
    ? {
        label: `from ${formatResponseHours(avg_response.week1_hours!)} in W1`,
        direction: responseImproved ? ('down' as const) : ('up' as const),
        sentiment: responseImproved ? ('positive' as const) : ('negative' as const),
      }
    : undefined

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardKpiCard
        title="Quoted value"
        primaryValue={formatCompactINR(quoted_value.total)}
        secondaryText={`${quoted_value.count} quote${quoted_value.count === 1 ? '' : 's'}`}
        trend={quotedTrend}
      />

      <DashboardKpiCard
        title="PO received"
        primaryValue={formatCompactINR(po_received.total)}
        secondaryText={`${po_received.count} PO${po_received.count === 1 ? '' : 's'}`}
      />

      <DashboardKpiCard
        title="Win rate (value)"
        primaryValue={`${win_rate.pct}%`}
        progressPct={win_rate.pct}
        trend={winRateTrend}
      />

      <DashboardKpiCard
        title="Avg response"
        primaryValue={
          avg_response.hours != null ? formatResponseHours(avg_response.hours) : '—'
        }
        trend={responseTrend}
      />
    </div>
  )
}
