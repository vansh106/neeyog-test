import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const SIDEBAR_WIDTH = {
  default: 240,
  min: 200,
  max: 480,
  collapsed: 64,
} as const

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, Math.round(width)))
}

interface UIState {
  sidebarCollapsed: boolean
  sidebarWidth: number
  toggleSidebar: () => void
  setSidebarCollapsed: (val: boolean) => void
  setSidebarWidth: (width: number) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarWidth: SIDEBAR_WIDTH.default,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
      setSidebarWidth: (width) => set({ sidebarWidth: clampSidebarWidth(width) }),
    }),
    {
      name: 'parth-cpq-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarWidth: s.sidebarWidth,
      }),
    },
  ),
)
