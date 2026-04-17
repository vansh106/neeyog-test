'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, UserCheck, UserPlus, Users } from 'lucide-react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import { Permissions } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { clientVerifyStream, downloadErpExport, enquiriesApi } from '@/lib/api'
import type { AgentEvent, ClientSummary, ClientVerificationContext, ClientVerificationResponse } from '@/types'

type Props = {
  enquiryId: string
  clientContext: ClientVerificationContext
  onEvent: (evt: AgentEvent) => void
  onVerified: (res: ClientVerificationResponse) => void
}

export default function ClientVerificationPanel({ enquiryId, clientContext, onVerified, onEvent }: Props) {
  const [mode, setMode] = useState<'new' | 'existing' | null>(null)
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<ClientSummary[]>(clientContext.available_clients ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<ClientVerificationResponse | null>(null)
  const [downloadBusy, setDownloadBusy] = useState(false)

  useEffect(() => {
    setClients(clientContext.available_clients ?? [])
  }, [clientContext.available_clients])

  const extracted = clientContext.extracted_client || {}

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.company_name.toLowerCase().includes(q))
  }, [clients, search])

  async function refreshClients(q?: string) {
    const data = await enquiriesApi.searchClients<ClientSummary[]>(q)
    setClients(data)
  }

  async function submit(decision: 'confirmed_new' | 'matched_existing' | 'skip') {
    if (isSubmitting) return
    setIsSubmitting(true)
    setResult(null)
    try {
      let verification: ClientVerificationResponse | null = null

      await clientVerifyStream(
        enquiryId,
        { decision, selected_client_id: decision === 'matched_existing' ? selectedId : null },
        (evt) => {
          onEvent(evt as AgentEvent)
          if (evt.type === 'client_verification_result' && evt.data) {
            verification = evt.data as unknown as ClientVerificationResponse
            setResult(verification)
            onVerified(verification)
          }
        },
      )

      // If for some reason we didn't get the summary event, still mark as verified.
      if (!verification) {
        const fallback: ClientVerificationResponse = {
          enquiry_id: enquiryId,
          decision,
          client_id: null,
          company_name: extracted.company_name ?? null,
          erp_export_available: false,
          erp_export_path: null,
          message: 'Client verified, proceeding to quotation',
        }
        setResult(fallback)
        onVerified(fallback)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function downloadExport() {
    if (!result?.erp_export_available || downloadBusy) return
    setDownloadBusy(true)
    try {
      await downloadErpExport(enquiryId)
    } finally {
      setDownloadBusy(false)
    }
  }

  return (
    <PermissionGate
      permission={Permissions.CLIENT_VERIFY}
      fallback={<p className="text-[13px] text-surface-muted">You don&apos;t have permission to verify clients.</p>}
    >
    <div className="rounded-xl border-t-[3px] border-t-brand-navy-500 border border-surface-border bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-surface-border bg-brand-navy-50/40">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy-100">
            <UserCheck className="h-4 w-4 text-brand-navy-600" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-gray-900">Client Verification</p>
            <p className="text-[12px] text-surface-muted">Step 1 of 2</p>
          </div>
        </div>
        <span className="text-[12px] text-brand-navy-700">Required before quoting</span>
      </div>

      <div className="p-5 space-y-4">
        <div className="rounded-xl bg-surface-page border border-surface-border p-4">
          <p className="text-[12px] text-surface-muted mb-2">AI identified this client:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
            <div className="sm:col-span-2 text-[15px] font-semibold text-gray-900">
              {extracted.company_name || 'Unknown company'}
            </div>
            <div className="text-surface-muted">
              <span className="font-medium text-gray-800">Contact:</span> {extracted.contact_name || '—'}
            </div>
            <div className="text-surface-muted">
              <span className="font-medium text-gray-800">City:</span> {extracted.city || '—'}
            </div>
            <div className="text-surface-muted">
              <span className="font-medium text-gray-800">Email:</span> {extracted.email || '—'}
            </div>
            <div className="text-surface-muted">
              <span className="font-medium text-gray-800">Phone:</span> {extracted.phone || '—'}
            </div>
          </div>
          <div className="mt-3">
            {clientContext.client_is_new ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[12px] text-amber-900">
                New Client — Not in database
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-brand-green-200 bg-brand-green-50 px-2 py-0.5 text-[12px] text-brand-green-800">
                Possible Match Found
              </span>
            )}
          </div>
        </div>

        {result?.erp_export_available ? (
          <div className="rounded-xl border border-brand-green-200 bg-brand-green-50/40 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-brand-green-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-brand-green-900">Client Added & ERP Export Ready</p>
                <p className="mt-1 text-[13px] text-brand-green-800">
                  Import this file into your ERP system to register the enquiry.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={downloadExport}
                    disabled={downloadBusy}
                    className="bg-brand-green-500 text-white hover:bg-brand-green-600"
                  >
                    {downloadBusy ? (
                      <>Preparing…</>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download Enquiry List
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            className={cn(
              'rounded-xl border p-4',
              mode === 'new' ? 'border-brand-green-300 bg-brand-green-50/30' : 'border-surface-border bg-white',
            )}
          >
            <div className="flex items-start gap-3">
              <UserPlus className="h-5 w-5 text-brand-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-900">Yes, this is a new client</p>
                <p className="mt-1 text-[13px] text-surface-muted">
                  Add them to the system and generate ERP Enquiry List
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant={mode === 'new' ? 'default' : 'outline'}
                onClick={() => setMode('new')}
                className={cn(mode === 'new' && 'bg-brand-green-500 text-white hover:bg-brand-green-600')}
              >
                Select
              </Button>
            </div>
            {mode === 'new' && (
              <div className="mt-4 space-y-2 text-[13px] text-surface-muted">
                <p>This will:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Create a client record</li>
                  <li>Generate ERP Enquiry List (Excel)</li>
                  <li>Continue to quotation</li>
                </ul>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submit('confirmed_new')}
                  className="mt-2 w-full bg-brand-green-500 text-white hover:bg-brand-green-600"
                >
                  Confirm New Client →
                </Button>
              </div>
            )}
          </div>

          <div
            className={cn(
              'rounded-xl border p-4',
              mode === 'existing' ? 'border-brand-navy-300 bg-brand-navy-50/30' : 'border-surface-border bg-white',
            )}
          >
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-brand-navy-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-900">No, select existing client</p>
                <p className="mt-1 text-[13px] text-surface-muted">This client already exists in our system</p>
              </div>
            </div>
            <div className="mt-3">
              <Button type="button" variant={mode === 'existing' ? 'default' : 'outline'} onClick={() => setMode('existing')}>
                Select
              </Button>
            </div>
            {mode === 'existing' && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients..."
                    className="h-9"
                  />
                  <Button type="button" variant="outline" onClick={() => refreshClients(search)} disabled={isSubmitting}>
                    Search
                  </Button>
                </div>
                <div className="max-h-44 overflow-auto space-y-2 pr-1">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'w-full text-left rounded-lg border px-3 py-2 transition-colors',
                        selectedId === c.id ? 'border-brand-navy-400 bg-brand-navy-50/40' : 'border-surface-border hover:bg-surface-page',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 truncate">{c.company_name}</p>
                          <p className="text-[12px] text-surface-muted truncate">
                            {(c.contact_name || '—') + (c.city ? ` • ${c.city}` : '')}
                          </p>
                        </div>
                        {c.erp_code ? (
                          <span className="shrink-0 rounded-full bg-brand-navy-100 text-brand-navy-700 px-2 py-0.5 text-[11px] font-mono">
                            {c.erp_code}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  disabled={!selectedId || isSubmitting}
                  onClick={() => submit('matched_existing')}
                  className="w-full bg-brand-navy-500 text-white hover:bg-brand-navy-600 disabled:opacity-50"
                >
                  Confirm Selection →
                </Button>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => submit('skip')}
          className="text-[12px] text-surface-muted hover:text-gray-800 disabled:opacity-50"
        >
          Skip client verification →
        </button>
      </div>
    </div>
    </PermissionGate>
  )
}

