'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { cn } from '@/lib/utils'
import MastersSidebarNav from '@/components/layout/MastersSidebarNav'

function MastersSidebarSectionInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'catalog'
  const onMastersPage = pathname === '/masters'

  return (
    <div className="mt-1 ml-2 space-y-0.5">
      <Link
        href="/masters?tab=edit"
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-[12px] transition-colors',
          onMastersPage && tab === 'edit'
            ? 'bg-surface-sidebar2 text-white'
            : 'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
        )}
      >
        <span className="truncate">Edit Masters</span>
      </Link>
      <MastersSidebarNav />
    </div>
  )
}

export default function MastersSidebarSection() {
  return (
    <Suspense fallback={<div className="ml-2 px-3 py-2 text-[11px] text-[#8AAF8E]">Loading…</div>}>
      <MastersSidebarSectionInner />
    </Suspense>
  )
}
