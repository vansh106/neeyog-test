'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Mail, CheckCircle2, Clock, AlertTriangle, Loader2, RefreshCcw } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import { cn, formatRelativeTime } from '@/lib/utils'
import { enquiriesApi } from '@/lib/api'
import { useEmailStore } from '@/stores/emailStore'
import LiveAgentTimeline from '@/components/upload/LiveAgentTimeline'
import type { AgentEvent, EnquiryDetail } from '@/types'

function hashColor(name: string): string {
  const colors = ['bg-brand-green-500', 'bg-brand-gold-400', 'bg-brand-navy-500', 'bg-teal-500', 'bg-rose-500']
  const c = name?.charCodeAt(0) || 0
  return colors[c % colors.length]
}

function statusDot(status: string) {
  const s = (status || '').toLowerCase()
  if (s.includes('failed') || s.includes('error')) return 'bg-red-500'
  if (s.includes('pending') || s.includes('await')) return 'bg-amber-500'
  if (s.includes('quote') || s.includes('approved') || s.includes('complete')) return 'bg-brand-green-400'
  if (s.includes('match')) return 'bg-brand-gold-400'
  if (s.includes('parse')) return 'bg-brand-navy-500'
  return 'bg-[#5a7a5e]'
}

function asAgentEvents(events: unknown[]): AgentEvent[] {
  return (events || [])
    .filter((e) => typeof e === 'object' && e !== null)
    .map((e) => e as AgentEvent)
}

export default function EmailsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const selected = sp.get('id') || ''

  const items = useEmailStore((s) => s.items)
  const setItems = useEmailStore((s) => s.setItems)
  const markRead = useEmailStore((s) => s.markRead)
  const markAllRead = useEmailStore((s) => s.markAllRead)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Mark all read when opening inbox
    markAllRead()
  }, [markAllRead])

  async function loadInbox() {
    setLoading(true)
    setError(null)
    try {
      const data = await enquiriesApi.listEmailInbox<any[]>({ limit: 50, offset: 0 })
      // backend already shapes the fields; store adds is_new/live_events
      setItems(
        (data || []).map((x) => ({
          enquiry_id: x.enquiry_id,
          sender_name: x.sender_name,
          sender_email: x.sender_email,
          company: x.company,
          subject: x.subject,
          preview: x.preview,
          category: x.category ?? null,
          status: x.status,
          flow_type: x.flow_type ?? null,
          created_at: x.created_at,
          awaiting_human: !!x.awaiting_human,
          has_quotation: !!x.has_quotation,
        })),
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInbox()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedItem = useMemo(() => items.find((i) => i.enquiry_id === selected) || null, [items, selected])

  const [detail, setDetail] = useState<EnquiryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!selected) {
      setDetail(null)
      return
    }
    markRead(selected)
    setDetailLoading(true)
    enquiriesApi
      .getEnquiry<EnquiryDetail>(selected)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selected, markRead])

  const agentEvents = useMemo(() => {
    const live = selectedItem?.live_events || []
    return asAgentEvents(live as unknown as any[])
  }, [selectedItem?.live_events])

  const isStreaming = useMemo(() => {
    // last 30s has agent_start without matching complete: best-effort
    const last = agentEvents[agentEvents.length - 1]
    return !!last && last.type === 'agent_start'
  }, [agentEvents])

  return (
    <PageShell
      title="Emails"
      subtitle="Quotation-style mail synced after the server baseline (Indiamart and direct buyers); processing is manual until enabled."
    >
      <div className="h-[calc(100vh-120px)] grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* Left: inbox */}
        <div className="rounded-xl border border-surface-border bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-green-600" />
              <h2 className="text-[14px] font-semibold text-gray-900">Inbox</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadInbox}
                className="inline-flex items-center gap-2 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] text-surface-muted hover:text-gray-900"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-2 text-[12px] text-red-700 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-4 text-[13px] text-surface-muted">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[13px] text-surface-muted">No emails yet. Keep this tab open and run sync.</p>
              </div>
            ) : (
              <div>
                {items.map((it) => {
                  const active = selected === it.enquiry_id
                  const initials = (it.company || it.sender_name || 'U').slice(0, 1).toUpperCase()
                  return (
                    <Link
                      key={it.enquiry_id}
                      href={`${pathname}?id=${it.enquiry_id}`}
                      className={cn(
                        'flex gap-3 px-4 py-3 border-b border-surface-border hover:bg-surface-page transition-colors',
                        active && 'bg-brand-green-50',
                      )}
                    >
                      <div className="relative w-12 shrink-0">
                        {it.is_new && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-green-500" />}
                        <div className={cn('ml-3 w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-semibold', hashColor(it.company || it.sender_name))}>
                          {initials}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className={cn('text-[13px] truncate', it.is_new ? 'font-semibold text-gray-900' : 'font-medium text-gray-900')}>
                            {it.company || it.sender_name}
                          </div>
                          <div className="text-[10px] font-mono text-surface-muted whitespace-nowrap">
                            {formatRelativeTime(it.created_at)}
                          </div>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <div className={cn('text-[12px] truncate', it.is_new ? 'text-gray-900' : 'text-surface-muted')}>
                            {it.subject || it.preview || '(no subject)'}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {it.category && (
                              <span className="text-[10px] rounded-full px-2 py-0.5 bg-brand-navy-50 text-brand-navy-600">
                                {it.category}
                              </span>
                            )}
                            <span className={cn('w-2 h-2 rounded-full', statusDot(it.status))} />
                          </div>
                        </div>
                        {it.live_events?.length > 0 && (
                          <div className="mt-1 text-[11px] text-brand-green-600 flex items-center gap-2">
                            <span className="inline-flex w-4 justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-green-500 animate-bounce [animation-delay:-0.2s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-green-500 animate-bounce [animation-delay:-0.1s] mx-1" />
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-green-500 animate-bounce" />
                            </span>
                            Processing…
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="rounded-xl border border-surface-border bg-white shadow-sm overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <Clock className="w-7 h-7 text-surface-muted mx-auto" />
                <p className="mt-3 text-[14px] font-medium text-gray-900">Select an email</p>
                <p className="mt-1 text-[12px] text-surface-muted">New synced emails will appear here automatically.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-surface-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 truncate">{selectedItem?.company || selectedItem?.sender_name || 'Email'}</p>
                    <p className="text-[12px] text-surface-muted truncate">{selectedItem?.sender_email || ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedItem?.awaiting_human && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Needs action
                      </span>
                    )}
                    {selectedItem?.has_quotation && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-brand-green-50 text-brand-green-700 border border-brand-green-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Quoted
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="rounded-xl border border-surface-border bg-surface-page p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Original email</div>
                  {detailLoading ? (
                    <p className="mt-2 text-[12px] text-surface-muted">Loading email…</p>
                  ) : (
                    <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800 max-h-[320px] overflow-y-auto">
                      {(detail?.raw_input || '').trim() || '(email body not available)'}
                    </pre>
                  )}
                </div>

                <LiveAgentTimeline events={agentEvents} isStreaming={isStreaming} />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/enquiries/${selected}`)}
                    className="rounded-md border border-surface-border px-3 py-2 text-[12px] text-surface-muted hover:text-gray-900"
                  >
                    View full enquiry →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  )
}

