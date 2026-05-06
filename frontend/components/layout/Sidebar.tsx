'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/store'
import { useHealth } from '@/lib/queries'
import { useEmailStore } from '@/stores/emailStore'
import { SIDEBAR_MASTER_CATEGORIES } from '@/lib/masterCatalogCategories'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'

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
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isAdminOrAbove = useAuthStore((s) => s.isAdminOrAbove())
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { data: health } = useHealth()
  const unreadCount = useEmailStore((s) => s.unread_count)
  const isConnected = useEmailStore((s) => s.isConnected)
  const mastersActive = pathname === '/masters' || pathname.startsWith('/masters/')
  const [mastersOpen, setMastersOpen] = React.useState<boolean>(mastersActive)

  const visibleNav = NAV_ITEMS.filter((item) => {
    if ('adminOnly' in item && item.adminOnly) return isAdminOrAbove
    if ('permission' in item && item.permission) return hasPermission(item.permission)
    return true
  })

  return (
    <aside
      className={cn(
        'flex h-screen min-h-0 w-[220px] flex-shrink-0 flex-col overflow-hidden bg-surface-sidebar transition-all duration-200',
        sidebarCollapsed && 'w-16',
      )}
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

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-y-contain px-2 [-webkit-overflow-scrolling:touch]">
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
                    {SIDEBAR_MASTER_CATEGORIES.map(({ key, label }) => {
                      const href = `/masters/${key}`
                      const active = pathname === href
                      return (
                        <Link
                          key={key}
                          href={href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md text-[12px] transition-colors',
                            active
                              ? 'bg-surface-sidebar2 text-white'
                              : 'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
                          )}
                        >
                          <span className="truncate">{label}</span>
                        </Link>
                      )
                    })}
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

      <div className="flex-shrink-0 space-y-3 px-3 pb-4">
        <div className="h-px bg-[#1A4526]" />
        {!sidebarCollapsed && (
          <>
            <div className="flex items-center gap-2 text-[11px]">
              <span className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-brand-green-400 animate-pulse' : 'bg-[#5a7a5e]')} />
              <span className="text-[#8AAF8E]">{isConnected ? 'Inbox sync on' : 'Inbox sync reconnecting…'}</span>
            </div>
            {health && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-brand-gold-400" />
                <span className="text-[#8AAF8E] font-mono text-[10px]">{health.model}</span>
              </div>
            )}
          </>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-1 text-[#5a7a5e] hover:text-white transition-colors"
        >
          {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
