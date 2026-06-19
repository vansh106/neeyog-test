'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { quotationsApi } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import {
  QUOTATION_CRM_LABELS,
  QUOTATION_CRM_STATUSES,
  type QuotationCrmStatus,
} from '@/lib/quotationCrmStatus'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { QuotationLineStatusProduct } from '@/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quotationId: string
  quoteNumber: string
  status: QuotationCrmStatus
  products: QuotationLineStatusProduct[]
}

export default function QuotationLineStatusInfoDialog({
  open,
  onOpenChange,
  quotationId,
  quoteNumber,
  status,
  products,
}: Props) {
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.APPROVE_QUOTATIONS))
  const [busyIndex, setBusyIndex] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<
    Record<number, { status: string; remarks: string }>
  >({})

  useEffect(() => {
    if (!open) return
    const next: Record<number, { status: string; remarks: string }> = {}
    for (const p of products) {
      next[p.line_index] = {
        status,
        remarks: p.status_remarks ?? '',
      }
    }
    setDrafts(next)
  }, [open, products, status])

  const saveLine = async (lineIndex: number) => {
    const draft = drafts[lineIndex]
    if (!draft) return
    if ((draft.status === 'lost' || draft.status === 'hold') && !draft.remarks.trim()) {
      window.alert('Add remarks for Lost or Hold before saving.')
      return
    }
    setBusyIndex(lineIndex)
    try {
      await quotationsApi.updateLineCrmStatus(quotationId, lineIndex, {
        status: draft.status,
        status_remarks:
          draft.status === 'lost' || draft.status === 'hold' ? draft.remarks.trim() : null,
      })
      await queryClient.invalidateQueries({ queryKey: ['quotations'] })
      onOpenChange(false)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyIndex(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{QUOTATION_CRM_LABELS[status]} products</DialogTitle>
          <DialogDescription>
            Quote {quoteNumber} — {products.length} line{products.length === 1 ? '' : 's'} in this
            status.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {products.map((p) => {
            const draft = drafts[p.line_index] ?? { status, remarks: p.status_remarks ?? '' }
            const showRemarks = draft.status === 'lost' || draft.status === 'hold'
            return (
              <li
                key={p.line_index}
                className="rounded-lg border border-[#E2E6DC] bg-[#FAFAF8] px-3 py-2.5"
              >
                <p className="text-[13px] font-medium text-gray-900">{p.label}</p>
                <p className="mt-0.5 text-[12px] text-surface-muted">
                  Qty {p.quantity}
                  {p.line_total > 0 ? ` · ${formatCurrency(p.line_total)}` : ''}
                </p>
                {p.status_remarks && !canEdit && (
                  <p className="mt-1 text-[11px] italic text-surface-muted">{p.status_remarks}</p>
                )}

                {canEdit && (
                  <div className="mt-2 space-y-1.5 border-t border-[#ECEEE8] pt-2">
                    <select
                      className="h-8 w-full rounded-md border border-[#E2E6DC] bg-white px-2 text-[12px]"
                      value={draft.status}
                      disabled={busyIndex === p.line_index}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [p.line_index]: { ...draft, status: e.target.value },
                        }))
                      }
                    >
                      {QUOTATION_CRM_STATUSES.map((v) => (
                        <option key={v} value={v}>
                          {QUOTATION_CRM_LABELS[v]}
                        </option>
                      ))}
                    </select>
                    {showRemarks && (
                      <textarea
                        value={draft.remarks}
                        disabled={busyIndex === p.line_index}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [p.line_index]: { ...draft, remarks: e.target.value },
                          }))
                        }
                        placeholder="Remarks (required)"
                        rows={2}
                        className="w-full resize-y rounded-md border border-[#E2E6DC] bg-white px-2 py-1.5 text-[11px]"
                      />
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      disabled={busyIndex === p.line_index}
                      onClick={() => void saveLine(p.line_index)}
                    >
                      {busyIndex === p.line_index ? 'Saving…' : 'Update status'}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
