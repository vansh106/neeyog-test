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
import QuotationLostRemarksFields from '@/components/quotations/QuotationLostRemarksFields'
import StatusBadge from '@/components/ui/StatusBadge'
import { quotationsApi } from '@/lib/api'
import {
  formatLostRemarks,
  lostRemarksValidationMessage,
  parseLostRemarks,
  type LostRemarksDraft,
} from '@/lib/quotationLostRemarks'
import { Permissions } from '@/lib/permissions'
import {
  isLineCrmStatusLocked,
  QUOTATION_CRM_LABELS,
  QUOTATION_CRM_STATUSES,
  type QuotationCrmStatus,
} from '@/lib/quotationCrmStatus'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { QuotationLineStatusProductRow } from '@/lib/quotationLineStatusSummaries'

type LineDraft = {
  status: string
  lostRemarks: LostRemarksDraft
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quotationId: string
  quoteNumber: string
  products: QuotationLineStatusProductRow[]
}

const emptyLostRemarks = (): LostRemarksDraft => ({
  reason1: '',
  other1: '',
})

export default function QuotationLineStatusInfoDialog({
  open,
  onOpenChange,
  quotationId,
  quoteNumber,
  products,
}: Props) {
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.APPROVE_QUOTATIONS))
  const [busyIndex, setBusyIndex] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>({})

  useEffect(() => {
    if (!open) return
    const next: Record<number, LineDraft> = {}
    for (const p of products) {
      next[p.line_index] = {
        status: p.status,
        lostRemarks: parseLostRemarks(p.status_remarks),
      }
    }
    setDrafts(next)
  }, [open, products])

  const saveLine = async (lineIndex: number) => {
    const product = products.find((p) => p.line_index === lineIndex)
    if (product && isLineCrmStatusLocked(product.status)) {
      return
    }
    const draft = drafts[lineIndex]
    if (!draft) return
    if (draft.status === 'lost') {
      const message = lostRemarksValidationMessage(draft.lostRemarks)
      if (message) {
        window.alert(message)
        return
      }
    }
    setBusyIndex(lineIndex)
    try {
      const remarks =
        draft.status === 'lost' ? formatLostRemarks(draft.lostRemarks) : null
      await quotationsApi.updateLineCrmStatus(quotationId, lineIndex, {
        status: draft.status,
        status_remarks: remarks,
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
          <DialogTitle>Product status</DialogTitle>
          <DialogDescription>
            Quote {quoteNumber} — {products.length} product{products.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {products.map((p) => {
            const draft = drafts[p.line_index] ?? {
              status: p.status,
              lostRemarks: parseLostRemarks(p.status_remarks),
            }
            const showRemarks = draft.status === 'lost'
            const locked = isLineCrmStatusLocked(p.status)
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
                {p.status_remarks && (!canEdit || locked) && (
                  <p className="mt-1 text-[11px] italic text-surface-muted">{p.status_remarks}</p>
                )}

                {canEdit && locked && (
                  <div className="mt-2 border-t border-[#ECEEE8] pt-2">
                    <StatusBadge status={p.status} kind="quotation_crm" />
                    <p className="mt-1 text-[11px] text-surface-muted">Status locked — only ongoing products can be updated.</p>
                  </div>
                )}

                {canEdit && !locked && (
                  <div className="mt-2 space-y-1.5 border-t border-[#ECEEE8] pt-2">
                    <select
                      className="h-8 w-full rounded-md border border-[#E2E6DC] bg-white px-2 text-[12px]"
                      value={draft.status}
                      disabled={busyIndex === p.line_index}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [p.line_index]: {
                            ...draft,
                            status: e.target.value,
                            lostRemarks:
                              e.target.value === 'lost' ? draft.lostRemarks : emptyLostRemarks(),
                          },
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
                      <QuotationLostRemarksFields
                        value={draft.lostRemarks}
                        disabled={busyIndex === p.line_index}
                        onChange={(lostRemarks) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [p.line_index]: { ...draft, lostRemarks },
                          }))
                        }
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
