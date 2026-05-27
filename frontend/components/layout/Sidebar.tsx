'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  Inbox,
  FileText,
  BarChart2,
  Database,
  Shield,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  ChevronRight,
  Mail,
  LogOut,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { SIDEBAR_WIDTH, useUIStore } from '@/lib/store'
import { useEmailStore } from '@/stores/emailStore'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import MastersSidebarNav from '@/components/layout/MastersSidebarNav'

type NavIcon = typeof LayoutDashboard

type NavItem =
  | { href: string; label: string; icon: NavIcon }
  | { href: string; label: string; icon: NavIcon; permission: string }
  | { href: string; label: string; icon: NavIcon; adminOnly: true }

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload', icon: Upload, permission: Permissions.UPLOAD_EMAIL },
  { href: '/emails', label: 'Emails', icon: Mail, permission: Permissions.VIEW_ENQUIRIES },
  { href: '/enquiries', label: 'Enquiries', icon: Inbox, permission: Permissions.VIEW_ENQUIRIES },
  { href: '/quotations', label: 'Quotations', icon: FileText, permission: Permissions.VIEW_QUOTATIONS },
  { href: '/reports', label: 'Reports', icon: BarChart2, permission: Permissions.REPORTS_VIEW },
  { href: '/masters', label: 'Masters', icon: Database, permission: Permissions.MASTERS_VIEW },
  { href: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isAdminOrAbove = useAuthStore((s) => s.isAdminOrAbove())
  const logout = useAuthStore((s) => s.logout)
  const { sidebarCollapsed, sidebarWidth, toggleSidebar, setSidebarWidth } = useUIStore()
  const unreadCount = useEmailStore((s) => s.unread_count)
  const mastersActive = pathname === '/masters' || pathname.startsWith('/masters/')
  const [mastersOpen, setMastersOpen] = React.useState<boolean>(mastersActive)
  const [isResizing, setIsResizing] = React.useState(false)
  const resizeStart = React.useRef<{ x: number; width: number } | null>(null)

  const asideWidth = sidebarCollapsed ? SIDEBAR_WIDTH.collapsed : sidebarWidth

  const onResizePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (sidebarCollapsed) return
      e.preventDefault()
      resizeStart.current = { x: e.clientX, width: sidebarWidth }
      setIsResizing(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [sidebarCollapsed, sidebarWidth],
  )

  const onResizePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeStart.current) return
      const delta = e.clientX - resizeStart.current.x
      setSidebarWidth(resizeStart.current.width + delta)
    },
    [setSidebarWidth],
  )

  const onResizePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    resizeStart.current = null
    setIsResizing(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }, [])

  const visibleNav = NAV_ITEMS.filter((item) => {
    if ('adminOnly' in item && item.adminOnly) return isAdminOrAbove
    if ('permission' in item && item.permission) return hasPermission(item.permission)
    return true
  })

  return (
    <aside
      className={cn(
        'relative flex h-screen min-h-0 flex-shrink-0 flex-col overflow-hidden bg-surface-sidebar',
        !isResizing && 'transition-[width] duration-200 ease-out',
      )}
      style={{ width: asideWidth }}
    >
      <div
        className={cn(
          'flex flex-shrink-0 items-center gap-3 px-4 pb-4 pt-5',
          sidebarCollapsed && 'justify-center px-2',
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-brand-green-500 flex items-center justify-center text-white font-bold text-[14px] flex-shrink-0">
          PV
        </div>
        {!sidebarCollapsed && (
          <div>
            <div className="text-brand-green-300 font-semibold text-[14px] leading-tight">Parth CPQ</div>
            <div className="text-[10px] text-[#5a7a5e]">v1.0 mvp</div>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 [-webkit-overflow-scrolling:touch]">
        {visibleNav.map((item) => {
          if (item.href === '/masters') {
            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => setMastersOpen((v) => !v)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors',
                    mastersActive
                      ? 'bg-brand-green-500 text-white'
                      : 'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
                    sidebarCollapsed && 'justify-center px-2',
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {mastersOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </>
                  )}
                </button>

                {!sidebarCollapsed && mastersOpen && (
                  <div className="mt-1 ml-2 space-y-0.5">
                    <Link
                      href="/masters?tab=edit"
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-[12px] transition-colors',
                        pathname === '/masters' &&
                          (typeof window !== 'undefined'
                            ? new URLSearchParams(window.location.search).get('tab') === 'edit'
                            : false)
                          ? 'bg-surface-sidebar2 text-white'
                          : 'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
                      )}
                    >
                      <span className="truncate">Edit Masters</span>
                    </Link>
                    <Suspense fallback={<div className="px-3 py-2 text-[11px] text-[#8AAF8E]">Loading…</div>}>
                      <MastersSidebarNav />
                    </Suspense>
                  </div>
                )}
              </div>
            )
          }

          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors',
                active ? 'bg-brand-green-500 text-white' : 'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
                sidebarCollapsed && 'justify-center px-2',
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="flex-1 flex items-center justify-between gap-2">
                  <span>{item.label}</span>
                  {item.href === '/emails' && unreadCount > 0 && (
                    <span className="bg-brand-green-500 text-white text-[10px] font-mono rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="flex-shrink-0 space-y-2 px-3 pb-4">
        <div className="h-px bg-[#1A4526]" />
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-1 text-[#5a7a5e] hover:text-white transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={async () => {
            await logout()
            router.push('/login')
          }}
          className={cn(
            'w-full flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-[#8AAF8E] transition-colors hover:bg-surface-sidebar2 hover:text-white',
            sidebarCollapsed && 'justify-center px-2',
          )}
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span className="truncate">Log out</span>}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize sidebar"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          className={cn(
            'absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none',
            'hover:bg-brand-green-400/40',
            isResizing && 'bg-brand-green-400/60',
          )}
        />
      )}
    </aside>
  )
}
