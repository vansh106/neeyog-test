'use client'

import { Target } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatCompactINR } from '@/lib/formatCompactINR'

export type MonthlyBookingTargetTrackerProps = {
  monthLabel: string
  totalTarget: number
  achievedValue: number
  pctAchieved: number
  expectedPacePct: number
  workingDaysLeft: number
  requiredDailyPace: number
  className?: string
}

export default function MonthlyBookingTargetTracker({
  monthLabel,
  totalTarget,
  achievedValue,
  pctAchieved,
  expectedPacePct,
  workingDaysLeft,
  requiredDailyPace,
  className,
}: MonthlyBookingTargetTrackerProps) {
  const fillPct = Math.min(Math.max(pctAchieved, 0), 100)
  const markerPct = Math.min(Math.max(expectedPacePct, 0), 100)
  const isBehind = pctAchieved < expectedPacePct

  const fillColor = isBehind ? 'bg-amber-500' : 'bg-brand-green-600'

  return (
    <div
      className={cn(
        'rounded-xl border border-[#E2E6DC] bg-white p-4 sm:p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="size-4 shrink-0 text-brand-green-700" aria-hidden />
          <h2 className="text-[15px] font-semibold text-gray-900 truncate">
            {monthLabel} booking target
          </h2>
        </div>
        <p className="text-[13px] text-surface-muted shrink-0">
          {formatCompactINR(achievedValue)} of {formatCompactINR(totalTarget)}
          <span className="mx-1.5 text-gray-300" aria-hidden>
            ·
          </span>
          {workingDaysLeft} working day{workingDaysLeft === 1 ? '' : 's'} left
        </p>
      </div>

      <div className="relative mt-4 h-3 w-full rounded-full bg-[#E8EBE3]">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', fillColor)}
          style={{ width: `${fillPct}%` }}
          role="progressbar"
          aria-valuenow={pctAchieved}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pctAchieved}% of monthly booking target achieved`}
        />
        <div
          className="absolute top-1/2 z-10 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gray-900"
          style={{ left: `calc(${markerPct}% - 1px)` }}
          aria-hidden
          title={`Expected month pace: ${expectedPacePct}%`}
        />
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-surface-muted">
        <span className="font-medium text-gray-800">{pctAchieved}% achieved</span>
        <span className="mx-1.5 text-gray-300" aria-hidden>
          ·
        </span>
        marker = expected month pace ({expectedPacePct}%)
        {isBehind && requiredDailyPace > 0 && (
          <>
            <span className="mx-1.5 text-gray-300" aria-hidden>
              ·
            </span>
            need {formatCompactINR(requiredDailyPace)}/day to close gap
          </>
        )}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
        <div className="rounded-lg border border-surface-border bg-surface-page/50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-muted">Achieved vs total</p>
          <p className="mt-0.5 font-semibold text-gray-900">
            {formatCompactINR(achievedValue)} / {formatCompactINR(totalTarget)}
          </p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-page/50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-muted">Working days left</p>
          <p className="mt-0.5 font-semibold text-gray-900">
            {workingDaysLeft} day{workingDaysLeft === 1 ? '' : 's'} left
          </p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-page/50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-muted">Required daily pace</p>
          <p className="mt-0.5 font-semibold text-gray-900">
            {requiredDailyPace > 0 ? `${formatCompactINR(requiredDailyPace)}/day needed` : 'On track'}
          </p>
        </div>
      </div>
    </div>
  )
}
