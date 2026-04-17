'use client'

import { usePathname } from 'next/navigation'
import { RefreshCw, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEmailSyncStatus, useHealth, useTriggerEmailSync } from '@/lib/queries'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { Permissions } from '@/lib/permissions'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/upload': 'AI Upload',
  '/enquiries': 'Enquiries',
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

export default function Topbar() {
  const pathname = usePathname()
  const { data: health } = useHealth()
  const { data: syncStatus } = useEmailSyncStatus()
  const triggerSync = useTriggerEmailSync()

  const title =
    Object.entries(PAGE_TITLES).find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ||
    'Parth CPQ'

  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const syncOn =
    !!syncStatus?.sync_enabled &&
    !!syncStatus?.email_configured &&
    !!syncStatus?.scheduler_running

  const syncTooltip = !syncStatus?.email_configured
    ? 'Configure EMAIL_ADDRESS and EMAIL_APP_PASSWORD in .env'
    : `Next run: ${formatNextRun(syncStatus?.next_run ?? null)}`

  return (
    <header className="h-12 bg-white border-b border-surface-border flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-[16px] font-semibold tracking-[-0.2px]">{title}</h1>
      <div className="flex items-center gap-3">
        {health && (
          <>
            <span className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${health.status === 'ok' ? 'bg-brand-green-400' : 'bg-red-400'}`}
              />
              <span className="text-surface-muted">{health.status === 'ok' ? 'API Online' : 'API Offline'}</span>
            </span>

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

            <span className="bg-brand-green-50 text-brand-green-600 text-[11px] font-mono rounded-full px-2 py-0.5">
              {health.model}
            </span>
          </>
        )}
        <div className="flex items-center gap-2 pl-3 border-l border-surface-border">
          <div className="w-7 h-7 rounded-full bg-brand-green-100 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-brand-green-600" />
          </div>
          <button
            type="button"
            className="text-[12px] text-surface-muted hover:text-gray-900"
            onClick={async () => {
              const rt = authApi.getRefreshToken()
              if (rt) {
                try {
                  await authApi.logout(rt)
                } catch {
                  /* ignore */
                }
              }
              clearAuth()
              authApi.clearRefreshToken()
              if (typeof window !== 'undefined') window.location.href = '/login'
            }}
            aria-label="Sign out"
            title={user?.email ?? 'Sign out'}
          >
            {user?.full_name ?? 'Account'}
          </button>
        </div>
      </div>
    </header>
  )
}
