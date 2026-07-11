'use client'

import { cn } from '@/lib/utils'
import ProductNotesEditor from '@/components/enquiries/ProductNotesEditor'
import type { ProductNoteEntry } from '@/lib/enquiryMasterNotes'

type Props = {
  productNotes: ProductNoteEntry[]
  onProductNotesChange: (next: ProductNoteEntry[]) => void
  className?: string
}

export default function EnquiryNotesField({
  productNotes,
  onProductNotesChange,
  className,
}: Props) {
  return (
    <section
      className={cn(
        'rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-green-200',
        className,
      )}
    >
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900">Product notes</h2>
        <p className="mt-1 text-[13px] text-surface-muted">
          Add one note per product. Pick family, category, and sub-category from masters, then
          describe that product&apos;s requirements.
        </p>
      </div>

      <ProductNotesEditor
        productNotes={productNotes}
        onProductNotesChange={onProductNotesChange}
        showPreview
        className="mt-4"
      />
    </section>
  )
}
