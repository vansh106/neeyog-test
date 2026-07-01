'use client'

import { useRouter } from 'next/navigation'

import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import type { ActionQueuesResponse } from '@/lib/api'

function dueBadgeClass(urgency: string): string {
  if (urgency === 'expired' || urgency === 'overdue' || urgency === 'today') {
    return 'bg-red-100 text-red-800 border-red-200'
  }
  if (urgency === 'soon') return 'bg-amber-100 text-amber-900 border-amber-200'
  if (urgency === 'none') return 'bg-gray-100 text-gray-600 border-gray-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function entityClass(entityType: string): string {
  if (entityType === 'enquiry') return 'bg-violet-50 text-violet-900 border-violet-200'
  return 'bg-sky-50 text-sky-900 border-sky-200'
}

function followUpHref(item: ActionQueuesResponse['follow_ups_due']['items'][number]): string {
  if (item.entity_type === 'enquiry') {
    return `/enquiries/${item.enquiry_id}`
  }
  return `/quotations/${item.quotation_id}`
}

type Props = {
  data: ActionQueuesResponse['follow_ups_due']
}

export default function FollowUpDueQueue({ data }: Props) {
  const router = useRouter()

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
      <div className="border-b border-[#E2E6DC] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-gray-900">
          Follow-up reminders ({data.count})
          {data.expired_count > 0 && (
            <span className="ml-1 font-semibold text-red-700">
              · {data.expired_count} expired
            </span>
          )}
          {data.pipeline_value > 0 && (
            <span className="ml-1 font-normal text-surface-muted">
              — {formatCompactINR(data.pipeline_value)} pipeline
            </span>
          )}
        </h3>
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {data.items.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-surface-muted">No follow-up reminders right now.</p>
        ) : (
          <ul className="divide-y divide-[#ECEEE8]">
            {data.items.map((item) => (
              <li key={`${item.entity_type}-${item.entity_id}`}>
                <button
                  type="button"
                  onClick={() => router.push(followUpHref(item))}
                  className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAF8F4]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-900 group-hover:text-brand-green-800 line-clamp-2">
                      {item.client_product}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          dueBadgeClass(item.due_urgency),
                        )}
                      >
                        {item.due_label}
                      </span>
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          entityClass(item.entity_type),
                        )}
                      >
                        {item.status_label}
                      </span>
                    </div>
                  </div>
                  {item.deal_value > 0 && (
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-gray-900">
                      {formatCompactINR(item.deal_value)}
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
