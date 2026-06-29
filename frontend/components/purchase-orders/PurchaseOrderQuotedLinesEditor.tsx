'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import PoQuotedLineNegotiationFields from '@/components/purchase-orders/PoQuotedLineNegotiationFields'
import { purchaseOrdersApi } from '@/lib/api'
import { invalidateQuotationCrmCaches } from '@/lib/invalidateQuotationCrmCaches'
import {
  buildQuotedLineStateFromPo,
  quotedLineStateToPayload,
  type QuotedLineState,
} from '@/lib/poQuotedLines'
import { cn, formatCurrency } from '@/lib/utils'
import type { PurchaseOrder, Quotation, QuotationLineItem } from '@/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  po: PurchaseOrder
  quotation: Quotation | undefined
  quotationLoading?: boolean
  onSaved: (po: PurchaseOrder) => void
}

function lineTitle(line: QuotationLineItem): string {
  const name = (line.product_name || line.description || 'Product').split('\n')[0]
  return name.slice(0, 120)
}

export default function PurchaseOrderQuotedLinesEditor({
  open,
  onOpenChange,
  po,
  quotation,
  quotationLoading = false,
  onSaved,
}: Props) {
  const queryClient = useQueryClient()
  const quoteLines = useMemo(
    () => (quotation?.line_items ?? []) as QuotationLineItem[],
    [quotation],
  )
  const [lineState, setLineState] = useState<Record<number, QuotedLineState>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !quotation) return
    setLineState(buildQuotedLineStateFromPo(po, quoteLines))
    setError(null)
  }, [open, po, quotation, quoteLines])

  const selectedLines = useMemo(() => quotedLineStateToPayload(lineState), [lineState])

  const itemTotal = useMemo(
    () => selectedLines.reduce((sum, row) => sum + row.quantity * row.unit_price, 0),
    [selectedLines],
  )

  async function handleSave() {
    if (selectedLines.length === 0) {
      setError('Select at least one product line')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await purchaseOrdersApi.update<PurchaseOrder>(po.po_id, {
        selected_lines: selectedLines,
      })
      await invalidateQuotationCrmCaches(queryClient)
      onSaved(updated)
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update products')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-20rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2.5rem)]">
        <DialogHeader className="border-b border-[#E2E6DC] px-6 py-4 text-left">
          <DialogTitle>Edit products</DialogTitle>
          <DialogDescription>
            Add or remove lines from the linked quotation and adjust negotiated prices.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {quotationLoading ? (
            <p className="text-[13px] text-surface-muted">Loading quotation…</p>
          ) : !quotation ? (
            <p className="text-[13px] text-red-600">Linked quotation could not be loaded.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#E2E6DC] bg-[#FAFAF8] p-3 text-[13px]">
                <p className="font-medium text-gray-900">{quotation.quote_number}</p>
                <p className="text-surface-muted">{quotation.client_name}</p>
              </div>

              <div className="space-y-3">
                {quoteLines.map((line, idx) => {
                  const st = lineState[idx]
                  if (!st) return null
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'rounded-lg border p-3',
                        st.selected ? 'border-brand-green-300 bg-green-50/40' : 'border-[#E2E6DC] bg-white',
                      )}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={st.selected}
                          onChange={(e) =>
                            setLineState((prev) => ({
                              ...prev,
                              [idx]: { ...prev[idx], selected: e.target.checked },
                            }))
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-gray-900">{lineTitle(line)}</p>
                          <p className="text-[12px] text-surface-muted">
                            Quoted: {formatCurrency(line.unit_price)} × {line.quantity} {line.unit || 'Nos'}
                          </p>
                          {st.selected && (
                            <PoQuotedLineNegotiationFields
                              value={{
                                quantity: st.quantity,
                                unit_price: st.unit_price,
                                base_unit_price: st.base_unit_price,
                                customer_discount_pct: st.customer_discount_pct,
                              }}
                              onChange={(next) =>
                                setLineState((prev) => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], ...next },
                                }))
                              }
                            />
                          )}
                        </div>
                      </label>
                    </div>
                  )
                })}
              </div>

              {selectedLines.length > 0 && (
                <p className="text-[13px] text-surface-muted">
                  Item total: <span className="font-mono font-medium text-gray-900">{formatCurrency(itemTotal)}</span>
                </p>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}
        </div>

        <DialogFooter className="border-t border-[#E2E6DC] px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || quotationLoading || !quotation || selectedLines.length === 0}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save products'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
