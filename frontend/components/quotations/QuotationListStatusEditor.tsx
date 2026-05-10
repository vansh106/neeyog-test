'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/ui/StatusBadge'
import { quotationsApi } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import {
  QUOTATION_CRM_LABELS,
  QUOTATION_CRM_STATUSES,
  type QuotationCrmStatus,
} from '@/lib/quotationCrmStatus'
import { useAuthStore } from '@/stores/authStore'
import type { QuotationListItem } from '@/types'

export default function QuotationListStatusEditor({ q }: { q: QuotationListItem }) {
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.APPROVE_QUOTATIONS))
  const [status, setStatus] = useState(q.status)
  const [remarks, setRemarks] = useState(q.status_remarks ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setStatus(q.status)
    setRemarks(q.status_remarks ?? '')
  }, [q.quotation_id, q.status, q.status_remarks])

  const persist = async (nextStatus: string, nextRemarks: string | null) => {
    setBusy(true)
    try {
      await quotationsApi.updateCrmStatus(q.quotation_id, {
        status: nextStatus,
        status_remarks: nextRemarks,
      })
      await queryClient.invalidateQueries({ queryKey: ['quotations'] })
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const onStatusChange = async (next: string) => {
    if (next === 'ongoing' || next === 'po_received') {
      setStatus(next)
      setRemarks('')
      await persist(next, null)
      return
    }
    setStatus(next)
  }

  const saveLostHold = async () => {
    if (!remarks.trim()) {
      window.alert('Add remarks for Lost or Hold before saving.')
      return
    }
    await persist(status, remarks.trim())
  }

  if (!canEdit) {
    return (
      <div className="max-w-[200px]">
        <StatusBadge status={q.status} kind="quotation_crm" />
        {(q.status === 'lost' || q.status === 'hold') && q.status_remarks && (
          <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-surface-muted" title={q.status_remarks}>
            {q.status_remarks}
          </p>
        )}
      </div>
    )
  }

  const showRemarks = status === 'lost' || status === 'hold'

  return (
    <div className="max-w-[220px] space-y-1.5">
      <select
        className="h-8 w-full rounded-md border border-[#E2E6DC] bg-white px-2 text-[12px] text-gray-900 disabled:opacity-50"
        value={status}
        disabled={busy}
        onChange={(e) => void onStatusChange(e.target.value)}
      >
        {QUOTATION_CRM_STATUSES.map((v) => (
          <option key={v} value={v}>
            {QUOTATION_CRM_LABELS[v as QuotationCrmStatus]}
          </option>
        ))}
      </select>
      {showRemarks && (
        <>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={busy}
            placeholder="Remarks (required)"
            rows={2}
            className="w-full resize-y rounded-md border border-[#E2E6DC] bg-white px-2 py-1.5 text-[11px] text-gray-900 placeholder:text-surface-muted"
          />
          <Button type="button" size="sm" variant="secondary" className="h-7 w-full text-[11px]" disabled={busy} onClick={() => void saveLostHold()}>
            Save status
          </Button>
        </>
      )}
    </div>
  )
}
