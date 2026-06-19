'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'

import QuotationLineStatusInfoDialog from '@/components/quotations/QuotationLineStatusInfoDialog'
import {
  lineStatusCountLabel,
  QUOTATION_CRM_COUNT_COLORS,
  type QuotationCrmStatus,
} from '@/lib/quotationCrmStatus'
import { resolveLineStatusSummaries } from '@/lib/quotationLineStatusSummaries'
import { cn } from '@/lib/utils'
import type { QuotationListItem } from '@/types'

type Props = {
  q: QuotationListItem
  status: QuotationCrmStatus
}

export default function QuotationLineStatusCell({ q, status }: Props) {
  const [open, setOpen] = useState(false)
  const summaries = resolveLineStatusSummaries(q)
  const block = summaries[status]
  const count = block?.count ?? 0
  const total = block?.total_lines ?? 0
  const products = block?.products ?? []

  if (count <= 0) {
    return <span className="text-[12px] text-surface-muted">—</span>
  }

  const label = lineStatusCountLabel(count, total, status)

  return (
    <>
      <div className="flex items-start gap-1">
        <span
          className={cn(
            'text-[12px] font-medium leading-snug',
            QUOTATION_CRM_COUNT_COLORS[status],
          )}
        >
          {label}
        </span>
        <button
          type="button"
          className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-surface-muted transition-colors hover:bg-[#ECEEE8] hover:text-gray-900"
          aria-label={`View ${status} products for ${q.quote_number}`}
          onClick={() => setOpen(true)}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </div>

      <QuotationLineStatusInfoDialog
        open={open}
        onOpenChange={setOpen}
        quotationId={q.quotation_id}
        quoteNumber={q.quote_number}
        status={status}
        products={products}
      />
    </>
  )
}
