'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/store'
import { useHealth } from '@/lib/queries'
import { useEmailStore } from '@/stores/emailStore'
import {
  LayoutDashboard, Upload, Inbox, FileText,
  BarChart2, Database, Shield, PanelLeftClose, PanelLeft, ChevronDown, ChevronRight,
  Mail,
} from 'lucide-react'

const MASTER_CATEGORIES = [
  { key: 'butterfly_valve', label: 'Butterfly valve' },
  { key: 'ball_valve', label: 'Ball valve' },
  { key: 'operator', label: 'Operator' },
  { key: 'brackets_coupler', label: 'Brackets & couplers' },
  { key: 'sov', label: 'SOV' },
  { key: 'limit_switch_box', label: 'Limit switch box' },
  { key: 'positioner', label: 'Positioner' },
] as const

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/upload', label: 'AI Upload', icon: Upload },
  { href: '/emails', label: 'Emails', icon: Mail },
  { href: '/enquiries', label: 'Enquiries', icon: Inbox },
  { href: '/quotations', label: 'Quotations', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/masters', label: 'Masters', icon: Database },
  { href: '/admin', label: 'Admin', icon: Shield },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { data: health } = useHealth()
  const unreadCount = useEmailStore((s) => s.unread_count)
  const isConnected = useEmailStore((s) => s.isConnected)
  const mastersActive = pathname === '/masters' || pathname.startsWith('/masters/')
  const [mastersOpen, setMastersOpen] = React.useState<boolean>(mastersActive)

  return (
    <aside className={cn(
      'h-screen flex flex-col bg-surface-sidebar transition-all duration-200 flex-shrink-0',
      sidebarCollapsed ? 'w-16' : 'w-[220px]'
    )}>
      <div className={cn('px-4 pt-5 pb-4 flex items-center gap-3', sidebarCollapsed && 'justify-center px-2')}>
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

      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
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
                    sidebarCollapsed && 'justify-center px-2'
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
                    {MASTER_CATEGORIES.map(({ key, label }) => {
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
                active
                  ? 'bg-brand-green-500 text-white'
                  : 'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
                sidebarCollapsed && 'justify-center px-2'
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

      <div className="px-3 pb-4 space-y-3">
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
        <button onClick={toggleSidebar} className="w-full flex items-center justify-center py-1 text-[#5a7a5e] hover:text-white transition-colors">
          {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
