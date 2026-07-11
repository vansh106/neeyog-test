'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LogOut, RefreshCw, User } from 'lucide-react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Permissions } from '@/lib/permissions'
import { useEmailSyncStatus, useTriggerEmailSync } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/upload': 'Upload',
  '/enquiries': 'Enquiries',
  '/indiamart': 'IndiaMart',
  '/quotations': 'Quotations',
  '/reports': 'Reports',
  '/masters': 'Masters',
  '/admin': 'Admin',
}

function formatNextRun(iso: string | null): string {
  if (!iso) return 'Not scheduled'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase()
  return (name.slice(0, 2) || '?').toUpperCase()
}

export default function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { data: syncStatus } = useEmailSyncStatus()
  const triggerSync = useTriggerEmailSync()

  const title =
    Object.entries(PAGE_TITLES).find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ||
    'Neeyog CPQ'

  const syncOn =
    !!syncStatus?.sync_enabled &&
    !!syncStatus?.email_configured &&
    !!syncStatus?.scheduler_running

  const syncTooltip = !syncStatus?.email_configured
    ? 'Configure EMAIL_ADDRESS and EMAIL_APP_PASSWORD in .env'
    : `Next run: ${formatNextRun(syncStatus?.next_run ?? null)}`

  const tier = user?.tier ?? 'member'
  const badge =
    tier === 'superadmin'
      ? { cls: 'bg-red-100 text-red-700 border-red-200', label: 'Super Admin' }
      : tier === 'admin'
        ? { cls: 'bg-blue-50 text-blue-800 border-blue-200', label: 'Admin' }
        : tier === 'indiamart'
          ? { cls: 'bg-amber-50 text-amber-800 border-amber-200', label: 'IndiaMart Account' }
          : {
            cls: 'bg-brand-green-50 text-brand-green-700 border-brand-green-200',
            label: user?.job_title?.trim() || 'Member',
          }

  return (
    <header className="h-12 bg-white border-b border-surface-border flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-[16px] font-semibold tracking-[-0.2px]">{title}</h1>
      <div className="flex items-center gap-3">
        <PermissionGate permission={Permissions.EMAIL_SYNC_VIEW}>
          {syncStatus && (
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="flex items-center gap-1.5 text-[11px] text-surface-muted outline-none"
              >
                {syncOn ? (
                  <>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green-500" />
                    </span>
                    <span className="text-brand-green-700">Inbox sync on</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                    <span>Sync off</span>
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                {syncTooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </PermissionGate>

        <PermissionGate permission={Permissions.EMAIL_SYNC_TRIGGER}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-brand-green-600 hover:bg-brand-green-50"
            disabled={triggerSync.isPending}
            aria-label="Sync inbox now"
            onClick={() => triggerSync.mutate()}
          >
            <RefreshCw className={`size-4 ${triggerSync.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </PermissionGate>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 pl-3 border-l border-surface-border outline-none rounded-md py-1 pr-1 hover:bg-gray-50"
            type="button"
          >
            <div className="w-7 h-7 rounded-full bg-brand-green-100 flex items-center justify-center text-[11px] font-semibold text-brand-green-700">
              {user?.full_name ? initials(user.full_name) : <User className="w-3.5 h-3.5 text-brand-green-600" />}
            </div>
            <span
              className={cn(
                'hidden sm:inline-flex max-w-[140px] truncate rounded-full border px-2 py-0.5 text-[11px] font-medium',
                badge.cls,
              )}
            >
              {badge.label}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="text-[13px] font-medium text-gray-900 truncate">{user?.full_name}</div>
              <div className="text-[11px] text-surface-muted font-mono truncate">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/change-password')}>Change password</DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await logout()
                router.push('/login')
              }}
            >
              <LogOut className="size-4 mr-2 opacity-70" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
