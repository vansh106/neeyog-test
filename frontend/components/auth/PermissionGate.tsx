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
  const user = useAuthStore((s) => s.user)
  const hasPermission = useAuthStore((s) => s.hasPermission)

  let hasAccess = false
  if (user?.tier === 'superadmin') {
    hasAccess = true
  } else if (permission) {
    hasAccess = hasPermission(permission)
  } else if (permissions && permissions.length > 0) {
    hasAccess = permissions.some((p) => hasPermission(p))
  } else if (allOf && allOf.length > 0) {
    hasAccess = allOf.every((p) => hasPermission(p))
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}

