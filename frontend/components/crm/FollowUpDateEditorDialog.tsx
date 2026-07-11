'use client'

import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'

import { formatQuotationListDate } from '@/components/quotations/QuotationListDateEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatFollowUpHistoryDate, type FollowUpHistoryEntry } from '@/lib/followUpTypes'
import { cn } from '@/lib/utils'

function toInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

type Props = {
  label?: string
  value: string | null | undefined
  note?: string | null
  history?: FollowUpHistoryEntry[]
  canEdit: boolean
  required?: boolean
  busy?: boolean
  className?: string
  onSave: (payload: { date: string; note: string }) => Promise<void>
}

export default function FollowUpDateEditorDialog({
  label = 'Next follow-up',
  value,
  note,
  history = [],
  canEdit,
  required = true,
  busy = false,
  className,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false)
  const [draftDate, setDraftDate] = useState(() => toInputValue(value))
  const [draftNote, setDraftNote] = useState(() => (note || '').trim())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraftDate(toInputValue(value))
    setDraftNote((note || '').trim())
    setError(null)
  }, [open, value, note])

  const display = formatQuotationListDate(value ? `${value}T12:00:00` : null)
  const missing = required && !value

  async function handleSave() {
    if (!draftDate.trim()) {
      setError('Follow-up date is required')
      return
    }
    setError(null)
    try {
      await onSave({ date: draftDate, note: draftNote.trim() })
      setOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save follow-up date')
    }
  }

  if (!canEdit) {
    return (
      <span
        className={cn(
          'text-[13px]',
          missing ? 'font-medium text-red-600' : 'text-gray-900',
          className,
        )}
      >
        {display}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-w-[88px] items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-[#EEF0E8] disabled:opacity-50',
          className,
        )}
      >
        <Calendar className="size-3 shrink-0 text-surface-muted" />
        <span
          className={cn(
            'text-[13px]',
            missing ? 'font-medium text-red-600' : 'text-gray-900',
          )}
        >
          {display}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Set the next follow-up date. Add an optional note for your team.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
            <div>
              <label className="text-[12px] font-medium text-gray-900">
                Follow-up date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={draftDate}
                disabled={busy}
                className="mt-1.5 h-10 w-full rounded-md border border-[#E2E6DC] bg-white px-3 text-[13px] text-gray-900"
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-gray-900">Follow-up note (optional)</label>
              <textarea
                value={draftNote}
                disabled={busy}
                rows={3}
                placeholder="e.g. Call client about valve sizes"
                className="mt-1.5 w-full resize-y rounded-md border border-[#E2E6DC] bg-white px-3 py-2 text-[13px] text-gray-900 placeholder:text-surface-muted"
                onChange={(e) => setDraftNote(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-[#E8EBE4] bg-[#FAFAF8] p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                Follow-up history
              </p>
              {history.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {history.map((entry, index) => (
                    <li
                      key={`${entry.date}-${entry.recorded_at || index}`}
                      className="border-t border-[#E8EBE4] pt-2 first:border-t-0 first:pt-0"
                    >
                      <p className="text-[13px] font-medium text-gray-900">
                        {formatFollowUpHistoryDate(entry.date)}
                      </p>
                      {entry.note ? (
                        <p className="mt-0.5 text-[12px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                          {entry.note}
                        </p>
                      ) : null}
                      {entry.recorded_by_name ? (
                        <p className="mt-0.5 text-[11px] text-surface-muted">
                          by {entry.recorded_by_name}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] text-surface-muted">
                  No previous follow-up dates yet. When you change the follow-up date, the earlier
                  date and note are saved here.
                </p>
              )}
            </div>

            {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
          </div>

          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              className="bg-brand-green-600 hover:bg-brand-green-700"
              onClick={() => void handleSave()}
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
