'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { enquiriesApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

export type AssignableUser = {
  id: string
  full_name: string
}

export default function EnquiryListUserAssigner({
  enquiryId,
  userId,
  userName,
  users,
  disabled = false,
}: {
  enquiryId: string
  userId?: string | null
  userName?: string | null
  users: AssignableUser[]
  disabled?: boolean
}) {
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdminOrAbove())
  const [localUserId, setLocalUserId] = useState(userId ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLocalUserId(userId ?? '')
  }, [enquiryId, userId])

  if (!isAdmin) {
    return (
      <span className="text-[12px] text-surface-muted">{userName?.trim() || '—'}</span>
    )
  }

  const persist = async (nextUserId: string) => {
    if (!nextUserId || nextUserId === (userId ?? '')) return
    setBusy(true)
    try {
      await enquiriesApi.assignUser(enquiryId, { user_id: nextUserId })
      await queryClient.invalidateQueries({ queryKey: ['enquiries'] })
      await queryClient.invalidateQueries({ queryKey: ['quotations'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics'] })
    } catch (e: unknown) {
      setLocalUserId(userId ?? '')
      window.alert(e instanceof Error ? e.message : 'Failed to assign user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <select
      value={localUserId}
      disabled={busy || disabled || users.length === 0}
      onChange={(e) => {
        const next = e.target.value
        setLocalUserId(next)
        void persist(next)
      }}
      className={cn(
        'h-8 max-w-[140px] rounded-md border border-[#E2E6DC] bg-white px-1.5 text-[12px] text-gray-900',
        !localUserId && 'text-surface-muted',
        busy && 'opacity-50',
      )}
      aria-label={`Assign user for enquiry ${enquiryId}`}
    >
      <option value="">{userName?.trim() || 'Assign user…'}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.full_name}
        </option>
      ))}
    </select>
  )
}
