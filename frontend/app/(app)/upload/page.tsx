'use client'

import { Suspense, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  PackageX,
} from 'lucide-react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import PageShell from '@/components/layout/PageShell'
import AIReasoningPanel from '@/components/ui/AIReasoningPanel'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import LiveAgentTimeline from '@/components/upload/LiveAgentTimeline'
import { HITLPanel } from '@/components/upload/HITLPanel'
import { ClientVerificationPanel } from '@/components/upload/ClientVerificationPanel'
import ManualEntryForm from '@/components/upload/ManualEntryForm'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { downloadQuotationPdf, enquiriesApi, processManualDropdown, uploadEmailStream } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import { useEmailSyncStatus, useTriggerEmailSync } from '@/lib/queries'
import { cn, formatCurrency, truncateId } from '@/lib/utils'
import type { EnquiryResponse, AgentEvent, HITLContext, HITLHistoryEntry, ClientVerificationContext, ClientVerificationResponse, ManualEnquiryForm } from '@/types'

type InputType = 'email' | 'indiamart' | 'manual'

type EnquiryResponseWithTotals = EnquiryResponse & {
  quote_number?: string
  total_amount?: number
  subtotal?: number
  line_items?: Array<{
    description?: string
    quantity?: number
    line_total?: number
  }>
}

const CARD_CLASS =
  'bg-white border border-[#E2E6DC] rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)]'

const PLACEHOLDER = `From: buyer@example.com
Subject: RFQ — Gate valves 4 inch

Hi,
We need:
- 4" Class 150 gate valve, CS body — Qty 2
- 6" Class 300 globe valve — Qty 1

Delivery: Mumbai
Please quote best price and lead time.

Thanks`

