'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { useGlobalEvents } from '@/hooks/useGlobalEvents'
import { useEmailStore } from '@/stores/emailStore'
import { useAuthStore } from '@/stores/authStore'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const addNewEmail = useEmailStore((s) => s.addNewEmail)
  const updateStatus = useEmailStore((s) => s.updateStatus)
  const addLiveEvent = useEmailStore((s) => s.addLiveEvent)
  const setConnection = useEmailStore((s) => s.setConnection)
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.access_token)

  useEffect(() => {
    if (!user || !accessToken) {
      router.replace('/login')
    } else {
      if (user.is_first_login) {
        router.replace('/change-password')
        return
      }
      setReady(true)
    }
  }, [router, user, accessToken])

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

  if (!ready) return null

  return (
    <div className="flex h-screen bg-surface-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
