import { useEffect, useRef, useState } from 'react'

import { useAuthStore } from '@/stores/authStore'

export interface GlobalEvent {
  type: string
  enquiry_id?: string
  sender_name?: string
  sender_email?: string
  subject?: string
  preview?: string
  status?: string
  flow_type?: string | null
  client_name?: string | null
  message?: string
  agent?: string
  detail?: string
  data?: Record<string, unknown>
  timestamp?: string
}

interface UseGlobalEventsOptions {
  onNewEmail?: (event: GlobalEvent) => void
  onStatusChange?: (event: GlobalEvent) => void
  onAgentEvent?: (event: GlobalEvent) => void
  onConnected?: (subscriberId: string) => void
  onConnectionChange?: (connected: boolean) => void
}

function streamUrl(): string {
  // Prefer same-origin proxy; fall back to NEXT_PUBLIC_API_URL if set.
  const base = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '')
  return `${base}/api/stream/global-events`
}

export function useGlobalEvents(options: UseGlobalEventsOptions = {}) {
  const accessToken = useAuthStore((s) => s.access_token)
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<GlobalEvent | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const reconnectRef = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true

    const connect = async () => {
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      try {
        const token = accessToken
        const res = await fetch(streamUrl(), {
          signal: abortRef.current.signal,
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`)

        if (!mounted) return
        setIsConnected(true)
        options.onConnectionChange?.(true)

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''

        while (mounted) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += value
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith('data:')) continue
            const json = line.slice(5).trim()
            if (!json) continue
            let evt: GlobalEvent | null = null
            try {
              evt = JSON.parse(json) as GlobalEvent
            } catch {
              continue
            }
            if (!evt || evt.type === 'heartbeat') continue

            setLastEvent(evt)

            if (evt.type === 'connected') {
              const sid = (evt as unknown as { subscriber_id?: string }).subscriber_id
              if (sid) options.onConnected?.(sid)
              continue
            }

            if (evt.type === 'new_email_received') options.onNewEmail?.(evt)
            else if (evt.type === 'enquiry_status_changed') options.onStatusChange?.(evt)
            else if (
              ['agent_start', 'agent_complete', 'agent_warning', 'agent_error', 'hitl_required', 'client_hitl_required'].includes(evt.type)
            ) {
              options.onAgentEvent?.(evt)
            }
          }
        }
      } catch (err: unknown) {
        const name = err instanceof Error ? err.name : ''
        if (name === 'AbortError') return
      } finally {
        if (!mounted) return
        setIsConnected(false)
        options.onConnectionChange?.(false)
        // reconnect
        if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
        reconnectRef.current = window.setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      mounted = false
      abortRef.current?.abort()
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
    }
  }, [accessToken])

  return { isConnected, lastEvent }
}

