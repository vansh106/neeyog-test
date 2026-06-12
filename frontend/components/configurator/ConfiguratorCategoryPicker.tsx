'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { mastersApi } from '@/lib/api'
import {
  type ConfiguratorCatalogPick,
  type ConfiguratorProductFamily,
  CONFIGURATOR_STEP1_PRODUCT_NAV,
  configuratorLeafLabel,
  configuratorProductFamilyForKey,
  configuratorPickFromLeaf,
  isOthersCatalogCategory,
} from '@/lib/configuratorProductFlow'
import {
  findMasterNavPathForKey,
  isMasterNavLeafActive,
  type MasterNavLeaf,
  type MasterNavNode,
} from '@/lib/masterSidebarNav'
import type { OthersCategory } from '@/types'

export type { ConfiguratorProductFamily }

export type ConfiguratorCategorySelection = {
  key: string | null
  label?: string | null
  variantType?: string | null
  navSlug?: string | null
}

type Props = {
  selection: ConfiguratorCategorySelection
  onSelect: (pick: ConfiguratorCatalogPick) => void
  onClearSelection: () => void
  temporaryActive?: boolean
  onSelectTemporary?: (family: ConfiguratorProductFamily) => void
  onClearTemporary?: () => void
}

const FAMILY_HINTS: Record<ConfiguratorProductFamily, string> = {
  Valves: 'Butterfly, ball, diaphragm, NRV, and more',
  Hoses: 'Tuder, PVC, silicon, PU hoses',
  Dampers: 'Butterfly and multi-louver dampers',
  Others: 'Custom categorisations and sheets from Masters',
}

const CONFIGURATOR_FAMILIES: ConfiguratorProductFamily[] = [
  'Valves',
  'Hoses',
  'Dampers',
  'Others',
]

const EMPTY_NAV_STACK: string[] = []
const EMPTY_OTHERS_CATEGORIES: OthersCategory[] = []

function navStacksEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function stripMasconPrefix(label: string): string {
  return label.replace(/^Mascon\s*—\s*/i, '').trim()
}

function familyNodes(family: 'Valves' | 'Hoses' | 'Dampers'): MasterNavNode[] {
  const root = CONFIGURATOR_STEP1_PRODUCT_NAV.find((n) => n.kind === 'group' && n.label === family)
  return root?.kind === 'group' ? root.children : []
}

function nodesAtPath(family: 'Valves' | 'Hoses' | 'Dampers', pathLabels: string[]): MasterNavNode[] {
  let current = familyNodes(family)
  for (const label of pathLabels) {
    const group = current.find((n) => n.kind === 'group' && n.label === label)
    if (!group || group.kind !== 'group') return current
    current = group.children
  }
  return current
}

