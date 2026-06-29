'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { enquiriesApi } from '@/lib/api'
import {
  ENQUIRY_QUOTE_STATUS_LABELS,
  ENQUIRY_QUOTE_STATUSES,
  normalizeEnquiryQuoteStatus,
  type EnquiryQuoteStatus,
} from '@/lib/enquiryQuoteStatus'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

export default function EnquiryListQuoteStatusEditor({
  enquiryId,
  value,
  disabled = false,
  className,
}: {
  enquiryId: string
  value: string | null | undefined
  disabled?: boolean
  className?: string
}) {
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.VIEW_QUOTATIONS))
  const [localValue, setLocalValue] = useState<EnquiryQuoteStatus>(() => normalizeEnquiryQuoteStatus(value))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLocalValue(normalizeEnquiryQuoteStatus(value))
  }, [enquiryId, value])

  const persist = async (next: EnquiryQuoteStatus) => {
    setBusy(true)
    try {
      await enquiriesApi.updateQuoteStatus(enquiryId, { enquiryQuoteStatus: next })
      await queryClient.invalidateQueries({ queryKey: ['enquiries'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics'] })
    } catch (e: unknown) {
      setLocalValue(normalizeEnquiryQuoteStatus(value))
      window.alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const label = ENQUIRY_QUOTE_STATUS_LABELS[localValue]

  if (!canEdit || disabled) {
    return <span className={cn('text-[13px] text-gray-900', className)}>{label}</span>
  }

  return (
    <select
      className={cn(
        'h-8 min-w-[128px] rounded-md border border-[#E2E6DC] bg-white px-2 text-[12px] text-gray-900 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      value={localValue}
      disabled={busy || disabled}
      onChange={(e) => {
        const next = normalizeEnquiryQuoteStatus(e.target.value)
        setLocalValue(next)
        void persist(next)
      }}
    >
      {ENQUIRY_QUOTE_STATUSES.map((status) => (
        <option key={status} value={status}>
          {ENQUIRY_QUOTE_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  )
}
