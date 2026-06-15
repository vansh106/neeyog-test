'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ValveConfigurator, CompletedProductCard } from '@/components/configurator/ValveConfigurator'
import PurchaseOrderFinancialPanel, {
  usePurchaseOrderFinancialDraft,
} from '@/components/purchase-orders/PurchaseOrderFinancialPanel'
import QuotationPreviewDialog from '@/components/purchase-orders/QuotationPreviewDialog'
import ManualClientDetailsSection from '@/components/clients/ManualClientDetailsSection'
import { purchaseOrdersApi, suppliersApi } from '@/lib/api'
import { useManualClientPicker } from '@/lib/manualClientPicker'
import { useQuotationsListingDataset, useQuotation } from '@/lib/queries'
import {
  assemblyLabel,
  assembledToLineItem,
  uuidv4,
} from '@/lib/manualAssemblyLineItem'
import { cn, formatCurrency } from '@/lib/utils'
import type { AssembledProduct, PurchaseOrder, QuotationLineItem, SupplierResponse } from '@/types'

function formatQuoteListDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Step = 'link' | 'pick_quotation' | 'quoted_lines' | 'manual'

type SelectedLineState = {
  selected: boolean
  quantity: number
  unit_price: number
  quoted_unit_price: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fixedQuotationId?: string | null
  onCreated?: (po: PurchaseOrder) => void
}

function lineTitle(line: QuotationLineItem): string {
  const name = (line.product_name || line.description || 'Product').split('\n')[0]
  return name.slice(0, 120)
}

