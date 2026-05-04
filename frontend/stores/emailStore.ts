import { create } from 'zustand'
import type { GlobalEvent } from '@/hooks/useGlobalEvents'

export interface EmailInboxItem {
  enquiry_id: string
  sender_name: string
  sender_email: string
  company: string
  /** Resolved list title (company or person). */
  display_name: string
  subject: string
  preview: string
  category: string | null
  status: string
  flow_type: string | null
  created_at: string
  awaiting_human: boolean
  has_quotation: boolean
  /** AI / manual pipeline has run or a quote exists. */
  inbox_processed: boolean
  is_new: boolean
  live_events: GlobalEvent[]
}

interface EmailStore {
  items: EmailInboxItem[]
  unread_count: number
  isConnected: boolean

  setConnection: (connected: boolean) => void
  setItems: (items: Omit<EmailInboxItem, 'is_new' | 'live_events'>[]) => void
  addNewEmail: (event: GlobalEvent) => void
  updateStatus: (enquiry_id: string, status: string, flow_type?: string | null) => void
  addLiveEvent: (enquiry_id: string, event: GlobalEvent) => void
  markRead: (enquiry_id: string) => void
  markAllRead: () => void
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  items: [],
  unread_count: 0,
  isConnected: false,

  setConnection: (connected) => set({ isConnected: connected }),

  setItems: (items) =>
    set(() => ({
      items: items.map((i) => ({ ...i, is_new: false, live_events: [] })),
      unread_count: 0,
    })),

  addNewEmail: (event) =>
    set((state) => {
      const enquiry_id = event.enquiry_id
      if (!enquiry_id) return state
      const existing = state.items.find((i) => i.enquiry_id === enquiry_id)
      if (existing) return state

      const dn = (event.sender_name || '').trim() || 'Unknown'
      const newItem: EmailInboxItem = {
        enquiry_id,
        sender_name: dn,
        sender_email: event.sender_email || '',
        company: dn,
        display_name: dn,
        subject: event.subject || '',
        preview: event.preview || '',
        category: null,
        status: event.status || 'received',
        flow_type: null,
        created_at: event.timestamp || new Date().toISOString(),
        awaiting_human: false,
        has_quotation: false,
        inbox_processed: false,
        is_new: true,
        live_events: [event],
      }
      return {
        items: [newItem, ...state.items],
        unread_count: state.unread_count + 1,
      }
    }),

  updateStatus: (enquiry_id, status, flow_type) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.enquiry_id !== enquiry_id) return item
        const nextStatus = status
        const nextFlow = flow_type ?? item.flow_type
        const processed =
          item.inbox_processed ||
          (nextStatus && nextStatus !== 'received') ||
          !!item.has_quotation
        return {
          ...item,
          status: nextStatus,
          flow_type: nextFlow,
          awaiting_human: nextStatus === 'pending_approval' ? true : item.awaiting_human,
          inbox_processed: processed,
        }
      }),
    })),

  addLiveEvent: (enquiry_id, event) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.enquiry_id === enquiry_id
          ? { ...item, live_events: [...item.live_events, event].slice(-50) }
          : item,
      ),
    })),

  markRead: (enquiry_id) =>
    set((state) => {
      const wasNew = state.items.find((i) => i.enquiry_id === enquiry_id)?.is_new
      return {
        items: state.items.map((item) =>
          item.enquiry_id === enquiry_id ? { ...item, is_new: false } : item,
        ),
        unread_count: Math.max(0, state.unread_count - (wasNew ? 1 : 0)),
      }
    }),

  markAllRead: () =>
    set((state) => ({
      items: state.items.map((i) => ({ ...i, is_new: false })),
      unread_count: 0,
    })),
}))

