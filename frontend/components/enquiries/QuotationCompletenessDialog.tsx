'use client'

import { useState } from 'react'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  ENQUIRY_QUOTE_STATUS_LABELS,
  type EnquiryQuoteStatus,
} from '@/lib/enquiryQuoteStatus'
import { cn } from '@/lib/utils'

type QuoteCompletenessChoice = Extract<EnquiryQuoteStatus, 'quoted' | 'partially_quoted'>

const OPTIONS: {
  value: QuoteCompletenessChoice
  title: string
  description: string
  icon: typeof CheckCircle2
}[] = [
  {
    value: 'quoted',
    title: 'Fully complete',
    description: 'All requested products are quoted. Marks the enquiry as Quoted.',
    icon: CheckCircle2,
  },
  {
    value: 'partially_quoted',
    title: 'Partially complete',
    description: 'Some items are still pending or TBD. Marks the enquiry as Partially Quoted.',
    icon: CircleDashed,
  },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (status: QuoteCompletenessChoice) => void
  busy?: boolean
}

export default function QuotationCompletenessDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: Props) {
  const [choice, setChoice] = useState<QuoteCompletenessChoice>('quoted')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quotation completeness</DialogTitle>
          <DialogDescription>
            How complete is this quotation? Your choice updates the enquiry&apos;s quote status in the
            listing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const selected = choice === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={busy}
                onClick={() => setChoice(opt.value)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  selected
                    ? 'border-brand-green-500 bg-brand-green-50/60 ring-1 ring-brand-green-500/30'
                    : 'border-[#E2E6DC] bg-white hover:bg-[#FAFAF8]',
                  busy && 'cursor-not-allowed opacity-60',
                )}
              >
                <Icon
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    selected ? 'text-brand-green-600' : 'text-[#8A9488]',
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-gray-900">{opt.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-surface-muted">
                    {opt.description}
                  </span>
                  <span className="mt-1.5 inline-block text-[11px] font-medium text-brand-green-700">
                    → {ENQUIRY_QUOTE_STATUS_LABELS[opt.value]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="bg-brand-green-600 hover:bg-brand-green-700"
            onClick={() => onConfirm(choice)}
          >
            {busy ? 'Generating…' : 'Generate quotation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
