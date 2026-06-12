'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import OthersSidebarNav from '@/components/layout/OthersSidebarNav'
import {
  MASTER_SIDEBAR_NAV,
  findMasterNavPathForKey,
  isMasterNavLeafActive,
  masterNavActiveQueryFromSearchParams,
  masterNavLeafHref,
  type MasterNavLeaf,
  type MasterNavNode,
} from '@/lib/masterSidebarNav'

function activeCategoryKey(pathname: string): string | null {
  const m = pathname.match(/^\/masters\/([^/?]+)/)
  return m?.[1] ?? null
}

function MastersNavNodeRow({
  node,
  depth,
  categoryKey,
  activeQuery,
  pathPrefix,
  openPaths,
  togglePath,
}: {
  node: MasterNavNode
  depth: number
  categoryKey: string | null
  activeQuery: ReturnType<typeof masterNavActiveQueryFromSearchParams>
  pathPrefix: string
  openPaths: Set<string>
  togglePath: (pathKey: string) => void
}) {
  const pad = 8 + depth * 10

  if (node.kind === 'leaf') {
    const active = isMasterNavLeafActive(node, categoryKey, activeQuery)
    return (
      <Link
        href={masterNavLeafHref(node)}
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
            key={child.kind === 'leaf' ? leafRowKey(child) : `${child.label}-${i}`}
            node={child}
            depth={depth + 1}
            categoryKey={categoryKey}
            activeQuery={activeQuery}
            pathPrefix={pathKey}
            openPaths={openPaths}
            togglePath={togglePath}
          />
        ))}
    </>
  )
}

function leafRowKey(leaf: MasterNavLeaf): string {
  return `${leaf.key}:${leaf.navSlug ?? ''}:${leaf.variantType ?? ''}`
}

export default function MastersSidebarNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const categoryKey = activeCategoryKey(pathname)
  const searchKey = searchParams.toString()
  const activeQuery = React.useMemo(
    () => masterNavActiveQueryFromSearchParams(searchParams),
    [searchKey],
  )

  const activeGroupPathKeys = React.useMemo(() => {
    if (!categoryKey) return []
    const segments = findMasterNavPathForKey(categoryKey, MASTER_SIDEBAR_NAV, [], activeQuery)
    if (!segments || segments.length < 2) return []
    const keys: string[] = []
    let prefix = ''
    for (let i = 0; i < segments.length - 1; i++) {
      prefix = prefix ? `${prefix}/${segments[i]}` : segments[i]
      keys.push(prefix)
    }
    return keys
  }, [categoryKey, activeQuery])

  const activeGroupPathKeysKey = activeGroupPathKeys.join('\0')

  const [openPaths, setOpenPaths] = React.useState<Set<string>>(() => new Set(activeGroupPathKeys))

  React.useEffect(() => {
    if (activeGroupPathKeys.length === 0) return
    setOpenPaths((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const key of activeGroupPathKeys) {
        if (!next.has(key)) {
          next.add(key)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [activeGroupPathKeysKey, activeGroupPathKeys])

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
          key={node.kind === 'leaf' ? leafRowKey(node) : `${node.label}-${i}`}
          node={node}
          depth={0}
          categoryKey={categoryKey}
          activeQuery={activeQuery}
          pathPrefix=""
          openPaths={openPaths}
          togglePath={togglePath}
        />
      ))}
      <OthersSidebarNav />
    </div>
  )
}
