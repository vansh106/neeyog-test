'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, ChevronRight, Download, FileText, Loader2, Mail, Sparkles, XCircle } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import AIReasoningPanel from '@/components/ui/AIReasoningPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { ClientVerificationPanel } from '@/components/upload/ClientVerificationPanel'
import ManualEntryForm from '@/components/upload/ManualEntryForm'
import { useEnquiry } from '@/lib/queries'
import EnquiryProductNotesPanel from '@/components/enquiries/EnquiryProductNotesPanel'
import EnquiryListDetailTypeEditor from '@/components/enquiries/EnquiryListDetailTypeEditor'
import {
  canGenerateQuotationFromEnquiry,
  enquiryDetailTypeLabel,
  isEnquiryDetailTypeLocked,
} from '@/lib/enquiryDetailType'
import EnquiryManualLineItemsTable, {
  parseManualLineItemsFromParsed,
} from '@/components/enquiries/EnquiryManualLineItemsTable'
import { downloadQuotationPdf, enquiriesApi, processManualDropdown } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { truncateId } from '@/lib/utils'
import type {
  ClientSummary,
  ClientVerificationContext,
  ClientVerificationResponse,
  EnquiryDetail,
  EmailApprovalInfo,
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

function clarificationHint(err: string | null): boolean {
  if (!err) return false
  const e = err.toLowerCase()
  return e.includes('clarif') || e.includes('missing') || e.includes('information')
}

export default function EnquiryDetailPage() {
  const router = useRouter()
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

  const notesReadOnly = isEnquiryDetailTypeLocked(ext?.enquiry_detail_type)
  const canGenerateQuote = canGenerateQuotationFromEnquiry(ext?.enquiry_detail_type)

  const [clientContext, setClientContext] = useState<ClientVerificationContext | null>(null)
  const [pdfDownloadBusy, setPdfDownloadBusy] = useState(false)

  const [showManualCompletion, setShowManualCompletion] = useState(false)
  const [manualBusy, setManualBusy] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [matcherSeedVersion, setMatcherSeedVersion] = useState(0)
  const [fullManualOverride, setFullManualOverride] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)
  const [revertDraft, setRevertDraft] = useState<{ subject: string; body: string } | null>(null)
  const [emailApprovalBusy, setEmailApprovalBusy] = useState(false)
  const [emailApprovalError, setEmailApprovalError] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const emailApproval = useMemo((): EmailApprovalInfo | null => {
    const fromApi = (ext as { email_approval?: EmailApprovalInfo } | undefined)?.email_approval
    if (fromApi && typeof fromApi === 'object') return fromApi
    const fromParsed = parsed?.email_approval
    if (fromParsed && typeof fromParsed === 'object') return fromParsed as EmailApprovalInfo
    return null
  }, [ext, parsed])

  const isIndiaMartEnquiry = useMemo(() => {
    const inputType = (ext?.input_type || '').toLowerCase()
    const src = typeof parsed?.enquiry_source === 'string' ? parsed.enquiry_source : ''
    return inputType === 'indiamart' || src === 'indiamart'
  }, [ext?.input_type, parsed?.enquiry_source])

  const requiresEmailApproval = useMemo(() => {
    if (isIndiaMartEnquiry) return false
    const fromApi = (ext as { requires_email_approval?: boolean } | undefined)?.requires_email_approval
    if (typeof fromApi === 'boolean') return fromApi
    const st = (ext?.status || '').toLowerCase()
    if (st === 'pending_email_approval') return true
    return (emailApproval?.status || '').toLowerCase() === 'pending'
  }, [emailApproval?.status, ext?.status, isIndiaMartEnquiry])

  const isEmailRejected = (ext?.status || '').toLowerCase() === 'email_rejected'

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

  const initialSelectedBranchId = useMemo(() => {
    if (!parsed) return null
    const mc = parsed.manual_client
    if (mc && typeof mc === 'object') {
      const m = mc as Record<string, unknown>
      if (m.mode === 'existing' && typeof m.selected_client_id === 'string' && m.selected_client_id.trim()) {
        return m.selected_client_id.trim()
      }
    }
    if (typeof parsed.branch_id === 'string' && parsed.branch_id.trim()) {
      return parsed.branch_id.trim()
    }
    return null
  }, [parsed])

  const manualClientHint = useMemo(() => {
    if (!parsed) return null
    const mc = parsed.manual_client
    if (mc && typeof mc === 'object') {
      const m = mc as Record<string, unknown>
      if (m.mode === 'existing' && typeof m.selected_client_id === 'string') {
        return { mode: 'existing' as const, selectedClientId: m.selected_client_id }
      }
      const nc = m.new_client
      if (m.mode === 'new' && nc && typeof nc === 'object') {
        const n = nc as Record<string, unknown>
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
    }
    if (typeof parsed.branch_id === 'string' && parsed.branch_id.trim()) {
      return { mode: 'existing' as const, selectedClientId: parsed.branch_id.trim() }
    }
    return null
  }, [parsed])

  const clientSummaryLabel = useMemo(() => {
    const co =
      (typeof parsed?.client_company === 'string' && parsed.client_company.trim()) ||
      (ext?.display_company || '').trim() ||
      ''
    const cn = typeof parsed?.client_name === 'string' ? parsed.client_name.trim() : ''
    if (co && cn) return `${co} — ${cn}`
    return co || cn || null
  }, [ext?.display_company, parsed])

  const initialClientEmployeeId = useMemo(() => {
    const v = parsed?.client_employee_id
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }, [parsed])

  const isManualPendingQuote = useMemo(() => {
    if (quoteId) return false
    const inputType = (ext?.input_type || '').toLowerCase()
    const flow = (ext?.flow_type || '').toLowerCase()
    return inputType === 'manual_dropdown' || inputType === 'indiamart' || flow === 'manual'
  }, [ext?.flow_type, ext?.input_type, quoteId])

  const showManualQuoteForm = isManualPendingQuote && canGenerateQuote
  const showQuoteBlockedNotice = isManualPendingQuote && !canGenerateQuote

  useEffect(() => {
    if (!canGenerateQuote) {
      setShowManualCompletion(false)
      setFullManualOverride(false)
    }
  }, [canGenerateQuote])

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
    const inputType = (ext?.input_type || '').toLowerCase()
    const src = typeof parsed?.enquiry_source === 'string' ? parsed.enquiry_source : ''
    if (inputType === 'indiamart' || src === 'indiamart') return true
    const raw = (ext?.raw_input || '').trim()
    if (!raw) return false
    return raw.toLowerCase().includes('from:') || raw.toLowerCase().includes('subject:')
  }, [ext?.input_type, ext?.raw_input, parsed?.enquiry_source])

  const showMatcherRail =
    !!matcher &&
    !quoteId &&
    !isIndiaMartEnquiry &&
    !requiresEmailApproval &&
    !isEmailRejected &&
    (ext?.status === 'matcher_ready' ||
      ext?.flow_type === 'product_incomplete' ||
      ext?.flow_type === 'product_complete')

  const handleEmailApproval = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (!id || emailApprovalBusy) return
      setEmailApprovalBusy(true)
      setEmailApprovalError(null)
      try {
        const res = await enquiriesApi.decideEmailApproval<{
          quotation_id?: string
          message?: string
        }>(id, {
          decision,
          notes: decision === 'reject' ? rejectNotes.trim() : undefined,
        })
        await qc.invalidateQueries({ queryKey: ['enquiry', id] })
        setShowRejectForm(false)
        setRejectNotes('')
        if (decision === 'approve' && res?.quotation_id) {
          router.push(`/quotations/${res.quotation_id}`)
        }
      } catch (e) {
        setEmailApprovalError(e instanceof Error ? e.message : 'Could not update email approval')
      } finally {
        setEmailApprovalBusy(false)
      }
    },
    [emailApprovalBusy, id, qc, rejectNotes, router],
  )

  const submitManualFromEnquiry = useCallback(
    async (form: ManualEnquiryForm) => {
      if (!id) return
      setManualBusy(true)
      setManualError(null)
      try {
        const res = await processManualDropdown({ ...form, targetEnquiryId: id })
        await qc.invalidateQueries({ queryKey: ['enquiry', id] })
        await qc.invalidateQueries({ queryKey: ['enquiries'] })
        setShowManualCompletion(false)
        if (res.quotation_id) {
          router.push(`/quotations/${res.quotation_id}`)
        }
      } catch (e) {
        setManualError(e instanceof Error ? e.message : 'Could not save quotation')
      } finally {
        setManualBusy(false)
      }
    },
    [id, qc, router],
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
          {requiresEmailApproval && (
            <section className="rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/90 to-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold text-gray-900">Approve this email enquiry</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-surface-muted">
                    Review the source message below. Product matching and quotation generation run only after
                    you approve this email.
                  </p>
                  {emailApprovalError && (
                    <p className="mt-3 text-[12px] text-red-600">{emailApprovalError}</p>
                  )}
                  {showRejectForm ? (
                    <div className="mt-4 space-y-3">
                      <label className="block text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                        Reason for rejection (optional)
                      </label>
                      <textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        className="min-h-[72px] w-full rounded-lg border border-surface-border bg-white p-3 text-[13px]"
                        placeholder="e.g. Not a valid RFQ, spam, duplicate enquiry…"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={emailApprovalBusy}
                          className="gap-1.5"
                          onClick={() => void handleEmailApproval('reject')}
                        >
                          {emailApprovalBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <XCircle className="size-3.5" />
                          )}
                          Confirm reject
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={emailApprovalBusy}
                          onClick={() => {
                            setShowRejectForm(false)
                            setRejectNotes('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={emailApprovalBusy}
                        className="gap-1.5 bg-brand-green-600 hover:bg-brand-green-700"
                        onClick={() => void handleEmailApproval('approve')}
                      >
                        {emailApprovalBusy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3.5" />
                        )}
                        Approve &amp; run matcher
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={emailApprovalBusy}
                        className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => setShowRejectForm(true)}
                      >
                        <XCircle className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {isEmailRejected && (
            <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 shadow-sm" role="alert">
              <h2 className="text-[15px] font-semibold text-red-900">Email enquiry rejected</h2>
              <p className="mt-1 text-[13px] text-red-800">
                Product matching was not run for this email.
                {emailApproval?.decided_by_name ? (
                  <> Rejected by {emailApproval.decided_by_name}.</>
                ) : null}
              </p>
              {emailApproval?.notes ? (
                <p className="mt-2 text-[13px] text-red-900/90">{emailApproval.notes}</p>
              ) : null}
            </section>
          )}

          {clientContext && (
            <ClientVerificationPanel />
          )}

          {showQuoteBlockedNotice && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
              <h2 className="text-[15px] font-semibold text-amber-950">Quotation not available yet</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-amber-950/90">
                This enquiry is marked as{' '}
                <span className="font-medium">{enquiryDetailTypeLabel(ext?.enquiry_detail_type)}</span>.
                Set the enquiry type to <span className="font-medium">Complete</span> before configuring
                products and generating a quotation.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-[12px] font-medium text-amber-950">Enquiry type</span>
                <EnquiryListDetailTypeEditor enquiryId={id} value={ext?.enquiry_detail_type} />
              </div>
            </section>
          )}

          {showManualQuoteForm && (
            <section className="rounded-xl border border-brand-green-200 bg-white p-5 shadow-sm">
              <h2 className="text-[15px] font-semibold text-gray-900">Add products &amp; generate quotation</h2>
              <p className="mt-1 text-[13px] text-surface-muted">
                Configure products using the manual dropdown, then generate the quotation for this enquiry.
              </p>
              {manualError && <p className="mt-3 text-[12px] text-red-600">{manualError}</p>}
              <div className="mt-4">
                <ManualEntryForm
                  stage="products"
                  onSubmitManual={submitManualFromEnquiry}
                  isProcessing={manualBusy}
                  targetEnquiryId={id}
                  matcherClientHint={manualClientHint}
                  clientSummaryLabel={clientSummaryLabel}
                  initialClientEmployeeId={initialClientEmployeeId}
                  initialSelectedBranchId={initialSelectedBranchId}
                  initialFollowUpDate={ext?.next_follow_up_date}
                  matcherSeedVersion={0}
                />
              </div>
            </section>
          )}

          {emailLikeSource && !quoteId && (
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

          {manualLineRows.length > 0 && (
            <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
              <EnquiryManualLineItemsTable rows={manualLineRows} />
            </section>
          )}

          {reasoningSteps.length > 0 && <AIReasoningPanel reasoning={reasoningSteps} />}
        </div>

        <div className="space-y-6 lg:col-span-3 min-w-0">
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
                    {canGenerateQuote ? (
                      <>
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
                      </>
                    ) : (
                      <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] leading-relaxed text-amber-950/90">
                        Set enquiry type to <span className="font-medium">Complete</span> in the panel
                        below before completing the product or generating a quotation.
                      </p>
                    )}
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

          {showMatcherRail && showManualCompletion && canGenerateQuote && (
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
                matcherClientHint={manualClientHint}
                initialSelectedBranchId={initialSelectedBranchId}
                initialFollowUpDate={ext?.next_follow_up_date}
                matcherSeedVersion={matcherSeedVersion}
              />
            </section>
          )}

          {!quoteId && (
            <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
              <h2 className="text-[14px] font-semibold text-gray-900">Enquiry type</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-surface-muted">
                Product configuration and quotation generation are available only when the enquiry type
                is Complete.
              </p>
              <div className="mt-3">
                <EnquiryListDetailTypeEditor enquiryId={id} value={ext?.enquiry_detail_type} />
              </div>
            </section>
          )}

          <EnquiryProductNotesPanel enquiryId={id} parsed={parsed} readOnly={notesReadOnly} />

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
