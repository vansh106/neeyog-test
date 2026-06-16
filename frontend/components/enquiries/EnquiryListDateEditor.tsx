'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { enquiriesApi } from '@/lib/api'
import { formatQuotationListDate } from '@/components/quotations/QuotationListDateEditor'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

function toInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function EnquiryListDateEditor({
  enquiryId,
  value,
  className,
}: {
  enquiryId: string
  value: string | null | undefined
  className?: string
}) {
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.APPROVE_QUOTATIONS))
  const [localValue, setLocalValue] = useState(toInputValue(value))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLocalValue(toInputValue(value))
  }, [enquiryId, value])

  const persist = async (next: string) => {
    setBusy(true)
    try {
      await enquiriesApi.updateListingDates(enquiryId, {
        next_follow_up_date: next || null,
      })
      await queryClient.invalidateQueries({ queryKey: ['enquiries'] })
    } catch (e: unknown) {
      setLocalValue(toInputValue(value))
      window.alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const display = formatQuotationListDate(localValue ? `${localValue}T12:00:00` : null)

  if (!canEdit) {
    return <span className={cn('text-[13px] text-gray-900', className)}>{display}</span>
  }

  return (
    <label
      className={cn(
        'relative inline-flex min-w-[88px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-[#EEF0E8]',
        busy && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <span className={cn('text-[13px] text-gray-900', !localValue && 'text-surface-muted')}>{display}</span>
      <input
        type="date"
        value={localValue}
        disabled={busy}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(e) => {
          const next = e.target.value
          setLocalValue(next)
          void persist(next)
        }}
      />
    </label>
  )
}
