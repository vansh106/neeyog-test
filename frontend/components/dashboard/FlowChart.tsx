'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts'
import type { EnquiryListItem } from '@/types'

const FLOW_ORDER = ['complete', 'incomplete', 'ambiguous', 'not_found'] as const

const FLOW_COLORS: Record<(typeof FLOW_ORDER)[number], string> = {
  complete: '#2A6B3C',
  incomplete: '#C8B400',
  ambiguous: '#d97706',
  not_found: '#dc2626',
}

const FLOW_LABELS: Record<(typeof FLOW_ORDER)[number], string> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  ambiguous: 'Ambiguous',
  not_found: 'Not found',
}

export default function FlowChart({ enquiries }: { enquiries: EnquiryListItem[] }) {
  const chartData = useMemo(() => {
    const counts: Record<(typeof FLOW_ORDER)[number], number> = {
      complete: 0,
      incomplete: 0,
      ambiguous: 0,
      not_found: 0,
    }
    for (const e of enquiries) {
      const f = e.flow_type
      if (f && f in counts) {
        counts[f as (typeof FLOW_ORDER)[number]] += 1
      }
    }
    return FLOW_ORDER.map((key) => ({
      key,
      name: FLOW_LABELS[key],
      value: counts[key],
      fill: FLOW_COLORS[key],
    })).filter((d) => d.value > 0)
  }, [enquiries])

  const hasData = chartData.length > 0

  return (
    <div className="bg-white border border-[#E2E6DC] rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5">
      <h2 className="text-[18px] font-semibold tracking-[-0.3px] text-gray-900 mb-4">Flow Distribution</h2>

      {!hasData ? (
        <div className="h-[220px] flex items-center justify-center text-[13px] text-surface-muted">
          No data yet
        </div>
      ) : (
        <div className="w-full h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-[12px] text-gray-700">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
