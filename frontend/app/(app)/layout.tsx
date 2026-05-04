'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { useGlobalEvents } from '@/hooks/useGlobalEvents'
import { refreshAccessToken } from '@/lib/api'
import { useEmailStore } from '@/stores/emailStore'
import { useAuthStore } from '@/stores/authStore'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const access_token = useAuthStore((s) => s.access_token)
  const [hydrated, setHydrated] = useState(false)
  const rbacBootstrapAttempted = useRef(false)

  const addNewEmail = useEmailStore((s) => s.addNewEmail)
  const updateStatus = useEmailStore((s) => s.updateStatus)
  const addLiveEvent = useEmailStore((s) => s.addLiveEvent)
  const setConnection = useEmailStore((s) => s.setConnection)

  useEffect(() => {
    const p = useAuthStore.persist
    if (!p?.onFinishHydration) {
      setHydrated(true)
      return
    }
    if (p.hasHydrated()) setHydrated(true)
    return p.onFinishHydration(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!user || !access_token) {
      router.replace('/login')
      return
    }
    if (user.is_first_login) {
      router.replace('/change-password')
    }
  }, [hydrated, user, access_token, router])

  /** Re-issue JWT after DB permission backfill (migration) so the client store matches the token. */
  useEffect(() => {
    if (!hydrated || !user || !access_token || rbacBootstrapAttempted.current) return
    if (user.tier === 'superadmin') return
    if ((user.permissions?.length ?? 0) > 0) return
    rbacBootstrapAttempted.current = true
    void refreshAccessToken()
  }, [hydrated, user, access_token])

  useGlobalEvents({
    onNewEmail: (evt) => addNewEmail(evt),
    onStatusChange: (evt) => {
      if (evt.enquiry_id && evt.status) updateStatus(evt.enquiry_id, evt.status, evt.flow_type ?? null)
    },
    onAgentEvent: (evt) => {
      if (evt.enquiry_id) addLiveEvent(evt.enquiry_id, evt)
    },
    onConnectionChange: (c) => setConnection(c),
  })

  if (!hydrated || !user || !access_token || user.is_first_login) {
    return null
  }

  return (
    <div className="flex h-screen bg-surface-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
