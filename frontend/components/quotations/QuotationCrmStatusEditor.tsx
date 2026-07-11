'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/ui/StatusBadge'
import QuotationLostRemarksFields from '@/components/quotations/QuotationLostRemarksFields'
import { quotationsApi } from '@/lib/api'
import { invalidateQuotationCrmCaches } from '@/lib/invalidateQuotationCrmCaches'
import { Permissions } from '@/lib/permissions'
import {
  formatLostRemarks,
  lostRemarksValidationMessage,
  parseLostRemarks,
  type LostRemarksDraft,
} from '@/lib/quotationLostRemarks'
import {
  QUOTATION_CRM_LABELS,
  QUOTATION_CRM_STATUSES,
  type QuotationCrmStatus,
} from '@/lib/quotationCrmStatus'
import { useAuthStore } from '@/stores/authStore'

const emptyLostRemarks = (): LostRemarksDraft => ({
  reason1: '',
  other1: '',
})

type Props = {
  quotationId: string
  status: string
  statusRemarks?: string | null
}

export default function QuotationCrmStatusEditor({ quotationId, status: initialStatus, statusRemarks }: Props) {
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.APPROVE_QUOTATIONS))
  const [status, setStatus] = useState(initialStatus)
  const [lostRemarks, setLostRemarks] = useState<LostRemarksDraft>(() =>
    parseLostRemarks(statusRemarks),
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setStatus(initialStatus)
    setLostRemarks(parseLostRemarks(statusRemarks))
  }, [quotationId, initialStatus, statusRemarks])

  const persist = async (nextStatus: string, nextRemarks: string | null) => {
    setBusy(true)
    try {
      await quotationsApi.updateCrmStatus(quotationId, {
        status: nextStatus,
        status_remarks: nextRemarks,
      })
      await invalidateQuotationCrmCaches(queryClient)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const onStatusChange = async (next: string) => {
    if (next === 'ongoing' || next === 'po_received') {
      setStatus(next)
      setLostRemarks(emptyLostRemarks())
      await persist(next, null)
      return
    }
    setStatus(next)
    if (next !== 'lost') {
      setLostRemarks(emptyLostRemarks())
    }
  }

  const saveLostRemarks = async () => {
    const message = lostRemarksValidationMessage(lostRemarks)
    if (message) {
      window.alert(message)
      return
    }
    await persist(status, formatLostRemarks(lostRemarks))
  }

  if (!canEdit) {
    return (
      <div className="max-w-[200px]">
        <StatusBadge status={status} kind="quotation_crm" />
        {status === 'lost' && statusRemarks && (
          <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-surface-muted" title={statusRemarks}>
            {statusRemarks}
          </p>
        )}
      </div>
    )
  }

  const showRemarks = status === 'lost'

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
          <QuotationLostRemarksFields value={lostRemarks} onChange={setLostRemarks} disabled={busy} />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 w-full text-[11px]"
            disabled={busy}
            onClick={() => void saveLostRemarks()}
          >
            Save status
          </Button>
        </>
      )}
    </div>
  )
}
