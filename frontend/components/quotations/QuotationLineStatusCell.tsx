'use client'

import { useState } from 'react'

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
      <button
        type="button"
        className={cn(
          'text-left text-[12px] font-medium leading-snug underline-offset-2 hover:underline',
          QUOTATION_CRM_COUNT_COLORS[status],
        )}
        aria-label={`View ${status} products for ${q.quote_number}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>

      <QuotationLineStatusInfoDialog
        open={open}
        onOpenChange={setOpen}
        quotationId={q.quotation_id}
        quoteNumber={q.quote_number}
        products={products.map((p) => ({ ...p, status }))}
      />
    </>
  )
}
