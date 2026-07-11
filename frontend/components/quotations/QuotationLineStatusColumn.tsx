'use client'

import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'

import QuotationLineStatusInfoDialog from '@/components/quotations/QuotationLineStatusInfoDialog'
import { Button } from '@/components/ui/button'
import { collectQuotationLineProducts } from '@/lib/quotationLineStatusSummaries'
import {
  QUOTATION_LIST_DISPLAY_COLORS,
  quotationListDisplayLabel,
  resolveQuotationListDisplayStatus,
} from '@/lib/quotationListDisplayStatus'
import { cn } from '@/lib/utils'
import type { QuotationListItem } from '@/types'

type Props = {
  q: QuotationListItem
}

export default function QuotationLineStatusColumn({ q }: Props) {
  const [open, setOpen] = useState(false)
  const displayStatus = useMemo(() => resolveQuotationListDisplayStatus(q), [q])
  const products = useMemo(() => collectQuotationLineProducts(q), [q])

  if (!displayStatus || products.length === 0) {
    return <span className="text-[12px] text-surface-muted">—</span>
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-medium',
            QUOTATION_LIST_DISPLAY_COLORS[displayStatus],
          )}
        >
          {quotationListDisplayLabel(displayStatus)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7 shrink-0 text-surface-muted hover:text-gray-900"
          aria-label={`View product statuses for ${q.quote_number}`}
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
