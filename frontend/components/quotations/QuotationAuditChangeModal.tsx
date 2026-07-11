'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { QuotationAuditChangeView, QuotationAuditItem, QuotationAuditSection } from '@/types'
import { cn } from '@/lib/utils'
import { resolveAuditChangeView } from '@/lib/quotationAuditDiff'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: QuotationAuditItem | null
}

function isRowHighlighted(
  section: QuotationAuditSection,
  rowKey: string,
  changedKeys: Set<string>,
): boolean {
  if (section.highlight_all) return true
  return changedKeys.has(rowKey)
}

function AuditColumn({
  title,
  sections,
  changedKeys,
  side,
}: {
  title: string
  sections: QuotationAuditSection[]
  changedKeys: Set<string>
  side: 'before' | 'after'
}) {
  const highlightClass =
    side === 'before' ? 'bg-red-50 ring-1 ring-red-100' : 'bg-green-50 ring-1 ring-green-100'

  return (
    <div className="flex min-h-[280px] min-w-0 flex-1 flex-col rounded-lg border border-[#E2E6DC] bg-white">
      <div className="border-b border-[#E2E6DC] px-4 py-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8A9488]">{title}</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {sections.length === 0 ? (
          <p className="text-[13px] text-surface-muted">No data recorded.</p>
        ) : (
          sections.map((section, idx) => (
            <div key={`${section.title}-${idx}`} className="space-y-2">
              <p className="text-[12px] font-semibold text-gray-900">{section.title}</p>
              <div className="overflow-hidden rounded-md border border-[#E2E6DC]">
                {section.rows.map((row) => {
                  const highlighted = isRowHighlighted(section, row.key, changedKeys)
                  return (
                    <div
                      key={row.key}
                      className={cn(
                        'grid grid-cols-[minmax(6rem,38%)_1fr] gap-2 border-b border-[#E2E6DC] px-3 py-2 text-[12px] last:border-b-0',
                        highlighted && highlightClass,
                      )}
                    >
                      <span className="font-medium text-[#8A9488]">{row.label}</span>
                      <span className="min-w-0 break-words text-gray-900">{row.value || '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function QuotationAuditChangeModal({ open, onOpenChange, item }: Props) {
  const changeView: QuotationAuditChangeView | null = item ? resolveAuditChangeView(item) : null
  const changedKeys = new Set(changeView?.changed_keys ?? [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-[#E2E6DC] px-6 py-4 text-left">
          <DialogTitle>Change details</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {item?.summary ?? 'Quotation edit'}
            {item?.user_name || item?.user ? (
              <> · {item.user_name || item.user}</>
            ) : null}
            {item?.at ? <> · {new Date(item.at).toLocaleString('en-IN')}</> : null}
          </DialogDescription>
        </DialogHeader>

        {!changeView ||
        ((changeView.before.sections?.length ?? 0) === 0 &&
          (changeView.after.sections?.length ?? 0) === 0) ? (
          <div className="px-6 py-8">
            <p className="text-[13px] text-surface-muted">
              Detailed before/after data is not available for this edit.
            </p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-6 lg:grid-cols-2">
            <AuditColumn
              title="Before"
              sections={changeView.before.sections}
              changedKeys={changedKeys}
              side="before"
            />
            <AuditColumn
              title="After"
              sections={changeView.after.sections}
              changedKeys={changedKeys}
              side="after"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