function TotalsBlock({ result }: { result: EnquiryResponseWithTotals }) {
  const items = result.line_items
  const hasTotals =
    typeof result.total_amount === 'number' ||
    typeof result.subtotal === 'number' ||
    (Array.isArray(items) && items.length > 0)

  if (!hasTotals) return null

  return (
    <div className="mt-6 rounded-xl border border-[#E2E6DC] bg-brand-green-50/40 p-4">
      {Array.isArray(items) && items.length > 0 && (
        <ul className="mb-4 space-y-2 text-[13px] text-gray-800">
          {items.map((line, idx) => (
            <li key={idx} className="flex justify-between gap-4 border-b border-[#E2E6DC]/80 pb-2 last:border-0 last:pb-0">
              <span className="min-w-0 truncate font-medium">{line.description ?? 'Line item'}</span>
              <span className="shrink-0 text-surface-muted">
                ×{line.quantity ?? '—'}{' '}
                {typeof line.line_total === 'number' ? formatCurrency(line.line_total) : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1 text-[14px]">
        {typeof result.subtotal === 'number' && (
          <div className="flex justify-between text-surface-muted">
            <span>Subtotal</span>
            <span className="font-mono text-gray-800">{formatCurrency(result.subtotal)}</span>
          </div>
        )}
        {typeof result.total_amount === 'number' && (
          <div className="flex justify-between pt-2 font-semibold text-gray-900">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(result.total_amount)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function UploadPageInner() {
  const searchParams = useSearchParams()
  const refEnquiryId = searchParams.get('ref')
  const tabParam = searchParams.get('tab')

  const { data: syncStatus } = useEmailSyncStatus()
  const triggerSync = useTriggerEmailSync()

  const [activeTab, setActiveTab] = useState<'paste' | 'manual'>('paste')
  const [text, setText] = useState('')
  const [inputType, setInputType] = useState<InputType>('email')
  const [isStreaming, setIsStreaming] = useState(false)
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([])
  const [finalResult, setFinalResult] = useState<EnquiryResponse | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)

  // HITL state
  const [enquiryId, setEnquiryId] = useState<string | null>(null)
  const [hitlContext, setHitlContext] = useState<HITLContext | null>(null)
  const [hitlCycle, setHitlCycle] = useState(0)
  const [hitlHistory, setHitlHistory] = useState<HITLHistoryEntry[]>([])
  const [approved, setApproved] = useState(false)

  // Client verification HITL
  const [clientContext, setClientContext] = useState<ClientVerificationContext | null>(null)
  const [clientVerified, setClientVerified] = useState<ClientVerificationResponse | null>(null)

  const [prefillManualNotes, setPrefillManualNotes] = useState<string | null>(null)
  const [pdfDownloadBusy, setPdfDownloadBusy] = useState(false)

  useEffect(() => {
    if (tabParam === 'manual') setActiveTab('manual')
  }, [tabParam])

  useEffect(() => {
    if (!refEnquiryId) {
      setPrefillManualNotes(null)
      return
    }
    let cancelled = false
    enquiriesApi
      .getEnquiry<{ raw_input?: string | null }>(refEnquiryId)
      .then((d) => {
        if (cancelled || !d?.raw_input?.trim()) return
        setPrefillManualNotes(
          `--- Reference email (enquiry ${refEnquiryId}) — use while configuring line items ---\n\n${d.raw_input.trim()}`.slice(
            0,
            12000,
          ),
        )
      })
      .catch(() => {
        if (!cancelled) setPrefillManualNotes(null)
      })
    return () => {
      cancelled = true
    }
  }, [refEnquiryId])

  const clearRightPanel = useCallback(() => {
    setAgentEvents([])
    setFinalResult(null)
    setStreamError(null)
    setHitlContext(null)
    setHitlCycle(0)
    setHitlHistory([])
    setApproved(false)
    setEnquiryId(null)
    setClientContext(null)
    setClientVerified(null)
  }, [])

  const handleEvent = useCallback((event: AgentEvent) => {
    if (event.type === 'stream_end') {
      setIsStreaming(false)
      return
    }
    if (event.type === 'enquiry_created') {
      setEnquiryId(event.enquiry_id ?? null)
    }
    if (event.type === 'client_hitl_required') {
      setClientContext(event.client_context ?? null)
      setClientVerified(null)
      setIsStreaming(false)
      return
    }
    if (event.type === 'hitl_required') {
      setHitlContext(event.hitl_context ?? null)
      setHitlCycle(event.cycle ?? 1)
      setIsStreaming(false)
      return
    }
    if (event.type === 'approved_and_sent') {
      setApproved(true)
      setHitlContext(null)
      setIsStreaming(false)
      return
    }
    if (event.type === 'result') {
      setFinalResult(event.data as unknown as EnquiryResponse)
      setIsStreaming(false)
      return
    }
    setAgentEvents((prev) => [...prev, event])
  }, [])

  const startStreaming = useCallback(async (emailText: string, itype: InputType) => {
    const trimmed = emailText.trim()
    if (!trimmed || isStreaming) return
    clearRightPanel()
    setIsStreaming(true)
    try {
      await uploadEmailStream(trimmed, itype, handleEvent)
    } catch (e) {
      setStreamError(e instanceof Error ? e.message : 'Stream failed')
      setIsStreaming(false)
    }
  }, [clearRightPanel, handleEvent, isStreaming])

  const handleSubmit = useCallback(async () => {
    await startStreaming(text, inputType)
  }, [text, inputType, startStreaming])

  const handleManualSubmit = useCallback(async (form: ManualEnquiryForm) => {
    if (isStreaming) return
    clearRightPanel()
    setIsStreaming(true)
    try {
      const res = await processManualDropdown(form)
      setFinalResult(res)
      setEnquiryId(res.enquiry_id ?? null)
    } catch (e) {
      setStreamError(e instanceof Error ? e.message : 'Manual process failed')
    } finally {
      setIsStreaming(false)
    }
  }, [clearRightPanel, isStreaming])

  const handleClear = () => {
    setText('')
    setInputType('email')
    clearRightPanel()
  }

  const result = finalResult
  const extended = result as EnquiryResponseWithTotals | undefined

  const showSuccess =
    !!result &&
    result.status !== 'failed' &&
    result.flow_type !== 'incomplete' &&
    result.flow_type !== 'not_found' &&
    (result.status === 'complete' ||
      result.status === 'approved' ||
      result.status === 'approved_sent' ||
      result.status === 'quoted' ||
      !!result.quotation_id)

  const hasActivity = agentEvents.length > 0 || isStreaming

  const renderResultBody = () => {
    if (streamError) {
      return (
        <div className={cn(CARD_CLASS, 'p-6 border-red-200 bg-red-50/50')}>
          <h2 className="text-[18px] font-semibold text-gray-900 mb-4">Processing Result</h2>
          <div className="flex gap-3 rounded-xl border border-red-200 bg-white p-4">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-600" />
            <div>
              <p className="text-[15px] font-semibold text-red-800">Request failed</p>
              <p className="mt-1 text-[14px] text-red-700">{streamError}</p>
            </div>
          </div>
        </div>
      )
    }

    if (!hasActivity && !result && !hitlContext && !clientContext) {
      return (
        <div className={cn(CARD_CLASS, 'min-h-[320px]')}>
          <h2 className="text-[18px] font-semibold text-gray-900 px-6 pt-6 pb-0">Processing Result</h2>
          <EmptyState
            icon={InboxIcon}
            title="Waiting for input"
            description="Paste an email on the left and click Process with AI"
          />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Live agent timeline */}
        {hasActivity && (
          <LiveAgentTimeline events={agentEvents} isStreaming={isStreaming} />
        )}

        {/* Client verification (Step 1) */}
        {clientContext && enquiryId && (
          <ClientVerificationPanel />
        )}

        {/* Approved success banner */}
        {approved && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(CARD_CLASS, 'p-5 border-brand-green-200 bg-brand-green-50/50')}
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-7 w-7 text-brand-green-500" />
              <div>
                <p className="text-[15px] font-semibold text-brand-green-800">Approved — Ready to Send</p>
                <p className="text-[13px] text-brand-green-700">
                  The quotation has been approved. Email sending will be activated when SMTP is configured.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* HITL Panel (Step 2) */}
        {hitlContext && enquiryId && !approved && !clientContext && (
          <HITLPanel />
        )}

        {/* Final result card */}
        {result && !hitlContext && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className={cn(CARD_CLASS, 'p-6')}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[18px] font-semibold text-gray-900">Processing Result</h2>
                <StatusBadge status={result.status} />
              </div>

              {result.status === 'failed' && (
                <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <AlertCircle className="h-6 w-6 shrink-0 text-red-600" />
                  <div>
                    <p className="text-[15px] font-semibold text-red-800">Processing failed</p>
                    <p className="mt-1 text-[14px] text-red-700">{result.message}</p>
                  </div>
                </div>
              )}

              {result.status !== 'failed' && result.flow_type === 'incomplete' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5">
                  <div className="flex gap-3">
                    <AlertCircle className="h-7 w-7 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-semibold text-amber-900">Additional Information Needed</p>
                      {result.clarification_questions ? (
                        <blockquote className="mt-4 border-l-4 border-brand-gold-400 pl-4 text-[14px] leading-relaxed text-amber-950/90">
                          {result.clarification_questions}
                        </blockquote>
                      ) : (
                        <p className="mt-2 text-[14px] text-amber-900/80">{result.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {result.status !== 'failed' && result.flow_type === 'not_found' && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
                  <div className="flex gap-3">
                    <PackageX className="h-7 w-7 shrink-0 text-orange-600" />
                    <div>
                      <p className="text-[17px] font-semibold text-orange-900">Product Not in Catalog</p>
                      <p className="mt-2 text-[14px] text-orange-900/85">{result.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {result.status !== 'failed' && showSuccess && (
                <div className="text-center">
                  <CheckCircle className="mx-auto h-16 w-16 text-brand-green-500" strokeWidth={1.25} />
                  <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.3px] text-gray-900">
                    Quotation Generated
                  </h1>
                  <p className="mt-2 font-mono text-[14px] text-surface-muted">
                    {extended?.quote_number ? (
                      <>Quote #{extended.quote_number}</>
                    ) : result.enquiry_number ? (
                      <>Enquiry <span className="text-brand-green-600">{result.enquiry_number}</span></>
                    ) : (
                      <>Enquiry <span className="text-brand-green-600">{truncateId(result.enquiry_id)}</span></>
                    )}
                  </p>
                  {result.message && (
                    <p className="mx-auto mt-2 max-w-md text-[14px] text-surface-muted">{result.message}</p>
                  )}
                  <TotalsBlock result={extended!} />
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    {result.quotation_id ? (
                      <Button
                        type="button"
                        disabled={pdfDownloadBusy}
                        className={cn(
                          buttonVariants({ variant: 'default' }),
                          'h-12 w-full bg-brand-green-500 text-white hover:bg-brand-green-600 sm:w-auto sm:min-w-[160px]',
                        )}
                        onClick={() => {
                          setPdfDownloadBusy(true)
                          downloadQuotationPdf(
                            result.quotation_id!,
                            extended?.quote_number ? `${extended.quote_number}.pdf` : undefined,
                          )
                            .catch((e: unknown) => window.alert(e instanceof Error ? e.message : 'Download failed'))
                            .finally(() => setPdfDownloadBusy(false))
                        }}
                      >
                        {pdfDownloadBusy ? 'Preparing…' : 'Download PDF'}
                      </Button>
                    ) : (
                      <Button disabled className="h-12 w-full bg-brand-green-500/50 text-white sm:w-auto sm:min-w-[160px]">
                        Download PDF
                      </Button>
                    )}
                    {result.quotation_id ? (
                      <Link
                        href={`/quotations/${result.quotation_id}`}
                        className={cn(
                          buttonVariants({ variant: 'outline' }),
                          'h-12 w-full border-[#E2E6DC] sm:w-auto sm:min-w-[160px] inline-flex items-center justify-center',
                        )}
                      >
                        View Full Quote
                      </Link>
                    ) : (
                      <Button variant="outline" disabled className="h-12 w-full sm:w-auto sm:min-w-[160px]">
                        View Full Quote
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {result.status === 'received' && !result.quotation_id && (
                <div className="rounded-xl border border-surface-border bg-surface-page p-6 text-center">
                  <InboxIcon className="mx-auto h-8 w-8 text-brand-green-400" />
                  <p className="mt-3 text-[14px] font-medium">
                    Enquiry Saved
                  </p>
                  <p className="mt-1 text-[12px] text-surface-muted">
                    Your enquiry has been received.
                    AI processing will be available
                    in the next build.
                  </p>
                </div>
              )}

              {result.status !== 'failed' &&
                !showSuccess &&
                result.status !== 'received' &&
                result.flow_type !== 'incomplete' &&
                result.flow_type !== 'not_found' && (
                  <div className="rounded-xl border border-[#E2E6DC] bg-surface-page p-4">
                    <p className="text-[14px] text-gray-800">{result.message || 'No further details.'}</p>
                  </div>
                )}
            </div>

            {result.ai_reasoning.length > 0 && (
              <div className="mt-4">
                <AIReasoningPanel reasoning={result.ai_reasoning} />
              </div>
            )}
          </motion.div>
        )}
      </div>
    )
  }

  const syncReady =
    !!syncStatus?.sync_enabled && !!syncStatus?.email_configured && !!syncStatus?.scheduler_running
  const intervalMin = syncStatus?.interval_seconds
    ? Math.max(1, Math.round(syncStatus.interval_seconds / 60))
    : 2

  return (
    <PageShell
      title="Upload"
      subtitle="Paste customer enquiry text and generate a quotation with AI"
    >
      {syncStatus && (
        <>
          {syncReady && syncStatus.email_address ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-green-200 bg-brand-green-50 px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="size-4 shrink-0 text-brand-green-500" />
                <p className="text-[13px] text-brand-green-900">
                  Auto-syncing <span className="font-medium">{syncStatus.email_address}</span> every {intervalMin}{' '}
                  min — new enquiries appear automatically
                </p>
              </div>
              <button
                type="button"
                disabled={triggerSync.isPending}
                onClick={() => triggerSync.mutate()}
                className="shrink-0 text-[13px] font-medium text-brand-green-700 hover:text-brand-green-800 disabled:opacity-50"
              >
                {triggerSync.isPending ? 'Syncing…' : 'Sync now →'}
              </button>
            </div>
          ) : (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-gold-200 bg-brand-gold-50 px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="size-4 shrink-0 text-brand-gold-400" />
                <p className="text-[13px] text-amber-950/90">
                  Email sync not configured. Add EMAIL_ADDRESS and EMAIL_APP_PASSWORD to .env to enable automatic
                  syncing.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className={cn(CARD_CLASS, 'p-6')}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const next = (v as 'paste' | 'manual') ?? 'paste'
              setActiveTab(next)
              clearRightPanel()
            }}
          >
            <TabsList variant="line" className="mb-4 w-full justify-start border-b border-surface-border p-0">
              <TabsTrigger
                value="paste"
                className="h-10 rounded-none px-3 text-[13px] data-active:text-brand-green-600 data-active:after:bg-brand-green-500"
              >
                Paste Email
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="h-10 rounded-none px-3 text-[13px] data-active:text-brand-green-600 data-active:after:bg-brand-green-500"
              >
                Manual Entry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste">
              <h2 className="text-[18px] font-semibold text-gray-900">Paste Enquiry Email</h2>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PLACEHOLDER}
                className={cn(
                  'mt-4 min-h-[280px] resize-y font-mono text-[13px]',
                  'border-brand-green-200 focus-visible:border-brand-green-500 focus-visible:ring-3 focus-visible:ring-brand-green-500/50',
                )}
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[12px] text-surface-muted">{text.length} characters</span>
                <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="text-gray-600">
                  Clear
                </Button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {(
                  [
                    { id: 'email' as const, label: 'Email' },
                    { id: 'indiamart' as const, label: 'IndiaMart' },
                    { id: 'manual' as const, label: 'Manual' },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInputType(id)}
                    className={cn(
                      'rounded-full px-4 py-2 text-[13px] font-medium transition-colors',
                      inputType === id
                        ? 'bg-brand-green-500 text-white'
                        : 'border border-[#E2E6DC] bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <PermissionGate
                permission={Permissions.UPLOAD_EMAIL}
                fallback={<p className="mt-6 text-[13px] text-surface-muted">You do not have permission to run AI email processing.</p>}
              >
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!text.trim() || isStreaming}
                  className="mt-6 h-12 w-full bg-brand-green-500 text-white hover:bg-brand-green-600"
                >
                  {isStreaming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      AI is thinking...
                    </>
                  ) : (
                    <>Process with AI →</>
                  )}
                </Button>
              </PermissionGate>
            </TabsContent>

            <TabsContent value="manual">
              <PermissionGate
                permission={Permissions.VIEW_QUOTATIONS}
                fallback={<p className="text-[13px] text-surface-muted">You do not have permission to submit manual enquiries.</p>}
              >
                <ManualEntryForm
                  key={refEnquiryId || 'no-email-ref'}
                  isProcessing={isStreaming}
                  onSubmitManual={handleManualSubmit}
                  prefillNotesFromEnquiry={prefillManualNotes}
                />
              </PermissionGate>
            </TabsContent>
          </Tabs>
        </div>

        <div className="min-w-0">{renderResultBody()}</div>
      </div>
    </PageShell>
  )
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Upload" subtitle="Paste customer enquiry text and generate a quotation with AI">
          <div className="flex justify-center py-16 text-[14px] text-surface-muted">Loading…</div>
        </PageShell>
      }
    >
      <UploadPageInner />
    </Suspense>
  )
}
