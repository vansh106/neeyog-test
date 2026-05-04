'use client'

import type { ReactNode } from 'react'

import { useAuthStore } from '@/stores/authStore'

interface PermissionGateProps {
  permission?: string
  permissions?: string[]
  allOf?: string[]
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGate({
  permission,
  permissions,
  allOf,
  fallback = null,
  children,
}: PermissionGateProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const hasAny = useAuthStore((s) => s.hasAny)
  const user = useAuthStore((s) => s.user)

  let hasAccess = false

  if (user?.tier === 'superadmin') {
    hasAccess = true
  } else if (permission) {
    hasAccess = hasPermission(permission)
  } else if (permissions?.length) {
    hasAccess = hasAny(...permissions)
  } else if (allOf?.length) {
    hasAccess = allOf.every((p) => hasPermission(p))
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
