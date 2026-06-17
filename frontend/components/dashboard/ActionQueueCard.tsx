'use client'

import {
  AlertTriangle,
  CircleHelp,
  FileSearch,
  Info,
  Layers,
  UserRoundX,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { agingBadgeClass, agingTier, formatAgingDays } from '@/lib/agingBadge'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import type { ActionQueuesResponse } from '@/lib/api'

const ACTION_META: Record<string, { icon: LucideIcon; chipClass: string }> = {
  identify_spec: { icon: FileSearch, chipClass: 'text-amber-800' },
  match_incomplete: { icon: Layers, chipClass: 'text-violet-800' },
  unidentified_sender: { icon: UserRoundX, chipClass: 'text-rose-800' },
  missing_fields: { icon: AlertTriangle, chipClass: 'text-orange-800' },
  resolve_ambiguity: { icon: CircleHelp, chipClass: 'text-sky-800' },
}

function dueTextClass(urgency: string): string {
  if (urgency === 'overdue' || urgency === 'today') return 'text-red-700 font-medium'
  if (urgency === 'none') return 'text-red-600 font-medium'
  return 'text-amber-800'
}

type Props = {
  data: ActionQueuesResponse
  className?: string
}

export default function ActionQueueCard({ data, className }: Props) {
  const router = useRouter()
  const { incomplete_enquiries: incomplete, follow_ups_due: followUps } = data

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[#E2E6DC] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-gray-900">Action queue</h3>
        <Info className="size-3.5 text-surface-muted" aria-hidden />
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-muted">
            Incomplete enquiries · {incomplete.count}
          </p>
        </div>
        {incomplete.items.length === 0 ? (
          <p className="px-4 pb-3 text-[12px] text-surface-muted">None right now.</p>
        ) : (
          <ul className="divide-y divide-[#ECEEE8]">
            {incomplete.items.map((item) => {
              const meta = ACTION_META[item.action_type] ?? ACTION_META.identify_spec
              const Icon = meta.icon
              const tier = agingTier(item.aging_days)
              return (
                <li key={item.enquiry_id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/enquiries/${item.enquiry_id}`)}
                    className="group flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[#FAF8F4]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900 group-hover:text-brand-green-800">
                      {item.subject}
                    </span>
                    <span
                      className={cn(
                        'hidden shrink-0 items-center gap-1 text-[11px] sm:inline-flex',
                        meta.chipClass,
                      )}
                    >
                      <Icon className="size-3" aria-hidden />
                      {item.required_action}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                        agingBadgeClass(tier),
                      )}
                    >
                      {formatAgingDays(item.aging_days)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mx-4 border-t border-[#ECEEE8]" />

        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-muted">
            Follow-up due · {followUps.count}
            {followUps.pipeline_value > 0 && (
              <span> · {formatCompactINR(followUps.pipeline_value)}</span>
            )}
          </p>
        </div>
        {followUps.items.length === 0 ? (
          <p className="px-4 pb-4 text-[12px] text-surface-muted">None right now.</p>
        ) : (
          <ul className="divide-y divide-[#ECEEE8] pb-2">
            {followUps.items.map((item) => (
              <li key={item.quotation_id}>
                <button
                  type="button"
                  onClick={() => router.push(`/quotations/${item.quotation_id}`)}
                  className="group flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[#FAF8F4]"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900 group-hover:text-brand-green-800">
                    {item.client_product}
                  </span>
                  <span className={cn('shrink-0 text-[11px]', dueTextClass(item.due_urgency))}>
                    {item.due_urgency === 'none' ? (
                      <span className="inline-flex items-center gap-0.5">
                        No date set <AlertTriangle className="size-3" aria-hidden />
                      </span>
                    ) : (
                      item.due_label
                    )}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-gray-900">
                    {formatCompactINR(item.deal_value)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
