'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatResponseHours } from '@/lib/formatResponseHours'
import { cn } from '@/lib/utils'
import type { DashboardChartsResponse } from '@/lib/api'

type Props = {
  data: DashboardChartsResponse['weekly_response']
  className?: string
}

export default function WeeklyResponseSpeedTrend({ data, className }: Props) {
  const chartData = useMemo(
    () =>
      data.weeks.map((w) => ({
        ...w,
        label: w.week_label,
      })),
    [data.weeks],
  )

  const yMax = useMemo(() => {
    const vals = chartData.map((d) => d.avg_hours)
    const target = data.target_hours ?? 0
    const max = Math.max(...vals, target, 1)
    return Math.ceil(max * 1.15)
  }, [chartData, data.target_hours])

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold text-gray-900">Weekly response speed trend</h3>
      <p className="mt-0.5 text-[11px] text-surface-muted">Average enquiry-to-quote time (hours)</p>

      {chartData.length === 0 ? (
        <p className="mt-6 text-[13px] text-surface-muted">Not enough quote data this month.</p>
      ) : (
        <div className="mt-3 h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#E8EBE3" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6B7369' }}
                axisLine={{ stroke: '#E2E6DC' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, yMax]}
                tick={{ fontSize: 11, fill: '#6B7369' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}h`}
                width={36}
              />
              {data.target_hours != null && data.target_hours > 0 && (
                <ReferenceLine
                  y={data.target_hours}
                  stroke="#C8B400"
                  strokeDasharray="4 4"
                  label={{
                    value: `${data.target_hours}h target`,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: '#857600',
                  }}
                />
              )}
              <Tooltip
                formatter={(value) => [formatResponseHours(Number(value ?? 0)), 'Avg response']}
                labelFormatter={(label) => label}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #E2E6DC',
                }}
              />
              <Line
                type="monotone"
                dataKey="avg_hours"
                stroke="#2A6B3C"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  const isMilestone = payload?.is_milestone
                  return (
                    <circle
                      key={payload?.week_label}
                      cx={cx}
                      cy={cy}
                      r={isMilestone ? 6 : 4}
                      fill={isMilestone ? '#2A6B3C' : '#fff'}
                      stroke="#2A6B3C"
                      strokeWidth={2}
                    />
                  )
                }}
                activeDot={{ r: 6, fill: '#2A6B3C' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.milestone_hours != null && data.milestone_week != null && (
        <p className="mt-2 text-[11px] text-surface-muted">
          Best week: W{data.milestone_week} at {formatResponseHours(data.milestone_hours)}
        </p>
      )}
    </div>
  )
}
