import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  tier: string
  job_title: string | null
  permissions: string[]
  is_first_login?: boolean
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
  updateToken: (token: string) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      is_loading: false,

      setAuth: (user, token) => set({ user, access_token: token }),

      clearAuth: () => set({ user: null, access_token: null }),

      hasPermission: (permission) => {
        const { user } = get()
        if (!user) return false
        if (user.tier === 'superadmin') return true
        return (user.permissions ?? []).includes(permission)
      },

      hasAny: (...permissions) => permissions.some((p) => get().hasPermission(p)),

      isAdminOrAbove: () => {
        const { user } = get()
        return user?.tier === 'admin' || user?.tier === 'superadmin'
      },

      updateToken: (token) => set({ access_token: token }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, access_token: state.access_token }),
    },
  ),
)

