'use client'

import {
  AlertTriangle,
  CircleHelp,
  FileSearch,
  FileText,
  Layers,
  UserRoundX,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { agingBadgeClass, agingTier, formatAgingDays } from '@/lib/agingBadge'
import { cn } from '@/lib/utils'
import type { ActionQueuesResponse } from '@/lib/api'

const ACTION_META: Record<
  string,
  { icon: LucideIcon; chipClass: string }
> = {
  identify_spec: {
    icon: FileSearch,
    chipClass: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  quote_pending: {
    icon: FileText,
    chipClass: 'border-sky-300 bg-sky-50 text-sky-900',
  },
  match_incomplete: {
    icon: Layers,
    chipClass: 'border-violet-300 bg-violet-50 text-violet-900',
  },
  unidentified_sender: {
    icon: UserRoundX,
    chipClass: 'border-rose-300 bg-rose-50 text-rose-900',
  },
  missing_fields: {
    icon: AlertTriangle,
    chipClass: 'border-orange-300 bg-orange-50 text-orange-900',
  },
  resolve_ambiguity: {
    icon: CircleHelp,
    chipClass: 'border-sky-300 bg-sky-50 text-sky-900',
  },
}

type Props = {
  data: ActionQueuesResponse['incomplete_enquiries']
}

export default function IncompleteEnquiriesQueue({ data }: Props) {
  const router = useRouter()

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
      <div className="border-b border-[#E2E6DC] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-gray-900">
          Not Quoted Enquiries ({data.count})
        </h3>
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {data.items.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-surface-muted">No not-quoted enquiries right now.</p>
        ) : (
          <ul className="divide-y divide-[#ECEEE8]">
            {data.items.map((item) => {
              const meta = ACTION_META[item.action_type] ?? ACTION_META.identify_spec
              const Icon = meta.icon
              const tier = agingTier(item.aging_days)

              return (
                <li key={item.enquiry_id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/enquiries/${item.enquiry_id}`)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAF8F4]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-gray-900 group-hover:text-brand-green-800 line-clamp-2">
                        {item.subject}
                      </p>
                      <span
                        className={cn(
                          'mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          meta.chipClass,
                        )}
                      >
                        <Icon className="size-3 shrink-0" aria-hidden />
                        {item.required_action}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
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
      </div>
    </div>
  )
}
