'use client'

import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'

import QuotationLineStatusInfoDialog from '@/components/quotations/QuotationLineStatusInfoDialog'
import { Button } from '@/components/ui/button'
import {
  collectQuotationLineProducts,
  resolveLineStatusSummaries,
} from '@/lib/quotationLineStatusSummaries'
import {
  lineStatusCountLabel,
  QUOTATION_CRM_COUNT_COLORS,
  QUOTATION_CRM_STATUSES,
} from '@/lib/quotationCrmStatus'
import { cn } from '@/lib/utils'
import type { QuotationListItem } from '@/types'

type Props = {
  q: QuotationListItem
}

export default function QuotationLineStatusColumn({ q }: Props) {
  const [open, setOpen] = useState(false)
  const summaries = useMemo(() => resolveLineStatusSummaries(q), [q])
  const products = useMemo(() => collectQuotationLineProducts(q), [q])

  const activeStatuses = QUOTATION_CRM_STATUSES.filter((status) => summaries[status].count > 0)

  if (products.length === 0) {
    return <span className="text-[12px] text-surface-muted">—</span>
  }

  return (
    <>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {activeStatuses.length === 0 ? (
            <span className="text-[12px] text-surface-muted">—</span>
          ) : (
            activeStatuses.map((status) => {
              const block = summaries[status]
              return (
                <span
                  key={status}
                  className={cn(
                    'text-[12px] font-medium leading-snug',
                    QUOTATION_CRM_COUNT_COLORS[status],
                  )}
                >
                  {lineStatusCountLabel(block.count, block.total_lines, status)}
                </span>
              )
            })
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7 shrink-0 text-surface-muted hover:text-gray-900"
          aria-label={`View and update product status for ${q.quote_number}`}
          onClick={() => setOpen(true)}
        >
          <Eye className="size-3.5" />
        </Button>
      </div>

      <QuotationLineStatusInfoDialog
        open={open}
        onOpenChange={setOpen}
        quotationId={q.quotation_id}
        quoteNumber={q.quote_number}
        products={products}
      />
    </>
  )
}
