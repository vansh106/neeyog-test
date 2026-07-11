'use client'

import { Suspense, useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2, Mail } from 'lucide-react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import PageShell from '@/components/layout/PageShell'
import ManualEntryForm from '@/components/upload/ManualEntryForm'
import { createManualEnquiry, enquiriesApi, indiamartApi } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import { useEmailSyncStatus, useTriggerEmailSync } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { ManualEnquiryCreateForm, IndiaMartPrefillResponse } from '@/types'

const CARD_CLASS =
  'bg-white border border-[#E2E6DC] rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)]'

function UploadPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refEnquiryId = searchParams.get('ref')
  const indiamartQueryId = searchParams.get('indiamart')

  const { data: syncStatus } = useEmailSyncStatus()
  const triggerSync = useTriggerEmailSync()

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [prefillManualNotes, setPrefillManualNotes] = useState<string | null>(null)
  const [indiamartPrefill, setIndiamartPrefill] = useState<IndiaMartPrefillResponse | null>(null)
  const [indiamartPrefillError, setIndiamartPrefillError] = useState<string | null>(null)

  useEffect(() => {
    if (!indiamartQueryId) {
      setIndiamartPrefill(null)
      setIndiamartPrefillError(null)
      return
    }
    let cancelled = false
    indiamartApi
      .getPrefill<IndiaMartPrefillResponse>(indiamartQueryId)
      .then((data) => {
        if (cancelled) return
        if (!data.can_create_inquiry && data.linked_enquiry_id) {
          router.replace(`/enquiries/${data.linked_enquiry_id}`)
          return
        }
        setIndiamartPrefill(data)
        setPrefillManualNotes(data.notes)
        setIndiamartPrefillError(null)
      })
      .catch((e) => {
        if (!cancelled) {
          setIndiamartPrefill(null)
          setIndiamartPrefillError(e instanceof Error ? e.message : 'Could not load IndiaMart lead')
        }
      })
    return () => {
      cancelled = true
    }
  }, [indiamartQueryId, router])

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

  const handleCreateManualEnquiry = useCallback(
    async (form: ManualEnquiryCreateForm) => {
      if (isProcessing) return
      setError(null)
      setIsProcessing(true)
      try {
        const res = await createManualEnquiry(form)
        if (res.enquiry_id) {
          router.push(`/enquiries/${res.enquiry_id}`)
          return
        }
        setError('Enquiry was created but no id was returned')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create enquiry')
      } finally {
        setIsProcessing(false)
      }
    },
    [isProcessing, router],
  )

  const syncReady =
    !!syncStatus?.sync_enabled && !!syncStatus?.email_configured && !!syncStatus?.scheduler_running
  const intervalMin = syncStatus?.interval_seconds
    ? Math.max(1, Math.round(syncStatus.interval_seconds / 60))
    : 2

  return (
    <PageShell title="Upload" subtitle="Create a new enquiry and configure products on the enquiry detail page">
      {syncStatus && (
        <>
          {syncReady && syncStatus.email_address ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-green-200 bg-brand-green-50 px-4 py-2">
              <div className="flex min-w-0 items-center gap-2">
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
              <div className="flex min-w-0 items-center gap-2">
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

      <div className={cn(CARD_CLASS, 'mx-auto max-w-3xl p-6')}>
        <h2 className="text-[18px] font-semibold text-gray-900">New Enquiry</h2>

        {error && (
          <div className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-[14px] text-red-700">{error}</p>
          </div>
        )}

        {indiamartQueryId && (
          <div className="mt-4 rounded-lg border border-brand-green-200 bg-brand-green-50/50 px-4 py-3 text-[13px] text-gray-800">
            {indiamartPrefillError ? (
              <p className="text-red-700">{indiamartPrefillError}</p>
            ) : indiamartPrefill ? (
              <p>
                Creating enquiry from IndiaMart lead{' '}
                <span className="font-mono text-[12px]">{indiamartPrefill.unique_query_id}</span>. Client details are
                pre-filled — review and click Create enquiry.
              </p>
            ) : (
              <p className="text-surface-muted">Loading IndiaMart lead…</p>
            )}
          </div>
        )}

        <p className="mt-4 text-[13px] text-surface-muted">
          Select or add a client to create an enquiry. You&apos;ll add products and generate the quotation on the
          enquiry detail page.
        </p>

        <PermissionGate
          permission={Permissions.VIEW_QUOTATIONS}
          fallback={
            <p className="mt-4 text-[13px] text-surface-muted">You do not have permission to submit manual enquiries.</p>
          }
        >
          <div className="mt-6">
            <ManualEntryForm
              key={indiamartQueryId || refEnquiryId || 'new-enquiry'}
              stage="client"
              isProcessing={isProcessing}
              onSubmitManual={() => {}}
              onCreateEnquiry={handleCreateManualEnquiry}
              prefillNotesFromEnquiry={prefillManualNotes}
              matcherClientHint={indiamartPrefill?.client_hint ?? null}
              initialEnquirySource={indiamartPrefill?.source ?? (indiamartQueryId ? 'indiamart' : undefined)}
              indiamartQueryId={indiamartQueryId}
            />
          </div>
        </PermissionGate>

        {isProcessing && (
          <div className="mt-4 flex items-center gap-2 text-[13px] text-surface-muted">
            <Loader2 className="size-4 animate-spin" />
            Creating enquiry…
          </div>
        )}
      </div>
    </PageShell>
  )
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Upload" subtitle="Create a new enquiry">
          <div className="flex justify-center py-16 text-[14px] text-surface-muted">Loading…</div>
        </PageShell>
      }
    >
      <UploadPageInner />
    </Suspense>
  )
}
