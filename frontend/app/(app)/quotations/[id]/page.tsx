'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FileText, Info, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/layout/PageShell'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import QuotationLineItemsEditor from '@/components/quotations/QuotationLineItemsEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useQuotation, useClientConfig, useEnquiry } from '@/lib/queries'
import { quotationsApi } from '@/lib/api'
import {
  manualLineItemsToAssembledProducts,
  parseManualLineItemsFromEnquiryRaw,
  quotationLinesToFallbackManualItems,
} from '@/lib/quotationPrefillAssembly'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import type { AssembledProduct, QuotationAuditResponse, QuotationHistoryResponse, QuotationLineItem } from '@/types'

function formatQuoteDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function QuotationDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Skeleton className="h-[520px] w-full rounded-xl border border-[#E2E6DC]" />
      </div>
      <div className="lg:col-span-2">
        <Skeleton className="h-[360px] w-full rounded-xl border border-[#E2E6DC]" />
      </div>
    </div>
  )
}

export default function QuotationDetailPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''
  const queryClient = useQueryClient()
  const canEditQuoteLines = useAuthStore((s) => s.hasPermission(Permissions.APPROVE_QUOTATIONS))

  // Hooks MUST be declared before any conditional returns.
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editLinesOpen, setEditLinesOpen] = useState(false)
  /** Increment on each "Edit" open so the line-items editor remounts with fresh cascade/pricing state. */
  const [editSession, setEditSession] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<QuotationHistoryResponse | null>(null)
  const [activeLine, setActiveLine] = useState<QuotationLineItem | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditData, setAuditData] = useState<QuotationAuditResponse | null>(null)

  const activeLineLabel = useMemo(() => {
    if (!activeLine) return ''
    return (activeLine.product_name || activeLine.description || 'Line item').toString()
  }, [activeLine])

  const openHistory = async (line: QuotationLineItem) => {
    setActiveLine(line)
    setHistoryOpen(true)
    setHistoryError(null)
    setHistoryData(null)

    const category = (line.category || line.catalog_table || '').toString().trim()
    const catalog_table = (line.catalog_table || '').toString().trim()
    const catalog_row_id = (line.catalog_row_id || '').toString().trim()
    if (!category || !catalog_table || !catalog_row_id) {
      setHistoryError('History lookup is unavailable for this line item (missing product identifiers).')
      return
    }

    setHistoryLoading(true)
    try {
      const res = await quotationsApi.getQuoteHistory<QuotationHistoryResponse>({
        category,
        catalog_table,
        catalog_row_id,
        limit: 20,
        offset: 0,
      })
      setHistoryData(res)
    } catch (e: unknown) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setHistoryLoading(false)
    }
  }

  const quotationQuery = useQuotation(id)
  const { data: quotation, isPending, isError } = quotationQuery
  const { data: clientConfig } = useClientConfig()
  const enquiryQuery = useEnquiry(quotation?.enquiry_id ?? '')
  const { data: linkedEnquiry } = enquiryQuery

  const prefillAssembledProducts = useMemo(() => {
    if (!quotation?.line_items) return []
    const manual = parseManualLineItemsFromEnquiryRaw(linkedEnquiry?.raw_input ?? null)
    const built = manual?.length
      ? manualLineItemsToAssembledProducts(manual)
      : manualLineItemsToAssembledProducts(quotationLinesToFallbackManualItems(quotation.line_items))
    // Deep clone so React Query cache objects are never mutated by the configurator, and each open gets a fresh graph.
    return built.map((p) => JSON.parse(JSON.stringify(p)) as AssembledProduct)
  }, [
    quotation?.line_items,
    linkedEnquiry?.raw_input,
    quotation?.total_amount,
    quotation?.subtotal,
    editSession,
    quotationQuery.dataUpdatedAt,
    enquiryQuery.dataUpdatedAt,
  ])

  if (!id) {
    return (
      <PageShell title="Quotation">
        <EmptyState
          icon={FileText}
          title="Invalid quotation"
          description="No quotation id was provided in the URL."
        />
      </PageShell>
    )
  }

  if (isPending) {
    return (
      <PageShell title="Quotation">
        <QuotationDetailSkeleton />
      </PageShell>
    )
  }

  if (isError || !quotation) {
    return (
      <PageShell title="Quotation">
        <EmptyState
          icon={FileText}
          title="Quotation not found"
          description="This quotation may have been removed or the link is incorrect."
        />
      </PageShell>
    )
  }

  const companyName = clientConfig?.company_name || 'PARTH VALVES AND HOSES LLP'
  const address = clientConfig?.address || ''
  const gst = clientConfig?.gst_number || ''
  const phone = clientConfig?.phone || ''
  const email = clientConfig?.email || ''

  const pdfHref = quotationsApi.getPdfUrl(id)
  const lineItems = quotation.line_items ?? []
  const auditItems = auditData?.items ?? []

  const loadAudit = async () => {
    if (!id) return
    setAuditLoading(true)
    setAuditError(null)
    try {
      const res = await quotationsApi.getAudit<QuotationAuditResponse>(id, 25)
      setAuditData(res)
    } catch (e: unknown) {
      setAuditError(e instanceof Error ? e.message : 'Failed to load edit history')
      setAuditData(null)
    } finally {
      setAuditLoading(false)
    }
  }

  return (
    <PageShell title={`Quote ${quotation.quote_number}`}>
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-surface-muted">
        <Link href="/quotations" className="text-brand-green-600 hover:underline">
          Quotations
        </Link>
        <span aria-hidden>/</span>
        <span className="font-mono text-brand-gold-500">{quotation.quote_number}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
            <div className="p-6 md:p-8">
              <header className="text-center">
                <p className="text-[18px] font-bold text-gray-900">{companyName}</p>
                <div className="mx-auto mt-2 max-w-xl space-y-0.5 text-[11px] leading-relaxed text-[#8A9488]">
                  {address && <p>{address}</p>}
                  <p className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">
                    {gst && <span>GST: {gst}</span>}
                    {phone && <span>Tel: {phone}</span>}
                    {email && <span>{email}</span>}
                  </p>
                </div>
                <div className="my-5 border-b border-[#E2E6DC]" />
                <h2 className="text-[20px] font-semibold text-brand-gold-500">QUOTATION</h2>
                <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] text-gray-700">
                  <span>
                    <span className="text-[#8A9488]">No. </span>
                    <span className="font-mono font-medium text-brand-gold-500">{quotation.quote_number}</span>
                  </span>
                  <span>
                    <span className="text-[#8A9488]">Date </span>
                    <span>{formatQuoteDate(quotation.created_at)}</span>
                  </span>
                </div>
              </header>

              <section className="mt-8 text-left">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">To</p>
                <div className="mt-2 space-y-1 text-[14px] text-gray-900">
                  <p className="font-semibold">{quotation.client_name}</p>
                  {quotation.client_company && <p>{quotation.client_company}</p>}
                  {quotation.client_email && (
                    <p className="text-surface-muted">{quotation.client_email}</p>
                  )}
                  {quotation.client_phone && (
                    <p className="text-surface-muted">{quotation.client_phone}</p>
                  )}
                </div>
              </section>

              <div className="mt-8 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                      <th className="px-2 py-2.5">Sr No</th>
                      <th className="px-2 py-2.5">Description</th>
                      <th className="px-2 py-2.5">Size</th>
                      <th className="px-2 py-2.5 text-right">Qty</th>
                      <th className="px-2 py-2.5">Unit</th>
                      <th className="px-2 py-2.5 text-right">Unit Price</th>
                      <th className="px-2 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line: QuotationLineItem, idx: number) => (
                      <tr
                        key={idx}
                        className={cn(
                          'border-b border-[#E2E6DC] text-[13px]',
                          idx % 2 === 1 ? 'bg-[#F9FAF7]' : 'bg-white',
                        )}
                      >
                        <td className="px-2 py-2.5 text-surface-muted">
                          <div className="flex items-center gap-2">
                            <span>{idx + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-surface-muted hover:text-gray-900"
                              onClick={() => void openHistory(line)}
                              title="View quote history"
                            >
                              <Info className="size-4" />
                              <span className="sr-only">View quote history</span>
                            </Button>
                          </div>
                        </td>
                        <td className="max-w-[260px] whitespace-pre-line px-2 py-2.5 text-gray-900">
                          {line.product_name || line.description}
                        </td>
                        <td className="px-2 py-2.5 text-surface-muted">{line.size || '—'}</td>
                        <td className="px-2 py-2.5 text-right font-mono">{line.quantity}</td>
                        <td className="px-2 py-2.5 text-surface-muted">{line.unit}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-gray-800">
                          <div>{formatCurrency(line.unit_price)}</div>
                          {typeof line.customer_discount_pct === 'number' && line.customer_discount_pct > 0 && (
                            <div className="text-[11px] text-surface-muted">
                              ({line.customer_discount_pct}% discount)
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-gray-900">
                          {formatCurrency(line.line_total ?? line.total ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-[13px]">
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8A9488]">Subtotal</span>
                    <span className="font-mono text-gray-900">{formatCurrency(quotation.subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8A9488]">GST @ {quotation.gst_rate}%</span>
                    <span className="font-mono text-gray-900">{formatCurrency(quotation.gst_amount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8A9488]">P&amp;F @ {quotation.pf_rate}%</span>
                    <span className="font-mono text-gray-900">{formatCurrency(quotation.pf_amount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8A9488]">Freight</span>
                    <span className="text-right text-gray-800">{quotation.freight_note || 'Extra at actual'}</span>
                  </div>
                  <div className="border-t border-[#E2E6DC] pt-2" />
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-gray-900">TOTAL</span>
                    <span className="text-[20px] font-bold font-mono text-brand-green-600">
                      {formatCurrency(quotation.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              <section className="mt-8 space-y-1 text-[12px] leading-relaxed text-[#8A9488]">
                <p>GST {quotation.gst_rate}% extra as applicable.</p>
                <p>P&amp;F {quotation.pf_rate}% extra as applicable.</p>
                <p>Freight extra at actual.</p>
                <p>Payment terms as per company policy / proforma invoice.</p>
                <p>Material Test Certificate (MTC) can be provided on request where applicable.</p>
              </section>

              {quotation.notes && (
                <section className="mt-6 rounded-lg border border-[#E2E6DC] bg-[#F9FAF7] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] text-gray-800">{quotation.notes}</p>
                </section>
              )}
            </div>
          </div>
        </div>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Quoted price history</DialogTitle>
              <DialogDescription className="line-clamp-2">
                {activeLineLabel}
              </DialogDescription>
            </DialogHeader>

            {historyLoading ? (
              <p className="text-[13px] text-surface-muted">Loading history…</p>
            ) : historyError ? (
              <p className="text-[13px] text-red-600">{historyError}</p>
            ) : !historyData || historyData.items.length === 0 ? (
              <p className="text-[13px] text-surface-muted">No prior quotes found for this product.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-surface-border">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2 text-right">Price quoted</th>
                      <th className="px-3 py-2">Date quoted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.items.map((h, i) => (
                      <tr key={`${h.quotation_id}-${i}`} className="border-b border-[#E2E6DC] last:border-0">
                        <td className="px-3 py-2 text-gray-900">
                          {(h.client_company || h.client_name || '—').toString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">
                          {formatCurrency(h.unit_price)}
                        </td>
                        <td className="px-3 py-2 text-surface-muted">
                          {formatQuoteDate(h.quoted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>

        <aside className="lg:col-span-2">
          <div className="sticky top-6 space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto pr-1">
            {editLinesOpen ? (
              <QuotationLineItemsEditor
                key={`${id}-edit-${editSession}`}
                quotationId={id}
                prefillRevision={editSession}
                initialAssembledProducts={prefillAssembledProducts}
                onCancel={() => setEditLinesOpen(false)}
                onSaved={async () => {
                  await Promise.all([
                    queryClient.refetchQueries({ queryKey: ['quotation', id] }),
                    queryClient.refetchQueries({ queryKey: ['enquiry', quotation.enquiry_id] }),
                  ])
                  setEditLinesOpen(false)
                }}
              />
            ) : (
              <>
                <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Total</p>
                      <p className="mt-1 text-[28px] font-bold font-mono text-brand-green-600">
                        {formatCurrency(quotation.total_amount)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge status={quotation.status} />
                      </div>
                      <p className="mt-3 text-[13px] text-surface-muted">
                        Created {formatQuoteDate(quotation.created_at)}
                      </p>
                      <p className="mt-1 text-[13px] text-surface-muted">
                        Valid for {quotation.validity_days} day{quotation.validity_days === 1 ? '' : 's'} from issue
                      </p>
                    </div>
                    {canEditQuoteLines && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-[#E2E6DC] text-[12px]"
                        onClick={() => {
                          setEditSession((n) => n + 1)
                          setEditLinesOpen(true)
                        }}
                      >
                        <Pencil className="mr-1.5 size-3.5" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <a
                    href={pdfHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'default', size: 'default' }),
                      'w-full border-transparent bg-brand-green-500 text-white hover:bg-brand-green-600',
                    )}
                  >
                    Download PDF
                  </a>
                  <a
                    href={pdfHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'default' }),
                      'w-full border-[#E2E6DC]',
                    )}
                  >
                    Open PDF in New Tab
                  </a>
                </div>

                <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Linked Enquiry
                  </p>
                  <Link
                    href={`/enquiries/${quotation.enquiry_id}`}
                    className="mt-2 inline-block font-mono text-[13px] text-brand-green-600 hover:underline"
                  >
                    {quotation.enquiry_id}
                  </Link>
                  {linkedEnquiry?.flow_type != null && linkedEnquiry.flow_type !== '' && (
                    <p className="mt-2 text-[12px] text-surface-muted">
                      Flow:{' '}
                      <span className="font-medium text-gray-800">
                        {linkedEnquiry.flow_type.replace(/_/g, ' ')}
                      </span>
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                        Edit history
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-[#E2E6DC] text-[12px]"
                      onClick={() => void loadAudit()}
                    >
                      Refresh
                    </Button>
                  </div>

                  {auditLoading ? (
                    <p className="mt-3 text-[13px] text-surface-muted">Loading…</p>
                  ) : auditError ? (
                    <p className="mt-3 text-[13px] text-red-600">{auditError}</p>
                  ) : auditItems.length === 0 ? (
                    <p className="mt-3 text-[13px] text-surface-muted">No edits recorded yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {auditItems.slice(0, 8).map((it, idx) => (
                        <li
                          key={idx}
                          className="rounded-lg border border-[#E2E6DC] bg-[#F9FAF7] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-gray-900">{it.summary}</p>
                              <p className="mt-1 text-[12px] text-surface-muted truncate">
                                {(it.user_name || it.user || 'User').toString()}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] font-mono text-surface-muted">
                              {it.at ? new Date(it.at).toLocaleString('en-IN') : '—'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  )
}
