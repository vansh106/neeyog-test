'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FilePenLine, FileText, Pencil } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/layout/PageShell'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import QuotationLineItemsEditor from '@/components/quotations/QuotationLineItemsEditor'
import QuotationFormatPreview from '@/components/quotations/QuotationFormatPreview'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useQuotation, useClientConfig, useEnquiry } from '@/lib/queries'
import {
  downloadQuotationPdf,
  fetchQuotationPdfBlob,
  openQuotationPdfInNewTab,
  quotationsApi,
} from '@/lib/api'
import {
  manualLineItemsToAssembledProducts,
  parseManualLineItemsFromEnquiryRaw,
  quotationLinesToFallbackManualItems,
} from '@/lib/quotationPrefillAssembly'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, truncateId } from '@/lib/utils'
import type {
  AssembledProduct,
  QuotationAuditResponse,
  QuotationHistoryResponse,
  QuotationLineItem,
  QuotationPdfDisplayOverrides,
} from '@/types'

function buildPdfLineOverridesPayload(
  lineItems: QuotationLineItem[],
  edits: Array<{ description: string; size: string }>,
): Array<{ description?: string; size?: string }> {
  return edits.map((edit, idx) => {
    const line = lineItems[idx]
    if (!line) return {}
    const baseDesc = (line.product_name || line.description || '').trim()
    const baseSize = (line.size || '').trim()
    const o: { description?: string; size?: string } = {}
    if (edit.description.trim() !== baseDesc) o.description = edit.description.trim()
    if (edit.size.trim() !== baseSize) o.size = edit.size.trim()
    return o
  })
}

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

  const [pdfEditOpen, setPdfEditOpen] = useState(false)
  const [pdfEditBusy, setPdfEditBusy] = useState(false)
  const [pdfEditError, setPdfEditError] = useState<string | null>(null)
  const [pdfLineEdits, setPdfLineEdits] = useState<Array<{ description: string; size: string }>>([])
  const [pdfNotesCustom, setPdfNotesCustom] = useState(false)
  const [pdfNotesText, setPdfNotesText] = useState('')
  const [pdfPreviewNonce, setPdfPreviewNonce] = useState(0)
  const [pdfPreviewObjectUrl, setPdfPreviewObjectUrl] = useState<string | null>(null)
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false)
  const [pdfPreviewFetchError, setPdfPreviewFetchError] = useState<string | null>(null)
  const [pdfDownloadBusy, setPdfDownloadBusy] = useState(false)
  const [pdfOpenBusy, setPdfOpenBusy] = useState(false)

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

  const openPdfEditor = useCallback(() => {
    const q = quotationQuery.data
    if (!q) return
    const items = q.line_items ?? []
    const ov = q.pdf_display_overrides
    setPdfLineEdits(
      items.map((line, idx) => {
        const row = ov?.lines?.[idx]
        const descFromOv =
          typeof row?.description === 'string' && row.description !== ''
            ? row.description
            : typeof row?.product_name === 'string'
              ? row.product_name
              : ''
        return {
          description: descFromOv || (line.product_name || line.description || ''),
          size: (typeof row?.size === 'string' ? row.size : '') || (line.size || ''),
        }
      }),
    )
    const hasNotesKey = !!(ov && typeof ov === 'object' && ov !== null && 'notes' in ov)
    setPdfNotesCustom(hasNotesKey)
    setPdfNotesText(hasNotesKey ? String((ov as QuotationPdfDisplayOverrides).notes ?? '') : '')
    setPdfEditError(null)
    setPdfEditOpen(true)
  }, [quotationQuery.data])

  const savePdfDisplay = useCallback(async () => {
    const q = quotationQuery.data
    if (!q || !id) return
    setPdfEditBusy(true)
    setPdfEditError(null)
    try {
      const items = q.line_items ?? []
      const lines = buildPdfLineOverridesPayload(items, pdfLineEdits)
      const hasLineOv = lines.some((o) => Object.keys(o).length > 0)
      let pdf_display_overrides: Record<string, unknown> | null = null
      if (pdfNotesCustom || hasLineOv) {
        pdf_display_overrides = {
          lines,
          ...(pdfNotesCustom ? { notes: pdfNotesText } : {}),
        }
      }
      await quotationsApi.updatePdfDisplay(id, { pdf_display_overrides })
      setPdfPreviewNonce((n) => n + 1)
      await queryClient.invalidateQueries({ queryKey: ['quotation', id] })
      setPdfEditOpen(false)
    } catch (e: unknown) {
      setPdfEditError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setPdfEditBusy(false)
    }
  }, [id, pdfLineEdits, pdfNotesCustom, pdfNotesText, quotationQuery.data, queryClient])

  const clearPdfOverrides = useCallback(async () => {
    if (!id) return
    setPdfEditBusy(true)
    setPdfEditError(null)
    try {
      await quotationsApi.updatePdfDisplay(id, { pdf_display_overrides: null })
      setPdfPreviewNonce((n) => n + 1)
      await queryClient.invalidateQueries({ queryKey: ['quotation', id] })
      setPdfEditOpen(false)
    } catch (e: unknown) {
      setPdfEditError(e instanceof Error ? e.message : 'Failed to clear')
    } finally {
      setPdfEditBusy(false)
    }
  }, [id, queryClient])

  useEffect(() => {
    if (!pdfEditOpen || !id) {
      setPdfPreviewObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setPdfPreviewFetchError(null)
      setPdfPreviewLoading(false)
      return
    }

    let cancelled = false
    setPdfPreviewLoading(true)
    setPdfPreviewFetchError(null)

    fetchQuotationPdfBlob(id)
      .then((blob: Blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setPdfPreviewObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPdfPreviewFetchError(e instanceof Error ? e.message : 'Preview failed')
        }
      })
      .finally(() => {
        if (!cancelled) setPdfPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [pdfEditOpen, id, pdfPreviewNonce])

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

  const pdfOverrides = quotation.pdf_display_overrides
  const notesPreviewText =
    pdfOverrides && typeof pdfOverrides === 'object' && pdfOverrides !== null && 'notes' in pdfOverrides
      ? String(pdfOverrides.notes ?? '')
      : null
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
    <PageShell
      title={`Quote ${quotation.quote_number}`}
      actions={
        canEditQuoteLines ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-[#E2E6DC]"
            onClick={() => openPdfEditor()}
          >
            <FilePenLine className="size-4" />
            Edit PDF
          </Button>
        ) : undefined
      }
    >
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
              <QuotationFormatPreview
                quotation={quotation}
                clientConfig={clientConfig}
                linkedEnquiry={linkedEnquiry}
                pdfOverrides={pdfOverrides}
                notesPreviewText={notesPreviewText}
                onOpenHistory={(line) => void openHistory(line)}
              />
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
                        <StatusBadge status={quotation.status} kind="quotation_crm" />
                      </div>
                      {(quotation.status === 'lost' || quotation.status === 'hold') && quotation.status_remarks && (
                        <p className="mt-2 text-[12px] leading-snug text-surface-muted">
                          <span className="font-medium text-gray-700">Remarks: </span>
                          {quotation.status_remarks}
                        </p>
                      )}
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
                  <Button
                    type="button"
                    disabled={pdfDownloadBusy || pdfOpenBusy}
                    className="h-10 w-full border-transparent bg-brand-green-500 text-white hover:bg-brand-green-600"
                    onClick={() => {
                      setPdfDownloadBusy(true)
                      downloadQuotationPdf(id, `${quotation.quote_number}.pdf`)
                        .catch((e: unknown) => window.alert(e instanceof Error ? e.message : 'Download failed'))
                        .finally(() => setPdfDownloadBusy(false))
                    }}
                  >
                    {pdfDownloadBusy ? 'Preparing…' : 'Download PDF'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pdfDownloadBusy || pdfOpenBusy}
                    className="w-full border-[#E2E6DC]"
                    onClick={() => {
                      setPdfOpenBusy(true)
                      openQuotationPdfInNewTab(id)
                        .catch((e: unknown) => window.alert(e instanceof Error ? e.message : 'Could not open PDF'))
                        .finally(() => setPdfOpenBusy(false))
                    }}
                  >
                    {pdfOpenBusy ? 'Opening…' : 'Open PDF in New Tab'}
                  </Button>
                </div>

                <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Linked Enquiry
                  </p>
                  <Link
                    href={`/enquiries/${quotation.enquiry_id}`}
                    className="mt-2 inline-block font-mono text-[13px] text-brand-green-600 hover:underline"
                  >
                    {(linkedEnquiry?.enquiry_number || quotation.enquiry_number || '').trim() ||
                      truncateId(quotation.enquiry_id)}
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

      <Dialog open={pdfEditOpen} onOpenChange={setPdfEditOpen}>
        <DialogContent className="flex max-h-[min(90vh,880px)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <div className="border-b border-surface-border px-6 py-4">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>Edit PDF wording</DialogTitle>
              <DialogDescription>
                Optional labels for this quotation&apos;s PDF only. Pricing, quantities, and catalog data stay the same.
                Use &quot;Clear PDF overrides&quot; to restore the default PDF text.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-2 lg:divide-x lg:divide-surface-border">
            <div className="max-h-[min(72vh,720px)] space-y-4 overflow-y-auto p-6">
              {pdfLineEdits.map((row, idx) => (
                <div key={idx} className="rounded-lg border border-[#E2E6DC] bg-[#F9FAF7] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Line {idx + 1} — description &amp; size on PDF
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label htmlFor={`pdf-desc-${idx}`} className="text-[11px] text-[#8A9488]">
                        Description
                      </label>
                      <Textarea
                        id={`pdf-desc-${idx}`}
                        value={row.description}
                        onChange={(e) =>
                          setPdfLineEdits((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)),
                          )
                        }
                        className="mt-1 min-h-[72px] text-[13px]"
                        placeholder="Text shown in the PDF description column"
                      />
                    </div>
                    <div>
                      <label htmlFor={`pdf-size-${idx}`} className="text-[11px] text-[#8A9488]">
                        Size
                      </label>
                      <Input
                        id={`pdf-size-${idx}`}
                        value={row.size}
                        onChange={(e) =>
                          setPdfLineEdits((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, size: e.target.value } : r)),
                          )
                        }
                        className="mt-1 h-10 text-[13px]"
                        placeholder="e.g. DN 80"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-[#E2E6DC] bg-white p-4">
                <label className="flex cursor-pointer items-start gap-3 text-[13px] text-gray-900">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={pdfNotesCustom}
                    onChange={(e) => setPdfNotesCustom(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Custom notes on PDF</span>
                    <span className="mt-0.5 block text-[12px] font-normal text-surface-muted">
                      When off, the PDF uses the quotation notes field. When on, the text below is used only on the PDF.
                    </span>
                  </span>
                </label>
                {pdfNotesCustom && (
                  <Textarea
                    value={pdfNotesText}
                    onChange={(e) => setPdfNotesText(e.target.value)}
                    className="mt-3 min-h-[80px] text-[13px]"
                    placeholder="Notes block at the bottom of the PDF"
                  />
                )}
              </div>
              {pdfEditError && <p className="text-[13px] text-red-600">{pdfEditError}</p>}
            </div>
            <div className="flex min-h-[280px] flex-col bg-surface-page lg:max-h-[min(72vh,720px)]">
              <p className="shrink-0 border-b border-surface-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                PDF preview
              </p>
              {pdfPreviewLoading && (
                <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-surface-muted">
                  Loading preview…
                </div>
              )}
              {pdfPreviewFetchError && !pdfPreviewLoading && (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center text-[13px] text-red-600">
                  {pdfPreviewFetchError}
                </div>
              )}
              {!pdfPreviewLoading && !pdfPreviewFetchError && pdfPreviewObjectUrl && (
                <iframe
                  title="Quotation PDF preview"
                  src={pdfPreviewObjectUrl}
                  className="min-h-[320px] w-full flex-1 border-0 lg:min-h-0"
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pdfEditBusy}
              onClick={() => void clearPdfOverrides()}
            >
              Clear PDF overrides
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pdfEditBusy} onClick={() => setPdfEditOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={pdfEditBusy} onClick={() => void savePdfDisplay()}>
                {pdfEditBusy ? 'Saving…' : 'Save & regenerate PDF'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
