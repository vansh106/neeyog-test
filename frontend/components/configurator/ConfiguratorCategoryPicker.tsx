'use client'

import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  type ConfiguratorCatalogPick,
  CONFIGURATOR_STEP1_PRODUCT_NAV,
  configuratorProductFamilyForKey,
  configuratorPickFromLeaf,
} from '@/lib/configuratorProductFlow'
import {
  findMasterNavPathForKey,
  isMasterNavLeafActive,
  type MasterNavLeaf,
  type MasterNavNode,
} from '@/lib/masterSidebarNav'

export type ConfiguratorProductFamily = 'Valves' | 'Hoses'

export type ConfiguratorCategorySelection = {
  key: string | null
  variantType?: string | null
  navSlug?: string | null
}

type Props = {
  selection: ConfiguratorCategorySelection
  onSelect: (pick: ConfiguratorCatalogPick) => void
  onClearSelection: () => void
}

function stripMasconPrefix(label: string): string {
  return label.replace(/^Mascon\s*—\s*/i, '').trim()
}

function familyNodes(family: ConfiguratorProductFamily): MasterNavNode[] {
  const root = CONFIGURATOR_STEP1_PRODUCT_NAV.find((n) => n.kind === 'group' && n.label === family)
  return root?.kind === 'group' ? root.children : []
}

function groupPathKeysForSelection(selection: ConfiguratorCategorySelection): string[] {
  if (!selection.key) return []
  const segments = findMasterNavPathForKey(selection.key, CONFIGURATOR_STEP1_PRODUCT_NAV, [], {
    variantType: selection.variantType ?? null,
    navSlug: selection.navSlug ?? null,
  })
  if (!segments || segments.length < 2) return []
  const keys: string[] = []
  let prefix = ''
  for (let i = 0; i < segments.length - 1; i++) {
    prefix = prefix ? `${prefix}/${segments[i]}` : segments[i]
    keys.push(prefix)
  }
  return keys
}

function leafRowKey(leaf: MasterNavLeaf): string {
  return `${leaf.key}:${leaf.navSlug ?? ''}:${leaf.variantType ?? ''}`
}

function NavNodeRow({
  node,
  depth,
  pathPrefix,
  selection,
  openPaths,
  togglePath,
  onSelect,
}: {
  node: MasterNavNode
  depth: number
  pathPrefix: string
  selection: ConfiguratorCategorySelection
  openPaths: Set<string>
  togglePath: (pathKey: string) => void
  onSelect: (pick: ConfiguratorCatalogPick) => void
}) {
  if (node.kind === 'leaf') {
    const active = isMasterNavLeafActive(
      node,
      selection.key,
      selection.variantType ?? null,
      selection.navSlug ?? null,
    )
    return (
      <button
        type="button"
        onClick={() => onSelect(configuratorPickFromLeaf(node))}
        className={cn(
          'w-full rounded-xl border p-3 text-left transition',
          active
            ? 'border-2 border-brand-green-500 bg-brand-green-50'
            : 'border-surface-border bg-white hover:bg-surface-page',
        )}
        style={{ marginLeft: depth * 8 }}
      >
        <p className="text-[13px] font-semibold leading-snug text-gray-900">
          {stripMasconPrefix(node.label)}
        </p>
      </button>
    )
  }

  const pathKey = pathPrefix ? `${pathPrefix}/${node.label}` : node.label
  const isOpen = openPaths.has(pathKey)

  return (
    <div className="space-y-1" style={{ marginLeft: depth * 8 }}>
      <button
        type="button"
        onClick={() => togglePath(pathKey)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-left text-[13px] font-medium text-gray-900 transition hover:bg-surface-page',
        )}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-surface-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-surface-muted" />
        )}
        <span className="truncate">{node.label}</span>
      </button>
      {isOpen && (
        <div className="space-y-1 pb-1 pl-1">
          {node.children.map((child, i) => (
            <NavNodeRow
              key={child.kind === 'leaf' ? leafRowKey(child) : `${child.label}-${i}`}
              node={child}
              depth={depth + 1}
              pathPrefix={pathKey}
              selection={selection}
              openPaths={openPaths}
              togglePath={togglePath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ConfiguratorCategoryPicker({
  selection,
  onSelect,
  onClearSelection,
}: Props) {
  const inferredFamily = configuratorProductFamilyForKey(selection.key)
  const [pickedFamily, setPickedFamily] = React.useState<ConfiguratorProductFamily | null>(null)

  const activeFamily = inferredFamily ?? pickedFamily

  const activeGroupPathKeys = React.useMemo(
    () => groupPathKeysForSelection(selection),
    [selection],
  )

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

  const changeFamily = () => {
    setPickedFamily(null)
    onClearSelection()
  }

  if (!activeFamily) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-surface-muted">Choose product family</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(['Valves', 'Hoses'] as const).map((family) => (
            <button
              key={family}
              type="button"
              onClick={() => setPickedFamily(family)}
              className="rounded-xl border border-surface-border bg-white p-4 text-left transition hover:border-brand-green-400 hover:bg-brand-green-50"
            >
              <p className="text-[15px] font-semibold text-gray-900">{family}</p>
              <p className="mt-1 text-[12px] text-surface-muted">
                {family === 'Valves'
                  ? 'Butterfly, ball, diaphragm, NRV, and more'
                  : 'Tuder, PVC, silicon, PU hoses'}
              </p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const tree = familyNodes(activeFamily)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={changeFamily}
          className="text-[12px] font-medium text-brand-green-700 hover:underline"
        >
          ← Change family
        </button>
        <span className="text-[12px] text-surface-muted">
          {activeFamily} → pick type, then product sheet
        </span>
      </div>
      <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
        {tree.map((node, i) => (
          <NavNodeRow
            key={node.kind === 'leaf' ? leafRowKey(node) : `${node.label}-${i}`}
            node={node}
            depth={0}
            pathPrefix={activeFamily}
            selection={selection}
            openPaths={openPaths}
            togglePath={togglePath}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
