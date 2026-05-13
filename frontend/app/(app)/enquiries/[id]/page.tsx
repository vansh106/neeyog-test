'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronRight, Download, FileText, Loader2, Mail, Sparkles } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import AIReasoningPanel from '@/components/ui/AIReasoningPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Button, buttonVariants } from '@/components/ui/button'
import { ClientVerificationPanel } from '@/components/upload/ClientVerificationPanel'
import ManualEntryForm from '@/components/upload/ManualEntryForm'
import { useEnquiry } from '@/lib/queries'
import { downloadQuotationPdf, enquiriesApi, erpExportUrl, processManualDropdown } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrency, formatRelativeTime, truncateId } from '@/lib/utils'
import type {
  ClientSummary,
  ClientVerificationContext,
  ClientVerificationResponse,
  EnquiryDetail,
  ManualEnquiryForm,
} from '@/types'

type EnquiryDetailExt = EnquiryDetail & {
  raw_input?: string | null
  missing_fields?: unknown
}

function formatLabelKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function toReasoningSteps(raw: string | null | undefined): string[] {
  if (!raw) return []
  const t = raw.trim()
  if (!t) return []
  try {
    const p = JSON.parse(t) as unknown
    if (Array.isArray(p)) return p.map((x) => String(x)).filter(Boolean)
  } catch {
    /* treat as plain text */
  }
  return t
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractQuoteId(parsed: Record<string, unknown> | null): string | null {
  if (!parsed) return null
  for (const key of ['quotation_id', 'quote_id', 'quotationId']) {
    const v = parsed[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

/** Align cascade key order with quote description / masters. */
const CASCADE_DISPLAY_ORDER: string[] = [
  'variant_type',
  'product_sheet',
  'construction',
  'valve_size',
  'bore_type',
  'end_connection',
  'pressure',
  'body',
  'ball_disc',
  'ball',
  'stem',
  'seat',
  'fasteners',
  'operator',
  'operator_model',
  'operator_size',
  'sov',
  'limit_switch_box',
  'positioner',
  'bracket_coupler',
  'supplier',
  'supplier_id',
]

function sortCascadeKeys(keys: string[]): string[] {
  const rank = (k: string) => {
    const i = CASCADE_DISPLAY_ORDER.indexOf(k)
    return i === -1 ? 1000 : i
  }
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

type EnquiryManualLineRow = {
  id: string
  category: string
  quantity: number
  unit: string
  productLabel: string
  listUnit: number | null
  customerDiscountPct: number | null
  netUnit: number | null
  lineNetTotal: number | null
  cascade: Record<string, string>
}

function parseManualLineItemsFromParsed(
  parsed: Record<string, unknown> | null,
): EnquiryManualLineRow[] {
  if (!parsed) return []
  const raw = parsed.manual_line_items
  if (!Array.isArray(raw)) return []
  const out: EnquiryManualLineRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const sp =
      o.selectedProduct && typeof o.selectedProduct === 'object'
        ? (o.selectedProduct as Record<string, unknown>)
        : null
    const cascade: Record<string, string> = {}
    if (o.cascadeSelections && typeof o.cascadeSelections === 'object') {
      for (const [k, v] of Object.entries(o.cascadeSelections as Record<string, unknown>)) {
        if (v == null || String(v).trim() === '') continue
        cascade[k] = String(v)
      }
    }
    const baseRaw = sp?.base_price
    const listUnit =
      typeof baseRaw === 'number' && Number.isFinite(baseRaw)
        ? baseRaw
        : baseRaw != null && String(baseRaw).trim() !== ''
          ? Number(baseRaw)
          : null
    const listOk = listUnit != null && Number.isFinite(listUnit)
    const discRaw = o.customer_discount_pct
    const customerDiscountPct =
      typeof discRaw === 'number' && Number.isFinite(discRaw)
        ? Math.min(100, Math.max(0, discRaw))
        : discRaw != null && String(discRaw).trim() !== ''
          ? Math.min(100, Math.max(0, Number(discRaw)))
          : null
    const pct = customerDiscountPct ?? 0
    const netUnit = listOk ? (listUnit as number) * (1 - pct / 100) : null
    const qty = typeof o.quantity === 'number' ? o.quantity : Number(o.quantity) || 0
    const unit = sp && typeof sp.unit === 'string' && sp.unit.trim() ? sp.unit : 'Nos'
    const productLabel =
      (sp && typeof sp.display_label === 'string' && sp.display_label.trim() && sp.display_label) ||
      (sp && typeof sp.name === 'string' && sp.name.trim() && sp.name) ||
      '—'
    const lineNetTotal = netUnit != null && qty > 0 ? netUnit * qty : null
    out.push({
      id: typeof o.id === 'string' ? o.id : String(o.id ?? ''),
      category: typeof o.category === 'string' ? o.category : '—',
      quantity: qty,
      unit,
      productLabel,
      listUnit: listOk ? (listUnit as number) : null,
      customerDiscountPct,
      netUnit,
      lineNetTotal,
      cascade,
    })
  }
  return out
}

const cellBorder = 'border border-[#D4D9CF] px-2.5 py-2 align-top'
const headBorder =
  'border border-[#D4D9CF] bg-[#EEF0EA] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5C6658]'

function ManualLineItemsTable({ rows }: { rows: EnquiryManualLineRow[] }) {
  if (rows.length === 0) return null
  const colCount = 9
  return (
    <div className="mt-6 min-w-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#8A9488]">
        Manual line items
      </h3>
      <div className="mt-3 w-full rounded-lg border-2 border-[#C5CBBF] bg-white">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead>
            <tr>
              <th className={`${headBorder} w-[3rem] text-center`}>#</th>
              <th className={`${headBorder} min-w-0`}>Product</th>
              <th className={`${headBorder} w-[7.5rem]`}>Category</th>
              <th className={`${headBorder} w-[3.25rem] text-right`}>Qty</th>
              <th className={`${headBorder} w-[4rem]`}>Unit</th>
              <th className={`${headBorder} w-[5.5rem] text-right whitespace-nowrap`}>List (unit)</th>
              <th className={`${headBorder} w-[4.25rem] text-right`}>Disc %</th>
              <th className={`${headBorder} w-[5.5rem] text-right whitespace-nowrap`}>Net (unit)</th>
              <th className={`${headBorder} w-[5.75rem] text-right whitespace-nowrap`}>Line net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <Fragment key={row.id || `line-${idx}`}>
                <tr className="bg-white">
                  <td className={`${cellBorder} text-center font-mono text-surface-muted`}>{idx + 1}</td>
                  <td className={`${cellBorder} min-w-0 font-medium text-gray-900 break-words`}>
                    {row.productLabel}
                  </td>
                  <td className={`${cellBorder} break-all text-surface-muted`}>{row.category}</td>
                  <td className={`${cellBorder} text-right font-mono tabular-nums`}>{row.quantity}</td>
                  <td className={`${cellBorder} text-surface-muted`}>{row.unit}</td>
                  <td className={`${cellBorder} text-right font-mono tabular-nums`}>
                    {row.listUnit != null ? formatCurrency(row.listUnit) : '—'}
                  </td>
                  <td className={`${cellBorder} text-right font-mono tabular-nums`}>
                    {row.customerDiscountPct != null ? `${row.customerDiscountPct}%` : '—'}
                  </td>
                  <td className={`${cellBorder} text-right font-mono tabular-nums`}>
                    {row.netUnit != null ? formatCurrency(row.netUnit) : '—'}
                  </td>
                  <td className={`${cellBorder} text-right font-mono font-semibold tabular-nums text-brand-green-700`}>
                    {row.lineNetTotal != null ? formatCurrency(row.lineNetTotal) : '—'}
                  </td>
                </tr>
                <tr className="bg-[#F7F8F4]">
                  <td colSpan={colCount} className="border border-[#D4D9CF] p-0 align-top">
                    <div className="flex items-stretch border-b border-[#D4D9CF] bg-[#E8EAE4] px-3 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5C6658]">
                        Specifications — line {idx + 1}
                      </span>
                    </div>
                    {Object.keys(row.cascade).length === 0 ? (
                      <div className="px-3 py-3 text-surface-muted">—</div>
                    ) : (
                      <table className="w-full border-collapse text-[12px]">
                        <thead>
                          <tr className="bg-[#F0F2EC]">
                            <th className="w-[24%] border border-[#D4D9CF] bg-[#F0F2EC] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5C6658]">
                              Field
                            </th>
                            <th className="border border-[#D4D9CF] bg-[#F0F2EC] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5C6658]">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortCascadeKeys(Object.keys(row.cascade)).map((k) => (
                            <tr key={k} className="bg-white">
                              <td className={`${cellBorder} w-[24%] font-medium text-[#5C6658] break-words`}>
                                {formatLabelKey(k)}
                              </td>
                              <td className={`${cellBorder} break-words text-gray-900`}>{row.cascade[k]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function clarificationHint(err: string | null): boolean {
  if (!err) return false
  const e = err.toLowerCase()
  return e.includes('clarif') || e.includes('missing') || e.includes('information')
}

export default function EnquiryDetailPage() {
  const params = useParams()
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0] ?? ''
        : ''

  const { data: enquiry, isPending, isError } = useEnquiry(id)
  const qc = useQueryClient()

  const ext = enquiry as EnquiryDetailExt | undefined

  const parsed = useMemo(
    () =>
      (ext?.parsed_data && typeof ext.parsed_data === 'object'
        ? (ext.parsed_data as Record<string, unknown>)
        : null) as Record<string, unknown> | null,
    [ext?.parsed_data],
  )

  const quoteId = useMemo(() => {
    const fromParsed = extractQuoteId(parsed)
    if (fromParsed) return fromParsed
    return null
  }, [parsed])

  const quoteNumber = useMemo(() => {
    const v = parsed?.quote_number
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }, [parsed])

  const reasoningSteps = useMemo(() => toReasoningSteps(ext?.ai_reasoning ?? null), [ext?.ai_reasoning])

  const [clientContext, setClientContext] = useState<ClientVerificationContext | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [pdfDownloadBusy, setPdfDownloadBusy] = useState(false)

  const [showManualCompletion, setShowManualCompletion] = useState(false)
  const [manualBusy, setManualBusy] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [matcherSeedVersion, setMatcherSeedVersion] = useState(0)
  const [fullManualOverride, setFullManualOverride] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)
  const [revertDraft, setRevertDraft] = useState<{ subject: string; body: string } | null>(null)

  const downloadErpExport = useCallback(async () => {
    if (!id || exportBusy) return
    setExportBusy(true)
    setExportError(null)
    try {
      const url = erpExportUrl(id)
      const resp = await fetch(url, { cache: 'no-store' })
      if (!resp.ok) {
        if (resp.status === 404) throw new Error('ERP export not available for this enquiry yet.')
        throw new Error(`Download failed (${resp.status})`)
      }
      const blob = await resp.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `EnquiryList_${id.slice(0, 8).toUpperCase()}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setExportBusy(false)
    }
  }, [exportBusy, id])

  useEffect(() => {
    async function loadClientContext() {
      if (!ext) return
      if (ext.status !== 'pending_client_verification') {
        setClientContext(null)
        return
      }

      const p = (ext.parsed_data && typeof ext.parsed_data === 'object')
        ? (ext.parsed_data as Record<string, unknown>)
        : null

      const extracted = {
        company_name: typeof p?.client_company === 'string' ? p.client_company : null,
        contact_name: typeof p?.client_name === 'string' ? p.client_name : null,
        email: typeof p?.client_email === 'string' ? p.client_email : null,
        phone: typeof p?.client_phone === 'string' ? p.client_phone : null,
        city: typeof p?.city === 'string' ? p.city : (typeof p?.location === 'string' ? p.location : null),
        country: null,
      }

      const clients = await enquiriesApi.searchClients<ClientSummary[]>()
      const ctx: ClientVerificationContext = {
        type: 'client_verification',
        summary: 'Client verification needed before quoting.',
        recommended_action: 'confirm_new',
        extracted_client: extracted,
        matched_client: null,
        client_is_new: true,
        available_clients: clients ?? [],
      }
      setClientContext(ctx)
    }

    loadClientContext().catch(() => setClientContext(null))
  }, [ext])

  const gridEntries = useMemo(() => {
    if (!parsed) return []
    const skip = new Set(['products_requested', 'matcher', 'manual_line_items'])
    return Object.entries(parsed).filter(([k]) => !skip.has(k))
  }, [parsed])

  const manualLineRows = useMemo(() => parseManualLineItemsFromParsed(parsed), [parsed])

  const matcher = useMemo(() => {
    const m = parsed?.matcher
    return m && typeof m === 'object' ? (m as Record<string, unknown>) : null
  }, [parsed])

  const matcherFilled = useMemo(() => {
    const fc = matcher?.filled_cascade
    if (!fc || typeof fc !== 'object') return {} as Record<string, string>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(fc as Record<string, unknown>)) {
      if (v != null && String(v).trim()) out[k] = String(v).trim()
    }
    return out
  }, [matcher])

  const matcherCatalogKey =
    matcher && typeof matcher.catalog_key === 'string' ? matcher.catalog_key : null

  const matcherSeedForForm = useMemo(() => {
    if (fullManualOverride || !matcherCatalogKey) return null
    const lix = matcher?.line_items
    if (Array.isArray(lix) && lix.length > 0) {
      const lines = lix.map((raw) => {
        const li = raw as Record<string, unknown>
        const fc = li.filled_cascade
        const out: Record<string, string> = {}
        if (fc && typeof fc === 'object') {
          for (const [k, v] of Object.entries(fc as Record<string, unknown>)) {
            if (v != null && String(v).trim()) out[k] = String(v).trim()
          }
        }
        const q = li.quantity
        const qty =
          typeof q === 'number' && Number.isFinite(q) && q > 0 ? Math.floor(q) : undefined
        return { filledCascade: out, quantity: qty }
      })
      return { catalogKey: matcherCatalogKey, lines }
    }
    return { catalogKey: matcherCatalogKey, filledCascade: matcherFilled }
  }, [fullManualOverride, matcherCatalogKey, matcher?.line_items, matcherFilled])

  const matcherClientHint = useMemo(() => {
    if (!matcher) return null
    const c = matcher.client
    if (!c || typeof c !== 'object') return null
    const cl = c as Record<string, unknown>
    if (cl.mode === 'existing' && typeof cl.selected_client_id === 'string') {
      return { mode: 'existing' as const, selectedClientId: cl.selected_client_id }
    }
    const sn = cl.suggested_new_client
    if ((cl.mode === 'suggested_new' || cl.mode === 'new') && sn && typeof sn === 'object') {
      const n = sn as Record<string, unknown>
      return {
        mode: 'new' as const,
        newClient: {
          company_name: typeof n.company_name === 'string' ? n.company_name : '',
          branch_name: typeof n.branch_name === 'string' ? n.branch_name : 'Head Office',
          contact_name: typeof n.contact_name === 'string' ? n.contact_name : '',
          phone: typeof n.phone === 'string' ? n.phone : '',
          email: typeof n.email === 'string' ? n.email : '',
          city: typeof n.city === 'string' ? n.city : '',
          address_line1: typeof n.address_line1 === 'string' ? n.address_line1 : '',
        },
      }
    }
    return null
  }, [matcher])

  const missingList = useMemo(() => {
    const fromParsed = parsed?.missing_fields
    if (Array.isArray(fromParsed)) {
      return fromParsed.map((x) => (typeof x === 'string' ? x : stringifyValue(x)))
    }
    const fromRow = ext?.missing_fields
    if (Array.isArray(fromRow)) {
      return fromRow.map((x) => (typeof x === 'string' ? x : stringifyValue(x)))
    }
    if (fromParsed && typeof fromParsed === 'string') return [fromParsed]
    return []
  }, [parsed, ext?.missing_fields])

  const isResolved = useMemo(() => {
    // After HITL completion a linked quotation (or a "final" status) means we should
    // not continue surfacing stale parser missing_fields on the detail page.
    if (quoteId) return true
    const st = (ext?.status ?? '').toLowerCase()
    return ['complete', 'approved', 'approved_sent', 'quoted'].includes(st)
  }, [ext?.status, quoteId])

  const showMissingCard =
    !isResolved &&
    (ext?.flow_type === 'incomplete' ||
      ext?.flow_type === 'product_incomplete' ||
      clarificationHint(ext?.error_message ?? null) ||
      missingList.length > 0)

  const emailLikeSource = useMemo(() => {
    const raw = (ext?.raw_input || '').trim()
    if (!raw) return false
    return raw.toLowerCase().includes('from:') || raw.toLowerCase().includes('subject:')
  }, [ext?.raw_input])

  const matcherCompleteness =
    matcher && typeof matcher.product_completeness === 'string' ? matcher.product_completeness : null

  const matcherConfidencePct = useMemo(() => {
    const mc = matcher?.confidence
    if (typeof mc === 'number' && Number.isFinite(mc)) {
      return Math.round(mc <= 1 ? mc * 100 : mc)
    }
    return null
  }, [matcher])

  const showMatcherRail =
    !!matcher &&
    !quoteId &&
    (ext?.status === 'matcher_ready' ||
      ext?.flow_type === 'product_incomplete' ||
      ext?.flow_type === 'product_complete')

  const submitManualFromEnquiry = useCallback(
    async (form: ManualEnquiryForm) => {
      if (!id) return
      setManualBusy(true)
      setManualError(null)
      try {
        await processManualDropdown({ ...form, targetEnquiryId: id })
        await qc.invalidateQueries({ queryKey: ['enquiry', id] })
        setShowManualCompletion(false)
      } catch (e) {
        setManualError(e instanceof Error ? e.message : 'Could not save quotation')
      } finally {
        setManualBusy(false)
      }
    },
    [id, qc],
  )

  const openRevertDraft = useCallback(async () => {
    if (!id) return
    try {
      const d = await enquiriesApi.getRevertRequestDraft<{ subject: string; body: string }>(id)
      setRevertDraft(d)
      setRevertOpen(true)
    } catch {
      setRevertDraft({
        subject: 'RE: Additional details for your enquiry',
        body: 'We need a few more details to complete your quotation. Please reply with specifications.',
      })
      setRevertOpen(true)
    }
  }, [id])

  if (!id) {
    return (
      <PageShell title="Enquiry">
        <EmptyState
          icon={FileText}
          title="Invalid enquiry"
          description="No enquiry id was provided in the URL."
        />
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell title="Enquiry">
        <EmptyState
          icon={FileText}
          title="Enquiry not found"
          description="This enquiry does not exist or could not be loaded."
        />
      </PageShell>
    )
  }

  if (isPending || !ext) {
    return (
      <PageShell title="Enquiry">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-surface-muted">
          <Skeleton className="h-4 w-24" />
          <ChevronRight className="size-4 opacity-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
          <div className="space-y-4 lg:col-span-7">
            <Skeleton className="h-48 w-full rounded-xl border border-[#E2E6DC]" />
            <Skeleton className="h-64 w-full rounded-xl border border-[#E2E6DC]" />
            <Skeleton className="h-32 w-full rounded-xl border border-[#E2E6DC]" />
          </div>
          <div className="space-y-4 lg:col-span-3">
            <Skeleton className="h-40 w-full rounded-xl border border-[#E2E6DC]" />
            <Skeleton className="h-36 w-full rounded-xl border border-[#E2E6DC]" />
          </div>
        </div>
      </PageShell>
    )
  }

  const confidencePct =
    matcherConfidencePct ??
    (ext.confidence_score != null
      ? Math.round(ext.confidence_score <= 1 ? ext.confidence_score * 100 : ext.confidence_score)
      : null)

  const clientEmailForMailto =
    typeof parsed?.client_email === 'string' && parsed.client_email.includes('@')
      ? parsed.client_email.trim()
      : ''

  const enquiryRef = (ext.enquiry_number || '').trim() || truncateId(id)

  return (
    <PageShell title={`Enquiry ${enquiryRef}`}>
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-surface-muted">
        <Link href="/enquiries" className="font-medium text-brand-green-600 hover:text-brand-green-700">
          Enquiries
        </Link>
        <ChevronRight className="size-4 opacity-50" />
        <span className="font-mono text-[12px] text-gray-700" title={id}>
          {enquiryRef}
        </span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        <div className="space-y-6 lg:col-span-7">
          {clientContext && (
            <ClientVerificationPanel />
          )}

          {emailLikeSource && (
            <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
              <h2 className="text-[15px] font-semibold text-gray-900">Source message</h2>
              <pre
                className="mt-3 max-h-[280px] overflow-y-auto rounded-lg border border-surface-border bg-[#FAFAF8] p-4 font-sans text-[13px] text-gray-800 whitespace-pre-wrap break-words"
                tabIndex={0}
              >
                {(ext.raw_input || '').trim() || '—'}
              </pre>
            </section>
          )}

          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            {!parsed ? (
              <p className="text-[14px] text-surface-muted">No structured fields yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {gridEntries.map(([key, value]) => (
                    <div key={key} className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                        {formatLabelKey(key)}
                      </div>
                      <div className="mt-1 text-[14px] font-semibold text-gray-900 break-words">
                        {stringifyValue(value)}
                      </div>
                    </div>
                  ))}
                </div>
                <ManualLineItemsTable rows={manualLineRows} />
              </>
            )}
          </section>

          {reasoningSteps.length > 0 && <AIReasoningPanel reasoning={reasoningSteps} />}
        </div>

        <div className="space-y-6 lg:col-span-3 min-w-0">
          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <StatusBadge status={ext.status} className="scale-110 px-4 py-1 text-[12px]" />
              {matcherCompleteness && (
                <p className="text-center text-[12px] text-surface-muted">
                  Product:{' '}
                  <span className="font-medium text-gray-800">
                    {matcherCompleteness === 'complete' ? 'Complete' : 'Incomplete'}
                  </span>
                  {typeof matcher?.product_label === 'string' && matcher.product_label ? (
                    <>
                      {' · '}
                      <span className="text-gray-700">{matcher.product_label as string}</span>
                    </>
                  ) : null}
                </p>
              )}
              {confidencePct != null && (
                <div className="flex w-full max-w-[200px] flex-col items-center gap-2">
                  <div className="relative flex h-24 w-24 items-center justify-center">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(rgb(42 107 60) ${confidencePct * 3.6}deg, #E2E6DC 0deg)`,
                      }}
                      aria-hidden
                    />
                    <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white">
                      <span className="text-[15px] font-semibold tabular-nums text-gray-900">
                        {confidencePct}%
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Confidence
                  </span>
                  <Progress
                    value={confidencePct}
                    className="w-full max-w-[200px] [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:rounded-full [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-indicator]]:bg-brand-green-500"
                  />
                </div>
              )}
              {ext.created_at && (
                <p className="text-center text-[13px] text-surface-muted">
                  Created {formatRelativeTime(ext.created_at)}
                </p>
              )}
            </div>
          </section>

          {showMatcherRail && (
            <section className="rounded-xl border border-violet-200 bg-gradient-to-b from-violet-50/80 to-white p-5 shadow-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 text-violet-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] font-semibold text-gray-900">Matcher & next steps</h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-surface-muted">
                    Review the match confidence, then complete the specification or ask the customer for
                    details. You can always switch to full manual entry if the base product is wrong.
                  </p>
                  {Array.isArray(matcher?.missing_cascade_keys) && matcher.missing_cascade_keys.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(matcher.missing_cascade_keys as string[]).map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900 border border-amber-200"
                        >
                          Missing: {formatLabelKey(k)}
                        </span>
                      ))}
                    </div>
                  )}
                  {Array.isArray(matcher?.ambiguous_groups) && matcher.ambiguous_groups.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-amber-900/90">
                      {(matcher.ambiguous_groups as { column?: string }[]).map((g, i) => (
                        <li key={i}>
                          {g.column ? `${formatLabelKey(g.column)} — choose from catalog` : 'Ambiguous match'}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFullManualOverride(false)
                        setShowManualCompletion((v) => !v)
                      }}
                      className={buttonVariants({
                        variant: 'default',
                        size: 'sm',
                        className: 'w-full justify-center bg-brand-green-600 hover:bg-brand-green-700',
                      })}
                    >
                      {showManualCompletion ? 'Hide completion form' : 'Complete the product'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFullManualOverride(true)
                        setMatcherSeedVersion((n) => n + 1)
                        setShowManualCompletion(true)
                      }}
                      className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full' })}
                    >
                      Wrong product — full manual entry
                    </button>
                    <button
                      type="button"
                      onClick={() => void openRevertDraft()}
                      className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-full gap-1.5' })}
                    >
                      <Mail className="size-3.5" />
                      Revert to client for more details
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {showMatcherRail && showManualCompletion && (
            <section className="rounded-xl border border-surface-border bg-white p-4 shadow-sm max-h-[min(78vh,920px)] overflow-y-auto">
              {manualError && <p className="mb-3 text-[12px] text-red-600">{manualError}</p>}
              <ManualEntryForm
                onSubmitManual={submitManualFromEnquiry}
                isProcessing={manualBusy}
                prefillNotesFromEnquiry={
                  (ext.raw_input || '').trim()
                    ? `--- Original enquiry ---\n\n${(ext.raw_input || '').trim().slice(0, 10000)}`
                    : null
                }
                targetEnquiryId={id}
                matcherSeed={matcherSeedForForm}
                matcherClientHint={matcherClientHint}
                matcherSeedVersion={matcherSeedVersion}
              />
            </section>
          )}

          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <h2 className="text-[14px] font-semibold text-gray-900">Exports</h2>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={downloadErpExport}
                disabled={exportBusy}
                className={buttonVariants({
                  variant: 'secondary',
                  size: 'sm',
                  className: 'gap-1.5 justify-center',
                })}
              >
                <Download className="size-3.5" />
                {exportBusy ? 'Preparing…' : 'Download ERP Enquiry List'}
              </button>
              {exportError && <p className="text-[12px] text-red-700">{exportError}</p>}
            </div>
          </section>

          {quoteId && (
            <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
              <h2 className="text-[14px] font-semibold text-gray-900">Linked Quotation</h2>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link
                  href={`/quotations/${quoteId}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  View Quotation →
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pdfDownloadBusy}
                  className="gap-1.5"
                  onClick={() => {
                    setPdfDownloadBusy(true)
                    downloadQuotationPdf(quoteId, quoteNumber ? `${quoteNumber}.pdf` : undefined)
                      .catch((e: unknown) => window.alert(e instanceof Error ? e.message : 'Download failed'))
                      .finally(() => setPdfDownloadBusy(false))
                  }}
                >
                  <Download className="size-3.5" />
                  {pdfDownloadBusy ? 'Preparing…' : 'Download PDF'}
                </Button>
              </div>
            </section>
          )}

          {ext.error_message && (
            <section
              className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900 shadow-sm"
              role="alert"
            >
              <h2 className="text-[14px] font-semibold">Error</h2>
              <p className="mt-2 text-[13px] leading-relaxed">{ext.error_message}</p>
            </section>
          )}

          {showMissingCard && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
              <h2 className="text-[14px] font-semibold text-amber-950">Missing Information</h2>
              {missingList.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-amber-950/90">
                  {missingList.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[13px] text-amber-950/90">
                  Additional details may be required before this enquiry can be quoted. Check the
                  original input and error message above.
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      {revertOpen && revertDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revert-draft-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-surface-border bg-white p-5 shadow-xl">
            <h2 id="revert-draft-title" className="text-[15px] font-semibold text-gray-900">
              Email draft for client
            </h2>
            <p className="mt-2 text-[12px] text-surface-muted">
              Copy the text below into your mail client. You can still use &quot;Complete the product&quot; on
              this page anytime.
            </p>
            <div className="mt-3 space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Subject</div>
              <p className="rounded-lg border border-surface-border bg-surface-page px-3 py-2 text-[13px]">
                {revertDraft.subject}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Body</div>
              <textarea
                readOnly
                className="h-44 w-full rounded-lg border border-surface-border bg-surface-page p-3 font-sans text-[13px]"
                value={revertDraft.body}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                onClick={() => {
                  void navigator.clipboard.writeText(`${revertDraft.subject}\n\n${revertDraft.body}`)
                }}
              >
                Copy all
              </button>
              {clientEmailForMailto ? (
                <a
                  href={`mailto:${clientEmailForMailto}?subject=${encodeURIComponent(revertDraft.subject)}&body=${encodeURIComponent(revertDraft.body)}`}
                  className={buttonVariants({ variant: 'default', size: 'sm', className: 'gap-1.5' })}
                >
                  <Mail className="size-3.5" />
                  Open in mail
                </a>
              ) : null}
              <button
                type="button"
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'ml-auto' })}
                onClick={() => setRevertOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
