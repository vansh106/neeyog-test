'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import FollowUpDateEditorDialog from '@/components/crm/FollowUpDateEditorDialog'
import { enquiriesApi } from '@/lib/api'
import type { FollowUpHistoryEntry } from '@/lib/followUpTypes'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'

export default function EnquiryListDateEditor({
  enquiryId,
  value,
  note,
  history,
  className,
}: {
  enquiryId: string
  value: string | null | undefined
  note?: string | null
  history?: FollowUpHistoryEntry[]
  className?: string
}) {
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.APPROVE_QUOTATIONS))
  const [busy, setBusy] = useState(false)

  const persist = async ({ date, note: nextNote }: { date: string; note: string }) => {
    setBusy(true)
    try {
      await enquiriesApi.updateListingDates(enquiryId, {
        next_follow_up_date: date,
        nextFollowUpNote: nextNote || null,
      })
      await queryClient.invalidateQueries({ queryKey: ['enquiries'] })
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
