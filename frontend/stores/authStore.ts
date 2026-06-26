'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { apiBaseURL } from '@/lib/apiBase'
import { clearRefreshToken, getRefreshToken, setRefreshToken } from '@/lib/refreshToken'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  tier: string
  job_title: string | null
  phone?: string | null
  permissions: string[]
  is_first_login: boolean
}

interface AuthStore {
  user: AuthUser | null
  access_token: string | null
  is_loading: boolean

  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
  hasPermission: (permission: string) => boolean
  hasAny: (...permissions: string[]) => boolean
  isAdminOrAbove: () => boolean
  canAccessIndiaMart: () => boolean
  updateToken: (token: string) => void
  setUser: (user: AuthUser) => void
  login: (email: string, password: string) => Promise<{ is_first_login: boolean }>
  logout: () => Promise<void>
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const base = apiBaseURL()
  const url = (base ? `${base}${path}` : path).replace(/([^:]\/)\/+/g, '$1')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      is_loading: false,

      setAuth: (user, token) => set({ user, access_token: token }),

      clearAuth: () => {
        clearRefreshToken()
        set({ user: null, access_token: null })
      },

      hasPermission: (permission) => {
        const { user } = get()
        if (!user) return false
        if (user.tier === 'superadmin') return true
        return user.permissions.includes(permission)
      },

      hasAny: (...permissions) => permissions.some((p) => get().hasPermission(p)),

      isAdminOrAbove: () => {
        const { user } = get()
        return user?.tier === 'admin' || user?.tier === 'superadmin'
      },

      canAccessIndiaMart: () => {
        const { user, hasPermission } = get()
        if (!user) return false
        if (user.tier === 'admin' || user.tier === 'superadmin' || user.tier === 'indiamart') {
          return true
        }
        return hasPermission('view_indiamart')
      },

      updateToken: (token) => set({ access_token: token }),

      setUser: (user) => set({ user }),

      login: async (email, password) => {
        set({ is_loading: true })
        try {
          const { ok, status, data } = await postJson<{
            access_token?: string
            refresh_token?: string
            is_first_login?: boolean
            user?: {
              id: string
              email: string
              full_name: string
              tier: string
              job_title: string | null
              phone?: string | null
              permissions: string[]
            }
            detail?: string
          }>('/api/auth/login', { email, password })

          if (!ok || !data.access_token || !data.user) {
            if (status === 403) throw new Error('Account deactivated. Contact your administrator.')
            throw new Error(data.detail || 'Invalid email or password')
          }

          const isFirst = Boolean(data.is_first_login)
          const user: AuthUser = {
            ...data.user,
            is_first_login: isFirst,
          }
          set({ user, access_token: data.access_token })
          if (data.refresh_token) setRefreshToken(data.refresh_token)
          return { is_first_login: isFirst }
        } catch (e) {
          if (e instanceof Error) throw e
          throw new Error('Cannot reach server')
        } finally {
          set({ is_loading: false })
        }
      },

      logout: async () => {
        const token = get().access_token
        const rt = getRefreshToken()
        const base = apiBaseURL()
        const url = (base ? `${base}/api/auth/logout` : '/api/auth/logout').replace(/([^:]\/)\/+/g, '$1')
        try {
          if (token && rt) {
            await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ refresh_token: rt }),
            })
          }
        } finally {
          get().clearAuth()
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        access_token: state.access_token,
      }),
    },
  ),
)
