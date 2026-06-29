'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { enquiriesApi } from '@/lib/api'
import {
  ENQUIRY_DETAIL_TYPE_LABELS,
  ENQUIRY_DETAIL_TYPES,
  normalizeEnquiryDetailType,
  type EnquiryDetailType,
} from '@/lib/enquiryDetailType'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

export default function EnquiryListDetailTypeEditor({
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
  const [localValue, setLocalValue] = useState<EnquiryDetailType>(() => normalizeEnquiryDetailType(value))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLocalValue(normalizeEnquiryDetailType(value))
  }, [enquiryId, value])

  const persist = async (next: EnquiryDetailType) => {
    setBusy(true)
    try {
      await enquiriesApi.updateDetailType(enquiryId, { enquiryDetailType: next })
      await queryClient.invalidateQueries({ queryKey: ['enquiries'] })
    } catch (e: unknown) {
      setLocalValue(normalizeEnquiryDetailType(value))
      window.alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const label = ENQUIRY_DETAIL_TYPE_LABELS[localValue]

  if (!canEdit || disabled) {
    return <span className={cn('text-[13px] text-gray-900', className)}>{label}</span>
  }

  return (
    <select
      className={cn(
        'h-8 min-w-[108px] rounded-md border border-[#E2E6DC] bg-white px-2 text-[12px] text-gray-900 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      value={localValue}
      disabled={busy || disabled}
      onChange={(e) => {
        const next = normalizeEnquiryDetailType(e.target.value)
        setLocalValue(next)
        void persist(next)
      }}
    >
      {ENQUIRY_DETAIL_TYPES.map((type) => (
        <option key={type} value={type}>
          {ENQUIRY_DETAIL_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  )
}
