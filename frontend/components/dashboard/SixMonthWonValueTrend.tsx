'use client'

import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import type { DashboardChartsResponse } from '@/lib/api'

type Props = {
  data: DashboardChartsResponse['won_value_trend']
  className?: string
}

export default function SixMonthWonValueTrend({ data, className }: Props) {
  const chartData = useMemo(
    () =>
      data.months.map((m) => ({
        ...m,
        label: m.month_label,
      })),
    [data.months],
  )

  const yMax = useMemo(() => {
    const vals = chartData.map((d) => d.won_value)
    const max = Math.max(...vals, 1)
    return Math.ceil(max * 1.12)
  }, [chartData])

  const hasData = chartData.some((d) => d.won_value > 0)

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold text-gray-900">6-month won value trend</h3>
      <p className="mt-0.5 text-[11px] text-surface-muted">Monthly PO revenue (₹)</p>

      {!hasData ? (
        <p className="mt-6 text-[13px] text-surface-muted">No won revenue in the last 6 months.</p>
      ) : (
        <div className="mt-3 h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="wonValueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2A6B3C" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#2A6B3C" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                tickFormatter={(v) => formatCompactINR(v).replace('₹', '')}
                width={44}
              />
              <Tooltip
                formatter={(value) => [formatCompactINR(Number(value ?? 0)), 'Won value']}
                labelFormatter={(label) => label}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #E2E6DC',
                }}
              />
              <Area
                type="monotone"
                dataKey="won_value"
                stroke="none"
                fill="url(#wonValueGradient)"
              />
              <Line
                type="monotone"
                dataKey="won_value"
                stroke="#2A6B3C"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  if (cx == null || cy == null) return null
                  const isCurrent = payload?.is_current
                  return (
                    <g key={`${payload?.month_label}-${payload?.year}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isCurrent ? 7 : 4}
                        fill={isCurrent ? '#2A6B3C' : '#fff'}
                        stroke="#2A6B3C"
                        strokeWidth={2}
                      />
                      {isCurrent && payload?.won_value > 0 && (
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={600}
                          fill="#2A6B3C"
                        >
                          {formatCompactINR(payload.won_value)}
                        </text>
                      )}
                    </g>
                  )
                }}
                activeDot={{ r: 6, fill: '#2A6B3C' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
