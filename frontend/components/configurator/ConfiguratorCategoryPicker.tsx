'use client'

import React from 'react'
import { ChevronLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  type ConfiguratorCatalogPick,
  CONFIGURATOR_STEP1_PRODUCT_NAV,
  configuratorLeafLabel,
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

function nodesAtPath(family: ConfiguratorProductFamily, pathLabels: string[]): MasterNavNode[] {
  let current = familyNodes(family)
  for (const label of pathLabels) {
    const group = current.find((n) => n.kind === 'group' && n.label === label)
    if (!group || group.kind !== 'group') return current
    current = group.children
  }
  return current
}

function navStackFromSelection(selection: ConfiguratorCategorySelection): string[] {
  if (!selection.key) return []
  const segments = findMasterNavPathForKey(selection.key, CONFIGURATOR_STEP1_PRODUCT_NAV, [], {
    variantType: selection.variantType ?? null,
    navSlug: selection.navSlug ?? null,
    variantContains: null,
    variantExcludeContains: null,
    variantContainsAny: null,
    modelNamePrefix: null,
  })
  if (!segments || segments.length < 3) return []
  return segments.slice(1, -1)
}

function SelectionCard({
  label,
  hint,
  active,
  onClick,
}: {
  label: string
  hint?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border p-3 text-left transition',
        active
          ? 'border-2 border-brand-green-500 bg-brand-green-50'
          : 'border-surface-border bg-white hover:border-brand-green-400 hover:bg-brand-green-50',
      )}
    >
      <p className="text-[13px] font-semibold leading-snug text-gray-900">{stripMasconPrefix(label)}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-surface-muted">{hint}</p> : null}
    </button>
  )
}

export default function ConfiguratorCategoryPicker({
  selection,
  onSelect,
  onClearSelection,
}: Props) {
  const inferredFamily = configuratorProductFamilyForKey(selection.key)
  const [pickedFamily, setPickedFamily] = React.useState<ConfiguratorProductFamily | null>(null)
  const [navStack, setNavStack] = React.useState<string[]>([])

  const activeFamily = inferredFamily ?? pickedFamily

  React.useEffect(() => {
    if (!selection.key) return
    const family = configuratorProductFamilyForKey(selection.key)
    if (!family) return
    setPickedFamily(family)
    setNavStack(navStackFromSelection(selection))
  }, [selection.key, selection.variantType, selection.navSlug])

  const currentNodes = activeFamily ? nodesAtPath(activeFamily, navStack) : []

  const breadcrumb = React.useMemo(() => {
    if (!activeFamily) return []
    return [activeFamily, ...navStack]
  }, [activeFamily, navStack])

  const changeFamily = () => {
    setPickedFamily(null)
    setNavStack([])
    onClearSelection()
  }

  const goBackOneLevel = () => {
    onClearSelection()
    if (navStack.length === 0) {
      setPickedFamily(null)
      return
    }
    setNavStack((prev) => prev.slice(0, -1))
  }

  const drillIntoGroup = (label: string) => {
    onClearSelection()
    setNavStack((prev) => [...prev, label])
  }

  const levelTitle =
    navStack.length > 0 ? navStack[navStack.length - 1] : activeFamily ? `Select ${activeFamily} type` : ''

  if (!activeFamily) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-gray-800">Step 1 — Choose product family</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(['Valves', 'Hoses'] as const).map((family) => (
            <SelectionCard
              key={family}
              label={family}
              hint={
                family === 'Valves'
                  ? 'Butterfly, ball, diaphragm, NRV, and more'
                  : 'Tuder, PVC, silicon, PU hoses'
              }
              onClick={() => {
                setPickedFamily(family)
                setNavStack([])
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  const hasLeafSelected = Boolean(selection.key)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {breadcrumb.map((part, i) => (
          <React.Fragment key={`${part}-${i}`}>
            {i > 0 ? <span className="text-surface-muted">›</span> : null}
            <span className={i === breadcrumb.length - 1 && !hasLeafSelected ? 'font-medium text-gray-900' : 'text-surface-muted'}>
              {part}
            </span>
          </React.Fragment>
        ))}
        {hasLeafSelected ? (
          <>
            <span className="text-surface-muted">›</span>
            <span className="font-medium text-brand-green-700">Product sheet selected</span>
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={goBackOneLevel}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-green-700 hover:underline"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {navStack.length === 0 ? 'Change family' : `Back to ${navStack.length > 1 ? navStack[navStack.length - 2] : activeFamily}`}
      </button>

      {hasLeafSelected && selection.key ? (
        <div className="rounded-xl border border-brand-green-200 bg-brand-green-50 px-3 py-2">
          <p className="text-[12px] text-surface-muted">Selected product sheet</p>
          <p className="text-[13px] font-semibold text-gray-900">
            {stripMasconPrefix(
              configuratorLeafLabel(selection.key, {
                navSlug: selection.navSlug,
                variantType: selection.variantType,
              }),
            )}
          </p>
          <button
            type="button"
            onClick={onClearSelection}
            className="mt-1 text-[12px] font-medium text-brand-green-700 hover:underline"
          >
            Change product sheet
          </button>
        </div>
      ) : (
        <>
          <p className="text-[12px] font-medium text-gray-800">{levelTitle}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {currentNodes.map((node, i) => {
              if (node.kind === 'leaf') {
                const active = isMasterNavLeafActive(node, selection.key, {
                  variantType: selection.variantType ?? null,
                  navSlug: selection.navSlug ?? null,
                  variantContains: null,
                  variantExcludeContains: null,
                  variantContainsAny: null,
                  modelNamePrefix: null,
                })
                return (
                  <SelectionCard
                    key={`leaf-${node.key}-${node.navSlug ?? i}`}
                    label={node.label}
                    hint="Product sheet"
                    active={active}
                    onClick={() => onSelect(configuratorPickFromLeaf(node))}
                  />
                )
              }
              const childCount = node.children.length
              const onlyLeaves = node.children.every((c) => c.kind === 'leaf')
              return (
                <SelectionCard
                  key={`group-${node.label}-${i}`}
                  label={node.label}
                  hint={
                    onlyLeaves
                      ? `${childCount} product sheet${childCount === 1 ? '' : 's'}`
                      : `${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'}`
                  }
                  onClick={() => drillIntoGroup(node.label)}
                />
              )
            })}
          </div>
        </>
      )}

      {navStack.length === 0 && !hasLeafSelected ? (
        <button
          type="button"
          onClick={changeFamily}
          className="text-[12px] text-surface-muted hover:text-brand-green-700 hover:underline"
        >
          Switch to {activeFamily === 'Valves' ? 'Hoses' : 'Valves'}
        </button>
      ) : null}
    </div>
  )
}
