'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronRight, Download, FileText } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import AIReasoningPanel from '@/components/ui/AIReasoningPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { buttonVariants } from '@/components/ui/button'
import ClientVerificationPanel from '@/components/upload/ClientVerificationPanel'
import HITLPanel from '@/components/upload/HITLPanel'
import ProductCompletionPanel from '@/components/upload/ProductCompletionPanel'
import { submitProductCompleteStream } from '@/lib/api'
import { useEnquiry, useEnquiryHITLState } from '@/lib/queries'
import { enquiriesApi, quotationsApi } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { formatRelativeTime } from '@/lib/utils'
import type { AgentEvent, ClientVerificationContext, ClientVerificationResponse, EnquiryDetail, HITLContext, HITLHistoryEntry, EnquiryResponse, ProductCompletionContext } from '@/types'

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

function isProductRow(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
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
  const { data: hitlState } = useEnquiryHITLState(id)
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

  const reasoningSteps = useMemo(() => toReasoningSteps(ext?.ai_reasoning ?? null), [ext?.ai_reasoning])

  const [clientContext, setClientContext] = useState<ClientVerificationContext | null>(null)
  const [clientEvents, setClientEvents] = useState<AgentEvent[]>([])
  const [productContext, setProductContext] = useState<ProductCompletionContext | null>(null)
  const [hitlContext, setHitlContext] = useState<HITLContext | null>(null)
  const [hitlCycle, setHitlCycle] = useState(0)
  const [hitlHistory, setHitlHistory] = useState<HITLHistoryEntry[]>([])
  const [approved, setApproved] = useState(false)
  const [hitlEvents, setHitlEvents] = useState<AgentEvent[]>([])

  useEffect(() => {
    // Decide which HITL to show, based on hitl-state next_nodes.
    if (!hitlState?.awaiting_human) {
      setClientContext(null)
      setProductContext(null)
      setHitlContext(null)
      return
    }
    const next = hitlState.next_nodes ?? []
    if (next.includes('client_hitl_router') && hitlState.hitl_context) {
      setClientContext(hitlState.hitl_context as unknown as ClientVerificationContext)
      setProductContext(null)
      setHitlContext(null)
      return
    }
    if (next.includes('product_hitl_router') && hitlState.product_hitl_context) {
      setProductContext(hitlState.product_hitl_context as ProductCompletionContext)
      setClientContext(null)
      setHitlContext(null)
      return
    }
    if (next.includes('hitl_router_agent') && hitlState.hitl_context) {
      setHitlContext(hitlState.hitl_context as HITLContext)
      setHitlCycle(hitlState.hitl_cycle ?? 0)
      setHitlHistory(hitlState.hitl_history ?? [])
      setClientContext(null)
      setProductContext(null)
      return
    }
  }, [hitlState])

  const gridEntries = useMemo(() => {
    if (!parsed) return []
    return Object.entries(parsed).filter(([k]) => k !== 'products_requested')
  }, [parsed])

  const productsRequested = useMemo(() => {
    const pr = parsed?.products_requested
    if (!Array.isArray(pr)) return []
    return pr.filter(isProductRow)
  }, [parsed])

  // Missing fields UI removed — product completion HITL replaces it.

  const rawBlock = useMemo(() => {
    const raw = ext?.raw_input
    if (typeof raw === 'string' && raw.trim()) return raw
    if (parsed) return stringifyValue(parsed)
    return null
  }, [ext?.raw_input, parsed])

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <Skeleton className="h-48 w-full rounded-xl border border-[#E2E6DC]" />
            <Skeleton className="h-64 w-full rounded-xl border border-[#E2E6DC]" />
            <Skeleton className="h-32 w-full rounded-xl border border-[#E2E6DC]" />
          </div>
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 w-full rounded-xl border border-[#E2E6DC]" />
            <Skeleton className="h-36 w-full rounded-xl border border-[#E2E6DC]" />
          </div>
        </div>
      </PageShell>
    )
  }

  const confidencePct =
    ext.confidence_score != null
      ? Math.round(
          ext.confidence_score <= 1 ? ext.confidence_score * 100 : ext.confidence_score,
        )
      : null

  return (
    <PageShell title={`Enquiry ${id.slice(0, 8)}…`}>
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-surface-muted">
        <Link href="/enquiries" className="font-medium text-brand-green-600 hover:text-brand-green-700">
          Enquiries
        </Link>
        <ChevronRight className="size-4 opacity-50" />
        <span className="font-mono text-[12px] text-gray-700">{id}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {productContext && hitlState?.awaiting_human && (
            <ProductCompletionPanel
              enquiryId={id}
              context={productContext}
              isProcessing={false}
              onFillSelf={async (items) => {
                setHitlEvents([])
                await submitProductCompleteStream(id, { decision: 'fill_self', payload: { items } }, (evt) => setHitlEvents((p) => [...p, evt]))
                await qc.invalidateQueries({ queryKey: ['enquiry', id] })
                await qc.invalidateQueries({ queryKey: ['enquiry_hitl_state', id] })
                await qc.invalidateQueries({ queryKey: ['enquiries'] })
              }}
              onAskClient={async (ask) => {
                setHitlEvents([])
                await submitProductCompleteStream(id, { decision: 'ask_client', payload: { ask } }, (evt) => setHitlEvents((p) => [...p, evt]))
                await qc.invalidateQueries({ queryKey: ['enquiry', id] })
                await qc.invalidateQueries({ queryKey: ['enquiry_hitl_state', id] })
                await qc.invalidateQueries({ queryKey: ['enquiries'] })
              }}
            />
          )}

          {clientContext && (
            <ClientVerificationPanel
              enquiryId={id}
              clientContext={clientContext}
              onEvent={(evt) => setClientEvents((prev) => [...prev, evt])}
              onVerified={async (_res: ClientVerificationResponse) => {
                setClientContext(null)
                await qc.invalidateQueries({ queryKey: ['enquiry', id] })
                await qc.invalidateQueries({ queryKey: ['enquiry_hitl_state', id] })
                await qc.invalidateQueries({ queryKey: ['enquiries'] })
              }}
            />
          )}

          {hitlContext && hitlState?.awaiting_human && (
            <HITLPanel
              enquiryId={id}
              hitlContext={hitlContext}
              flowType={String(hitlState.flow_type ?? '')}
              cycle={hitlCycle}
              hitlHistory={hitlHistory}
              onDecisionSubmitted={(res: EnquiryResponse | null) => {
                void res
              }}
              onHITLRequired={(ctx, cyc) => {
                setHitlContext(ctx)
                setHitlCycle(cyc)
              }}
              onApproved={() => {
                setApproved(true)
                setHitlContext(null)
              }}
              onNewEvents={(newEvents) => setHitlEvents((prev) => [...prev, ...newEvents])}
            />
          )}

          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-gray-900">Original Input</h2>
            <pre
              className="mt-3 max-h-[200px] overflow-y-auto rounded-xl bg-[#0E1912] p-4 font-mono text-[12px] text-[#7DC088] whitespace-pre-wrap break-words"
              tabIndex={0}
            >
              {rawBlock ?? 'No raw input available'}
            </pre>
          </section>

          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-gray-900">What AI Extracted</h2>
            {!parsed ? (
              <p className="mt-3 text-[14px] text-surface-muted">No structured data was extracted.</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                {productsRequested.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#8A9488]">
                      Products requested
                    </h3>
                    <div className="mt-3 space-y-2">
                      {productsRequested.map((p, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-[#E2E6DC] bg-[#F9FAF7] p-3 text-[13px]"
                        >
                          {typeof p.product_description === 'string' && (
                            <p className="font-medium text-gray-900">{p.product_description}</p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-3 text-surface-muted">
                            {(p.size_mm != null || p.size_inch != null) && (
                              <span>
                                Size:{' '}
                                {p.size_mm != null
                                  ? `${p.size_mm} mm`
                                  : p.size_inch != null
                                    ? `${p.size_inch}"`
                                    : '—'}
                              </span>
                            )}
                            {p.quantity != null && <span>Qty: {String(p.quantity)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {reasoningSteps.length > 0 && <AIReasoningPanel reasoning={reasoningSteps} />}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <StatusBadge status={ext.status} className="scale-110 px-4 py-1 text-[12px]" />
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
                <a
                  href={quotationsApi.getPdfUrl(quoteId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'gap-1.5' })}
                >
                  <Download className="size-3.5" />
                  Download PDF
                </a>
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

          {/* Missing Information card removed */}
        </div>
      </div>
    </PageShell>
  )
}