function navStackFromSelection(selection: ConfiguratorCategorySelection): string[] {
  if (!selection.key || isOthersCatalogCategory(selection.key)) return EMPTY_NAV_STACK
  const segments = findMasterNavPathForKey(selection.key, CONFIGURATOR_STEP1_PRODUCT_NAV, [], {
    variantType: selection.variantType ?? null,
    navSlug: selection.navSlug ?? null,
    variantContains: null,
    variantExcludeContains: null,
    variantContainsAny: null,
    modelNamePrefix: null,
  })
  if (!segments || segments.length < 3) return EMPTY_NAV_STACK
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
  temporaryActive = false,
  onSelectTemporary,
  onClearTemporary,
}: Props) {
  const inferredFamily = configuratorProductFamilyForKey(selection.key)
  const [pickedFamily, setPickedFamily] = React.useState<ConfiguratorProductFamily | null>(null)
  const [navStack, setNavStack] = React.useState<string[]>([])

  const activeFamily = inferredFamily ?? pickedFamily

  const { data: othersTreeData, isPending: othersLoading } = useQuery({
    queryKey: ['othersMastersTree', 'configurator'],
    queryFn: () => mastersApi.getOthersTree<{ items: OthersCategory[] }>(),
    enabled: activeFamily === 'Others',
    staleTime: 30_000,
  })
  const othersCategories = othersTreeData?.items ?? EMPTY_OTHERS_CATEGORIES

  React.useEffect(() => {
    if (!selection.key) return
    const family = configuratorProductFamilyForKey(selection.key)
    if (!family) return

    setPickedFamily((prev) => (prev === family ? prev : family))

    let nextStack: string[]
    if (family === 'Others' && isOthersCatalogCategory(selection.key)) {
      const cat = othersCategories.find((c) =>
        c.sheets.some((s) => s.catalog_key === selection.key),
      )
      nextStack = cat ? [cat.name] : EMPTY_NAV_STACK
    } else {
      nextStack = navStackFromSelection(selection)
    }
    setNavStack((prev) => (navStacksEqual(prev, nextStack) ? prev : nextStack))
  }, [selection.key, selection.variantType, selection.navSlug, othersCategories])

  const currentNodes =
    activeFamily === 'Valves' || activeFamily === 'Hoses' || activeFamily === 'Dampers'
      ? nodesAtPath(activeFamily, navStack)
      : []

  const othersCategory =
    activeFamily === 'Others' && navStack.length > 0
      ? othersCategories.find((c) => c.name === navStack[0]) ?? null
      : null

  const breadcrumb = React.useMemo(() => {
    if (!activeFamily) return []
    return [activeFamily, ...navStack]
  }, [activeFamily, navStack])

  const changeFamily = () => {
    setPickedFamily(null)
    setNavStack([])
    onClearTemporary?.()
    onClearSelection()
  }

  const goBackOneLevel = () => {
    onClearTemporary?.()
    onClearSelection()
    if (navStack.length === 0) {
      setPickedFamily(null)
      return
    }
    setNavStack((prev) => prev.slice(0, -1))
  }

  const drillIntoGroup = (label: string) => {
    onClearTemporary?.()
    onClearSelection()
    setNavStack((prev) => [...prev, label])
  }

  const levelTitle =
    activeFamily === 'Others'
      ? navStack.length === 0
        ? 'Select categorisation'
        : `Select sheet — ${navStack[0]}`
      : navStack.length > 0
        ? navStack[navStack.length - 1]
        : activeFamily
          ? `Select ${activeFamily} type`
          : ''

  const selectedLabel =
    selection.label ??
    (selection.key
      ? configuratorLeafLabel(selection.key, {
          navSlug: selection.navSlug,
          variantType: selection.variantType,
          displayLabel: selection.label,
        })
      : '')

  if (!activeFamily) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-gray-800">Step 1 — Choose product family</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CONFIGURATOR_FAMILIES.map((family) => (
            <SelectionCard
              key={family}
              label={family}
              hint={FAMILY_HINTS[family]}
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

  const hasLeafSelected = Boolean(selection.key) && !temporaryActive

  const otherFamilies = CONFIGURATOR_FAMILIES.filter((f) => f !== activeFamily)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {breadcrumb.map((part, i) => (
          <React.Fragment key={`${part}-${i}`}>
            {i > 0 ? <span className="text-surface-muted">›</span> : null}
            <span
              className={
                i === breadcrumb.length - 1 && !hasLeafSelected
                  ? 'font-medium text-gray-900'
                  : 'text-surface-muted'
              }
            >
              {part}
            </span>
          </React.Fragment>
        ))}
        {temporaryActive ? (
          <>
            <span className="text-surface-muted">›</span>
            <span className="font-medium text-brand-gold-700">Temporary product</span>
          </>
        ) : hasLeafSelected ? (
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
        {navStack.length === 0
          ? 'Change family'
          : `Back to ${navStack.length > 1 ? navStack[navStack.length - 2] : activeFamily}`}
      </button>

      {temporaryActive ? (
        <div className="rounded-xl border border-brand-gold-200 bg-brand-gold-50 px-3 py-2">
          <p className="text-[12px] text-surface-muted">Temporary product</p>
          <p className="text-[13px] font-semibold text-gray-900">
            Free-text product (not in catalog)
          </p>
          <button
            type="button"
            onClick={() => onClearTemporary?.()}
            className="mt-1 text-[12px] font-medium text-brand-gold-800 hover:underline"
          >
            Change selection
          </button>
        </div>
      ) : hasLeafSelected && selection.key ? (
        <div className="rounded-xl border border-brand-green-200 bg-brand-green-50 px-3 py-2">
          <p className="text-[12px] text-surface-muted">Selected product sheet</p>
          <p className="text-[13px] font-semibold text-gray-900">
            {stripMasconPrefix(selectedLabel)}
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
          {activeFamily === 'Others' && othersLoading ? (
            <div className="flex items-center gap-2 text-[12px] text-surface-muted">
              <Loader2 className="size-4 animate-spin" />
              Loading Others catalog…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {activeFamily === 'Others' ? (
                navStack.length === 0 ? (
                  othersCategories.length === 0 ? (
                    <p className="col-span-full text-[12px] text-surface-muted">
                      No categorisations yet. Add them under Masters → Others.
                    </p>
                  ) : (
                    othersCategories.map((cat) => (
                      <SelectionCard
                        key={cat.id}
                        label={cat.name}
                        hint={`${cat.sheets.length} sheet${cat.sheets.length === 1 ? '' : 's'}`}
                        onClick={() => drillIntoGroup(cat.name)}
                      />
                    ))
                  )
                ) : othersCategory ? (
                  othersCategory.sheets.length === 0 ? (
                    <p className="col-span-full text-[12px] text-surface-muted">
                      No sheets in this category. Add them under Masters → Others.
                    </p>
                  ) : (
                    othersCategory.sheets.map((sheet) => (
                      <SelectionCard
                        key={sheet.id}
                        label={sheet.name}
                        hint="Product sheet"
                        active={selection.key === sheet.catalog_key}
                        onClick={() => onSelect({ key: sheet.catalog_key, label: sheet.name })}
                      />
                    ))
                  )
                ) : null
              ) : (
                currentNodes.map((node, i) => {
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
                })
              )}
              {onSelectTemporary && activeFamily !== 'Others' ? (
                <SelectionCard
                  label="Ingest temporary product"
                  hint="Free-text description — price on review step"
                  onClick={() => onSelectTemporary(activeFamily)}
                />
              ) : null}
              {onSelectTemporary && activeFamily === 'Others' ? (
                <SelectionCard
                  label="Ingest temporary product"
                  hint="Free-text description — price on review step"
                  onClick={() => onSelectTemporary('Others')}
                />
              ) : null}
            </div>
          )}
        </>
      )}

      {navStack.length === 0 && !hasLeafSelected && otherFamilies.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {otherFamilies.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setPickedFamily(f)
                setNavStack([])
                onClearSelection()
              }}
              className="text-[12px] text-surface-muted hover:text-brand-green-700 hover:underline"
            >
              Switch to {f}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
