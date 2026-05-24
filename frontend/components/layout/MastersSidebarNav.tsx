'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  MASTER_SIDEBAR_NAV,
  findMasterNavPathForKey,
  type MasterNavNode,
} from '@/lib/masterSidebarNav'

type Props = {
  pathname: string
}

function activeCategoryKey(pathname: string): string | null {
  const m = pathname.match(/^\/masters\/([^/?]+)/)
  return m?.[1] ?? null
}

function MastersNavNodeRow({
  node,
  depth,
  pathname,
  pathPrefix,
  openPaths,
  togglePath,
}: {
  node: MasterNavNode
  depth: number
  pathname: string
  pathPrefix: string
  openPaths: Set<string>
  togglePath: (pathKey: string) => void
}) {
  const pad = 8 + depth * 10

  if (node.kind === 'leaf') {
    const href = `/masters/${node.key}`
    const active = pathname === href
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2 rounded-md py-1.5 pr-2 text-[12px] transition-colors',
          active
            ? 'bg-surface-sidebar2 text-white'
            : 'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
        )}
        style={{ paddingLeft: pad }}
        title={node.label}
      >
        <span className="truncate">{node.label}</span>
      </Link>
    )
  }

  const pathKey = pathPrefix ? `${pathPrefix}/${node.label}` : node.label
  const isOpen = openPaths.has(pathKey)

  return (
    <>
      <button
        type="button"
        onClick={() => togglePath(pathKey)}
        className={cn(
          'flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-left text-[12px] transition-colors',
          depth === 0 ? 'font-medium text-[#a8c9ac]' : 'text-[#8AAF8E]',
          'hover:bg-surface-sidebar2 hover:text-white',
        )}
        style={{ paddingLeft: pad }}
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 opacity-80" />
        )}
        <span className="truncate">{node.label}</span>
      </button>
      {isOpen &&
        node.children.map((child, i) => (
          <MastersNavNodeRow
            key={child.kind === 'leaf' ? child.key : `${child.label}-${i}`}
            node={child}
            depth={depth + 1}
            pathname={pathname}
            pathPrefix={pathKey}
            openPaths={openPaths}
            togglePath={togglePath}
          />
        ))}
    </>
  )
}

export default function MastersSidebarNav({ pathname }: Props) {
  const activeKey = activeCategoryKey(pathname)
  const activeGroupPathKeys = React.useMemo(() => {
    if (!activeKey) return []
    const segments = findMasterNavPathForKey(activeKey)
    if (!segments || segments.length < 2) return []
    const keys: string[] = []
    let prefix = ''
    for (let i = 0; i < segments.length - 1; i++) {
      prefix = prefix ? `${prefix}/${segments[i]}` : segments[i]
      keys.push(prefix)
    }
    return keys
  }, [activeKey])

  const [openPaths, setOpenPaths] = React.useState<Set<string>>(() => new Set(activeGroupPathKeys))

  React.useEffect(() => {
    if (activeGroupPathKeys.length === 0) return
    setOpenPaths((prev) => {
      const next = new Set(prev)
      for (const key of activeGroupPathKeys) next.add(key)
      return next
    })
  }, [activeGroupPathKeys])

  const togglePath = React.useCallback((pathKey: string) => {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return next
    })
  }, [])

  return (
    <div className="space-y-0.5">
      {MASTER_SIDEBAR_NAV.map((node, i) => (
        <MastersNavNodeRow
          key={node.kind === 'leaf' ? node.key : `${node.label}-${i}`}
          node={node}
          depth={0}
          pathname={pathname}
          pathPrefix=""
          openPaths={openPaths}
          togglePath={togglePath}
        />
      ))}
    </div>
  )
}
