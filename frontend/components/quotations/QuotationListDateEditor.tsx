'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import FollowUpDateEditorDialog from '@/components/crm/FollowUpDateEditorDialog'
import { quotationsApi } from '@/lib/api'
import type { FollowUpHistoryEntry } from '@/lib/followUpTypes'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'

export function formatQuotationListDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
}

type ListingDateField = 'next_follow_up_date'

export default function QuotationListDateEditor({
  quotationId,
  field,
  value,
  note,
  history,
  className,
}: {
  quotationId: string
  field: ListingDateField
  value: string | null | undefined
  note?: string | null
  history?: FollowUpHistoryEntry[]
  className?: string
}) {
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.APPROVE_QUOTATIONS))
  const [busy, setBusy] = useState(false)

  const persist = async ({ date, note: nextNote }: { date: string; note: string }) => {
    if (field !== 'next_follow_up_date') return
    setBusy(true)
    try {
      await quotationsApi.updateListingDates(quotationId, {
        next_follow_up_date: date,
        nextFollowUpNote: nextNote || null,
      })
      await queryClient.invalidateQueries({ queryKey: ['quotations'] })
    } catch (e: unknown) {
      throw e instanceof Error ? e : new Error('Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FollowUpDateEditorDialog
      value={value}
      note={note}
      history={history}
      canEdit={canEdit}
      busy={busy}
      className={className}
      onSave={persist}
    />
  )
}
