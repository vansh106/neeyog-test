'use client'

import QuotationCrmStatusEditor from '@/components/quotations/QuotationCrmStatusEditor'
import type { QuotationListItem } from '@/types'

/** @deprecated Use QuotationCrmStatusEditor with explicit props. */
export default function QuotationListStatusEditor({ q }: { q: QuotationListItem }) {
  return (
    <QuotationCrmStatusEditor
      quotationId={q.quotation_id}
      status={q.status}
      statusRemarks={q.status_remarks}
    />
  )
}