export default function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
  fixedQuotationId,
  onCreated,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(fixedQuotationId ? 'quoted_lines' : 'link')
  const [linkToQuote, setLinkToQuote] = useState<boolean | null>(fixedQuotationId ? true : null)
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(
    fixedQuotationId ?? null,
  )
  const [quoteFilterClient, setQuoteFilterClient] = useState('')
  const [quoteFilterNumber, setQuoteFilterNumber] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [lineState, setLineState] = useState<Record<number, SelectedLineState>>({})
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewQuotationId, setPreviewQuotationId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const clientPicker = useManualClientPicker()
  const [assembledProducts, setAssembledProducts] = useState<AssembledProduct[]>([])
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [activeConfigId, setActiveConfigId] = useState<string>(() => uuidv4())
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    suppliersApi.getSuppliers(true).then(setSuppliers).catch(() => setSuppliers([]))
  }, [open])

  useEffect(() => {
    if (!open) clientPicker.reset()
  }, [open, clientPicker.reset])

  const handleProductComplete = useCallback(
    (configId: string) => (product: AssembledProduct) => {
      setAssembledProducts((prev) => [...prev, { ...product, id: configId }])
      setActiveConfigId(uuidv4())
      setEditingId(null)
    },
    [],
  )

  const { data: quotations } = useQuotationsListingDataset(2000)
  const { data: quotation } = useQuotation(selectedQuotationId ?? '')

  const quoteLines = useMemo(
    () => (quotation?.line_items ?? []) as QuotationLineItem[],
    [quotation],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    if (fixedQuotationId) {
      setStep('quoted_lines')
      setLinkToQuote(true)
      setSelectedQuotationId(fixedQuotationId)
    } else {
      setStep('link')
      setLinkToQuote(null)
      setSelectedQuotationId(null)
    }
  }, [open, fixedQuotationId])

  useEffect(() => {
    if (!quotation || step !== 'quoted_lines') return
    const next: Record<number, SelectedLineState> = {}
    quoteLines.forEach((line, idx) => {
      next[idx] = {
        selected: false,
        quantity: line.quantity || 1,
        unit_price: line.unit_price || 0,
        quoted_unit_price: line.unit_price || 0,
      }
    })
    setLineState(next)
  }, [quotation, quoteLines, step])

  const filteredQuotations = useMemo(() => {
    const rows = quotations ?? []
    return rows.filter((q) => {
      if (quoteFilterClient && !q.client_name.toLowerCase().includes(quoteFilterClient.toLowerCase())) {
        return false
      }
      if (quoteFilterNumber && !q.quote_number.toLowerCase().includes(quoteFilterNumber.toLowerCase())) {
        return false
      }
      if (dateFrom && new Date(q.created_at) < new Date(dateFrom)) return false
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        if (new Date(q.created_at) > end) return false
      }
      return true
    })
  }, [quotations, quoteFilterClient, quoteFilterNumber, dateFrom, dateTo])

  const selectedQuotedLines = useMemo(() => {
    return Object.entries(lineState)
      .filter(([, v]) => v.selected)
      .map(([idx, v]) => ({
        line_index: Number(idx),
        quantity: v.quantity,
        unit_price: v.unit_price,
        quoted_unit_price: v.quoted_unit_price,
      }))
  }, [lineState])

  const quotedItemTotal = useMemo(
    () =>
      selectedQuotedLines.reduce(
        (sum, row) => sum + row.quantity * row.unit_price,
        0,
      ),
    [selectedQuotedLines],
  )

  const manualItemTotal = useMemo(
    () =>
      assembledProducts.reduce((sum, p) => {
        const u = Number(p.unit_price)
        if (!Number.isFinite(u) || u <= 0) return sum
        return sum + u * p.quantity
      }, 0),
    [assembledProducts],
  )

  const itemTotal = step === 'manual' ? manualItemTotal : quotedItemTotal
  const { draft, setDraft, apiBody } = usePurchaseOrderFinancialDraft(itemTotal)

  const resetAndClose = () => {
    onOpenChange(false)
  }

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      let payload: import('@/types').PurchaseOrderCreatePayload
      if (linkToQuote) {
        if (!selectedQuotationId || selectedQuotedLines.length === 0) {
          throw new Error('Select at least one product line')
        }
        payload = {
          quotation_id: selectedQuotationId,
          selected_lines: selectedQuotedLines,
          ...apiBody,
        }
      } else {
        if (!clientPicker.validate()) throw new Error('Please select or add a client')
        if (assembledProducts.length === 0) throw new Error('Add at least one product')
        const client = clientPicker.getSnapshot()
        payload = {
          manual_line_items: assembledProducts.map((p) => assembledToLineItem(p, null, p.customer_discount_pct ?? 0)),
          client_name: client.client_name,
          client_company: client.client_company,
          client_email: client.client_email,
          client_phone: client.client_phone,
          client_employee_id: client.client_employee_id,
          ...apiBody,
        }
      }
      const po = await purchaseOrdersApi.create<PurchaseOrder>(payload)
      onCreated?.(po)
      resetAndClose()
      router.push(`/purchase-orders/${po.po_id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create purchase order')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-20rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2.5rem)]">
        <DialogHeader className="border-b border-[#E2E6DC] px-6 py-4 text-left">
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            {fixedQuotationId
              ? 'Select products from this quotation and enter negotiated prices.'
              : 'Create a PO linked to a quotation or build one manually.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'link' && (
            <div className="space-y-4">
              <p className="text-[14px] text-gray-900">Link this PO to an existing quotation?</p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={() => { setLinkToQuote(true); setStep('pick_quotation') }}>
                  Yes — from quotation
                </Button>
                <Button type="button" variant="outline" onClick={() => { setLinkToQuote(false); setStep('manual') }}>
                  No — manual PO
                </Button>
              </div>
            </div>
          )}

          {step === 'pick_quotation' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input placeholder="Client name" value={quoteFilterClient} onChange={(e) => setQuoteFilterClient(e.target.value)} />
                <Input placeholder="Quotation number" value={quoteFilterNumber} onChange={(e) => setQuoteFilterNumber(e.target.value)} />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-[#E2E6DC]">
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 bg-[#FAFAF8] text-[11px] uppercase text-[#8A9488]">
                    <tr>
                      <th className="px-3 py-2">Quote</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotations.map((q) => (
                      <tr key={q.quotation_id} className="border-t border-[#E2E6DC]">
                        <td className="px-3 py-2 font-medium">{q.quote_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-surface-muted">
                          {formatQuoteListDate(q.created_at)}
                        </td>
                        <td className="px-3 py-2">{q.client_name}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(q.total_amount)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className={cn(
                                buttonVariants({ variant: 'outline', size: 'icon' }),
                                'h-8 w-8',
                              )}
                              aria-label={`Preview quotation ${q.quote_number}`}
                              onClick={() => {
                                setPreviewQuotationId(q.quotation_id)
                                setPreviewOpen(true)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <Button
                              size="sm"
                              variant={selectedQuotationId === q.quotation_id ? 'default' : 'outline'}
                              onClick={() => setSelectedQuotationId(q.quotation_id)}
                            >
                              Select
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'quoted_lines' && quotation && (
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
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="text-[12px]">
                                <span className="text-surface-muted">Final unit price (₹)</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={st.unit_price}
                                  onChange={(e) =>
                                    setLineState((prev) => ({
                                      ...prev,
                                      [idx]: {
                                        ...prev[idx],
                                        unit_price: Number(e.target.value) || 0,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="text-[12px]">
                                <span className="text-surface-muted">Quantity</span>
                                <Input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={st.quantity}
                                  onChange={(e) =>
                                    setLineState((prev) => ({
                                      ...prev,
                                      [idx]: {
                                        ...prev[idx],
                                        quantity: Math.max(1, Number(e.target.value) || 1),
                                      },
                                    }))
                                  }
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  )
                })}
              </div>
              {selectedQuotedLines.length > 0 && (
                <PurchaseOrderFinancialPanel
                  itemTotal={quotedItemTotal}
                  draft={draft}
                  onDraftChange={setDraft}
                  disabled={creating}
                />
              )}
            </div>
          )}

          {step === 'manual' && (
            <div className="space-y-5">
              <ManualClientDetailsSection {...clientPicker} disabled={creating} />
              <ValveConfigurator
                key={activeConfigId}
                productIndex={assembledProducts.length}
                suppliers={suppliers}
                onProductComplete={handleProductComplete(activeConfigId)}
              />
              {assembledProducts.map((p, idx) =>
                editingId === p.id ? (
                  <ValveConfigurator
                    key={`edit-${p.id}`}
                    productIndex={idx}
                    initialProduct={p}
                    suppliers={suppliers}
                    onProductComplete={(updated) => {
                      setAssembledProducts((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
                      setEditingId(null)
                    }}
                    onProductRemove={() => {
                      setAssembledProducts((prev) => prev.filter((x) => x.id !== p.id))
                      setEditingId(null)
                    }}
                  />
                ) : (
                  <CompletedProductCard
                    key={p.id}
                    product={p}
                    index={idx}
                    onEdit={() => setEditingId(p.id)}
                    onRemove={() => setAssembledProducts((prev) => prev.filter((x) => x.id !== p.id))}
                  />
                ),
              )}
              {assembledProducts.length > 0 && (
                <PurchaseOrderFinancialPanel
                  itemTotal={manualItemTotal}
                  draft={draft}
                  onDraftChange={setDraft}
                  disabled={creating}
                />
              )}
            </div>
          )}

          {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}
        </div>

        <DialogFooter className="border-t border-[#E2E6DC] px-6 py-4">
          {step === 'pick_quotation' && (
            <>
              <Button variant="outline" onClick={() => setStep('link')}>Back</Button>
              <Button
                disabled={!selectedQuotationId}
                onClick={() => setStep('quoted_lines')}
              >
                Continue
              </Button>
            </>
          )}
          {(step === 'quoted_lines' || step === 'manual') && (
            <>
              {!fixedQuotationId && (
                <Button
                  variant="outline"
                  onClick={() => setStep(linkToQuote ? 'pick_quotation' : 'link')}
                >
                  Back
                </Button>
              )}
              <Button
                disabled={
                  creating ||
                  (step === 'quoted_lines' && selectedQuotedLines.length === 0) ||
                  (step === 'manual' && (assembledProducts.length === 0 || !clientPicker.isComplete))
                }
                onClick={handleCreate}
              >
                {creating ? 'Creating…' : 'Create PO'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      </Dialog>

      <QuotationPreviewDialog
        quotationId={previewQuotationId}
        open={previewOpen}
        onOpenChange={(next) => {
          setPreviewOpen(next)
          if (!next) setPreviewQuotationId(null)
        }}
      />
    </>
  )
}

export function CreatePOButton({
  fixedQuotationId,
  className,
}: {
  fixedQuotationId?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" className={className} onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create PO
      </Button>
      <CreatePurchaseOrderDialog
        open={open}
        onOpenChange={setOpen}
        fixedQuotationId={fixedQuotationId}
      />
    </>
  )
}
