'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import QuotationFormatPreview from '@/components/quotations/QuotationFormatPreview'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientConfig, useEnquiry, useQuotation } from '@/lib/queries'

type Props = {
  quotationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function QuotationPreviewDialog({ quotationId, open, onOpenChange }: Props) {
  const id = open && quotationId ? quotationId : ''
  const { data: quotation, isPending, isError } = useQuotation(id)
  const { data: clientConfig } = useClientConfig()
  const { data: linkedEnquiry } = useEnquiry(quotation?.enquiry_id ?? '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-5rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(56rem,calc(100vw-2.5rem))]">
        <DialogHeader className="border-b border-[#E2E6DC] px-6 py-4 text-left">
          <DialogTitle>
            {quotation?.quote_number ? `Quotation ${quotation.quote_number}` : 'Quotation preview'}
          </DialogTitle>
          <DialogDescription>
            Review the full quotation before selecting it for this purchase order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-[#F4F5F0] p-4 sm:p-6">
          {isPending && <Skeleton className="h-[520px] w-full rounded-xl" />}
          {isError && (
            <p className="text-[13px] text-red-600">Could not load quotation preview.</p>
          )}
          {!isPending && quotation && (
            <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-[#E2E6DC] bg-white p-4 shadow-sm sm:p-6">
              <QuotationFormatPreview
                quotation={quotation}
                clientConfig={clientConfig}
                linkedEnquiry={linkedEnquiry ?? null}
                pdfOverrides={quotation.pdf_display_overrides}
                notesPreviewText={quotation.notes ?? null}
                onOpenHistory={() => {}}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
