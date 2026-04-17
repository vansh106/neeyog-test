'use client'

import { useCallback, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  Loader2,
  Wand2,
} from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { Permissions } from '@/lib/permissions'
import { submitReviewStream } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import LiveAgentTimeline from '@/components/upload/LiveAgentTimeline'
import StatusBadge from '@/components/ui/StatusBadge'
import type { AgentEvent, HITLContext, HITLHistoryEntry, EnquiryResponse } from '@/types'

const PROMPT_CHIPS = [
  'The missing fields don\'t matter, generate the quote',
  'Add a question about operating pressure',
  'Suggest the best product yourself',
  'Rephrase the questions more professionally',
  'Ask for delivery location too',
]

interface HITLPanelProps {
  enquiryId: string
  hitlContext: HITLContext
  flowType: string
  cycle: number
  hitlHistory: HITLHistoryEntry[]
  onDecisionSubmitted: (result: EnquiryResponse | null) => void
  onHITLRequired: (ctx: HITLContext, cycle: number) => void
  onApproved: () => void
  onNewEvents: (events: AgentEvent[]) => void
}

export default function HITLPanel({
  enquiryId,
  hitlContext,
  flowType,
  cycle,
  hitlHistory,
  onDecisionSubmitted,
  onHITLRequired,
  onApproved,
  onNewEvents,
}: HITLPanelProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submittingAction, setSubmittingAction] = useState<string | null>(null)
  const [editExpanded, setEditExpanded] = useState(false)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [editedEmail, setEditedEmail] = useState(hitlContext.draft_email ?? '')
  const [customPrompt, setCustomPrompt] = useState('')
  const [resumeEvents, setResumeEvents] = useState<AgentEvent[]>([])
  const [isResumeStreaming, setIsResumeStreaming] = useState(false)

  const handleSubmit = useCallback(
    async (decision: string) => {
      if (submitting) return
      setSubmitting(true)
      setSubmittingAction(decision)
      setResumeEvents([])
      setIsResumeStreaming(true)

      const body: { decision: string; edited_email?: string; human_prompt?: string } = { decision }
      if (decision === 'edit_email') body.edited_email = editedEmail
      if (decision === 'custom_prompt') body.human_prompt = customPrompt

      try {
        await submitReviewStream(enquiryId, body, (event) => {
          if (event.type === 'stream_end') {
            setIsResumeStreaming(false)
            setSubmitting(false)
            return
          }
          if (event.type === 'hitl_required') {
            setIsResumeStreaming(false)
            setSubmitting(false)
            onHITLRequired(event.hitl_context!, event.cycle ?? cycle + 1)
            return
          }
          if (event.type === 'approved_and_sent') {
            setIsResumeStreaming(false)
            setSubmitting(false)
            onApproved()
            return
          }
          if (event.type === 'result') {
            onDecisionSubmitted(event.data as unknown as EnquiryResponse)
            return
          }
          setResumeEvents((prev) => [...prev, event])
          onNewEvents([event])
        })
      } catch {
        setSubmitting(false)
        setIsResumeStreaming(false)
      }
    },
    [submitting, enquiryId, editedEmail, customPrompt, cycle, onDecisionSubmitted, onHITLRequired, onApproved, onNewEvents],
  )

  const totalAmount = hitlContext.draft_quotation
    ? (hitlContext.draft_quotation as Record<string, unknown>).total_amount
    : null

  const showApprove = hitlContext.options_available.includes('approve_send')
  const showEdit = hitlContext.options_available.includes('edit_email')
  const showPrompt = hitlContext.options_available.includes('custom_prompt')

  return (
    <div className="space-y-4">
      {/* Main HITL card */}
      <div className="rounded-xl border-t-[3px] border-t-brand-gold-400 border border-surface-border bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-border bg-brand-gold-50/30">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold-100">
              <Clock className="h-4 w-4 text-brand-gold-600" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-gray-900">Review Required</h2>
              <span className="font-mono text-[11px] text-brand-gold-600">Cycle {cycle}</span>
            </div>
          </div>
          <StatusBadge status={flowType} />
        </div>

        {/* Summary */}
        <div className="px-5 py-4">
          <div className="rounded-lg border-l-4 border-brand-gold-400 bg-brand-gold-50/50 px-4 py-3">
            <p className="text-[13px] leading-relaxed text-gray-800">{hitlContext.summary}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 space-y-3">
          {/* Approve */}
          {showApprove && (
            <PermissionGate
              permission={Permissions.HITL_APPROVE}
              fallback={<p className="text-[13px] text-surface-muted">You don&apos;t have permission to approve.</p>}
            >
            <div className="rounded-xl border border-brand-green-200 bg-brand-green-50/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-green-100">
                  <Check className="h-3.5 w-3.5 text-brand-green-600" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-gray-900">Approve and Send</p>
                  <p className="mt-0.5 text-[12px] text-surface-muted">
                    {hitlContext.draft_quotation
                      ? `Send quotation to client${typeof totalAmount === 'number' ? ` — ${formatCurrency(totalAmount)}` : ''}`
                      : 'Approve the drafted email and send to client'}
                  </p>
                  <Button
                    onClick={() => handleSubmit('approve_send')}
                    disabled={submitting}
                    className="mt-3 bg-brand-green-500 text-white hover:bg-brand-green-600"
                    size="sm"
                  >
                    {submitting && submittingAction === 'approve_send' ? (
                      <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Processing...</>
                    ) : (
                      <>Approve and Send →</>
                    )}
                  </Button>
                  <p className="mt-2 text-[11px] text-surface-muted">
                    Email sending will be activated when SMTP is configured
                  </p>
                </div>
              </div>
            </div>
            </PermissionGate>
          )}

          {/* Edit Email */}
          {showEdit && (
            <PermissionGate
              permission={Permissions.HITL_EDIT_EMAIL}
              fallback={<p className="text-[13px] text-surface-muted">You don&apos;t have permission to edit the draft email.</p>}
            >
            <div className="rounded-xl border border-surface-border bg-white">
              <button
                type="button"
                onClick={() => setEditExpanded(!editExpanded)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                {editExpanded ? <ChevronDown className="h-4 w-4 text-surface-muted" /> : <ChevronRight className="h-4 w-4 text-surface-muted" />}
                <Edit3 className="h-4 w-4 text-brand-gold-500" />
                <span className="text-[13px] font-medium text-gray-900">Edit the Email Draft</span>
              </button>
              {editExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  <Textarea
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="min-h-[160px] font-mono text-[13px] border-brand-gold-200 focus-visible:ring-brand-gold-400"
                    placeholder="Edit the email draft here..."
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-surface-muted">{editedEmail.length} characters</span>
                    <Button
                      onClick={() => handleSubmit('edit_email')}
                      disabled={submitting || !editedEmail.trim()}
                      className="bg-brand-gold-500 text-white hover:bg-brand-gold-600"
                      size="sm"
                    >
                      {submitting && submittingAction === 'edit_email' ? (
                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Processing...</>
                      ) : (
                        <>Use This Email →</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            </PermissionGate>
          )}

          {/* Custom Prompt */}
          {showPrompt && (
            <PermissionGate
              permission={Permissions.HITL_CUSTOM_PROMPT}
              fallback={<p className="text-[13px] text-surface-muted">You don&apos;t have permission to use custom AI instructions.</p>}
            >
            <div className="rounded-xl border border-surface-border bg-white">
              <button
                type="button"
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                {promptExpanded ? <ChevronDown className="h-4 w-4 text-surface-muted" /> : <ChevronRight className="h-4 w-4 text-surface-muted" />}
                <Wand2 className="h-4 w-4 text-brand-navy-500" />
                <span className="text-[13px] font-medium text-gray-900">Give AI an Instruction</span>
              </button>
              {promptExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-[12px] text-surface-muted">Tell the AI what to do next. Be specific.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setCustomPrompt(chip)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="min-h-[100px] text-[13px] border-blue-200 focus-visible:ring-brand-navy-500"
                    placeholder='e.g. The missing size info doesn&apos;t matter, assume 2 inch and generate the quotation...'
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleSubmit('custom_prompt')}
                      disabled={submitting || !customPrompt.trim()}
                      className="bg-brand-navy-500 text-white hover:bg-brand-navy-600"
                      size="sm"
                    >
                      {submitting && submittingAction === 'custom_prompt' ? (
                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Processing...</>
                      ) : (
                        <>Send Instruction →</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Resume agent timeline */}
      {(resumeEvents.length > 0 || isResumeStreaming) && (
        <LiveAgentTimeline events={resumeEvents} isStreaming={isResumeStreaming} />
      )}

      {/* Decision History */}
      {hitlHistory.length > 0 && (
        <div className="rounded-xl border border-surface-border bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            {historyExpanded ? <ChevronDown className="h-4 w-4 text-surface-muted" /> : <ChevronRight className="h-4 w-4 text-surface-muted" />}
            <span className="text-[12px] font-medium text-surface-muted uppercase tracking-wide">
              Decision History ({hitlHistory.length})
            </span>
          </button>
          {historyExpanded && (
            <div className="px-4 pb-4 space-y-2">
              {hitlHistory.map((entry) => (
                <div key={entry.cycle} className="flex items-start gap-2 text-[12px] font-mono text-surface-muted">
                  <span className="shrink-0 text-gray-500">#{entry.cycle}</span>
                  <StatusBadge status={entry.decision} />
                  {entry.prompt && (
                    <span className="truncate text-gray-600">— &quot;{entry.prompt}&quot;</span>
                  )}
                  {entry.ai_interpretation?.reasoning && (
                    <span className="truncate text-brand-navy-500">→ {entry.ai_interpretation.reasoning}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
