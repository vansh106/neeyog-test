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
  if (urgency === 'expired' || urgency === 'overdue' || urgency === 'today') {
    return 'text-red-700 font-medium'
  }
  if (urgency === 'none') return 'text-red-600 font-medium'
  return 'text-amber-800'
}

function followUpHref(item: ActionQueuesResponse['follow_ups_due']['items'][number]): string {
  if (item.entity_type === 'enquiry') {
    return `/enquiries/${item.enquiry_id}`
  }
  return `/quotations/${item.quotation_id}`
}

type Props = {
  data: ActionQueuesResponse
  className?: string
}

export default function ActionQueueCard({ data, className }: Props) {
  const router = useRouter()
  const { incomplete_enquiries: incomplete, follow_ups_due: followUps, so_dates_pending: soPending } =
    data

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

      <div className="max-h-[420px] overflow-y-auto">
        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-muted">
            Not quoted enquiries · {incomplete.count}
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
            Follow-up reminders · {followUps.count}
            {followUps.expired_count > 0 && (
              <span className="text-red-700"> · {followUps.expired_count} expired</span>
            )}
            {followUps.pipeline_value > 0 && (
              <span> · {formatCompactINR(followUps.pipeline_value)}</span>
            )}
          </p>
        </div>
        {followUps.items.length === 0 ? (
          <p className="px-4 pb-3 text-[12px] text-surface-muted">None right now.</p>
        ) : (
          <ul className="divide-y divide-[#ECEEE8]">
            {followUps.items.map((item) => (
              <li key={`${item.entity_type}-${item.entity_id}`}>
                <button
                  type="button"
                  onClick={() => router.push(followUpHref(item))}
                  className="group flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[#FAF8F4]"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900 group-hover:text-brand-green-800">
                    {item.client_product}
                  </span>
                  <span
                    className={cn(
                      'hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase sm:inline',
                      item.entity_type === 'enquiry'
                        ? 'bg-violet-50 text-violet-800'
                        : 'bg-sky-50 text-sky-800',
                    )}
                  >
                    {item.status_label}
                  </span>
                  <span className={cn('shrink-0 max-w-[45%] truncate text-right text-[11px]', dueTextClass(item.due_urgency))}>
                    {item.due_urgency === 'expired' ? (
                      <span className="inline-flex items-center gap-0.5">
                        {item.due_label} <AlertTriangle className="size-3 shrink-0" aria-hidden />
                      </span>
                    ) : (
                      item.due_label
                    )}
                  </span>
                  {item.deal_value > 0 && (
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-gray-900">
                      {formatCompactINR(item.deal_value)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mx-4 border-t border-[#ECEEE8]" />

        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-muted">
            SO date pending · {soPending.count}
          </p>
        </div>
        {soPending.items.length === 0 ? (
          <p className="px-4 pb-4 text-[12px] text-surface-muted">None right now.</p>
        ) : (
          <ul className="divide-y divide-[#ECEEE8] pb-2">
            {soPending.items.map((item) => (
              <li key={item.po_id}>
                <button
                  type="button"
                  onClick={() => router.push('/purchase-orders')}
                  className="group flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[#FAF8F4]"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900 group-hover:text-brand-green-800">
                    {item.po_number} · {item.client_name}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-amber-800">
                    {item.due_label}
                  </span>
                  {item.total_amount > 0 && (
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-gray-900">
                      {formatCompactINR(item.total_amount)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
