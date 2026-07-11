'use client'

import { Triangle } from 'lucide-react'
import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type KpiTrend = {
  label: string
  direction: 'up' | 'down' | 'flat'
  sentiment: 'positive' | 'negative' | 'neutral'
}

export type DashboardKpiCardProps = {
  title: string
  primaryValue: ReactNode
  secondaryText?: string
  trend?: KpiTrend
  progressPct?: number
  className?: string
}

function trendColors(sentiment: KpiTrend['sentiment']) {
  if (sentiment === 'positive') return 'text-emerald-700'
  if (sentiment === 'negative') return 'text-red-700'
  return 'text-gray-500'
}

export default function DashboardKpiCard({
  title,
  primaryValue,
  secondaryText,
  trend,
  progressPct,
  className,
}: DashboardKpiCardProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-[#E2E6DC] bg-[#FAF8F4] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-5',
        className,
      )}
    >
      <p className="text-[12px] font-medium text-[#8A9488]">{title}</p>

      <div className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.5px] text-gray-900 sm:text-[28px]">
        {primaryValue}
      </div>

      {typeof progressPct === 'number' && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E8EBE3]">
          <div
            className="h-full rounded-full bg-brand-green-600 transition-all duration-500"
            style={{ width: `${Math.min(Math.max(progressPct, 0), 100)}%` }}
          />
        </div>
      )}

      {(trend || secondaryText) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-snug">
          {trend && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', trendColors(trend.sentiment))}>
              {trend.direction !== 'flat' && (
                <Triangle
                  className={cn(
                    'size-2.5 fill-current',
                    trend.direction === 'down' && 'rotate-180',
                  )}
                  aria-hidden
                />
              )}
              {trend.label}
            </span>
          )}
          {secondaryText && (
            <span className={cn('text-[#6B7369]', trend && 'text-[#8A9488]')}>{secondaryText}</span>
          )}
        </div>
      )}
    </div>
  )
}
