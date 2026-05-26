/**
 * Accessories hierarchy for manual configurator (matches Masters → Accessories).
 * Actuator / brackets are configured in earlier steps — only SOV, LSB, positioner here.
 */

import {
  MASTER_SIDEBAR_NAV,
  type MasterNavGroup,
  type MasterNavLeaf,
} from '@/lib/masterSidebarNav'
import type { Accessories, AccessoryItem } from '@/types'

export type AccessoryCatalogKey = 'sov' | 'limit_switch_box' | 'positioner'

export type AccessorySubcategory = {
  label: string
  match: (item: AccessoryItem) => boolean
}

export type ConfiguratorAccessoryCategory = {
  catalogKey: AccessoryCatalogKey
  /** Card title in optional-accessories step */
  uiLabel: string
  subcategories: AccessorySubcategory[]
}

const OPTIONAL_STEP_GROUPS = new Set(['SOV', 'Limit Switch Box', 'Positioner'])

const UI_LABELS: Record<string, string> = {
  SOV: 'Solenoid Valve (SOV)',
  'Limit Switch Box': 'Limit Switch Box (LSB)',
  Positioner: 'Positioner',
}

function accessoriesRoot(): MasterNavGroup | null {
  const node = MASTER_SIDEBAR_NAV.find((n) => n.kind === 'group' && n.label === 'Accessories')
  return node?.kind === 'group' ? node : null
}

/** Same filtering rules as masters sheet leaves, applied to accessory ``type`` text. */
export function accessoryMatchesLeaf(item: AccessoryItem, leaf: MasterNavLeaf): boolean {
  const t = item.type ?? ''
  if (leaf.variantContainsAny?.length) {
    return leaf.variantContainsAny.some((s) => t.includes(s))
  }
  if (leaf.variantContains) {
    if (!t.includes(leaf.variantContains)) return false
    if (leaf.variantExcludeContains && t.includes(leaf.variantExcludeContains)) return false
    return true
  }
  if (leaf.variantType) {
    return t.includes(leaf.variantType)
  }
  return true
}

export function getConfiguratorAccessoryCategories(): ConfiguratorAccessoryCategory[] {
  const root = accessoriesRoot()
  if (!root) return []

  const out: ConfiguratorAccessoryCategory[] = []
  for (const node of root.children) {
    if (node.kind !== 'group' || !OPTIONAL_STEP_GROUPS.has(node.label)) continue
    const leaves = node.children.filter((c): c is MasterNavLeaf => c.kind === 'leaf')
    if (!leaves.length) continue
    const catalogKey = leaves[0].key
    if (catalogKey !== 'sov' && catalogKey !== 'limit_switch_box' && catalogKey !== 'positioner') {
      continue
    }
    out.push({
      catalogKey,
      uiLabel: UI_LABELS[node.label] ?? node.label,
      subcategories: leaves.map((leaf) => ({
        label: leaf.label,
        match: (item) => accessoryMatchesLeaf(item, leaf),
      })),
    })
  }
  return out
}

export function accessoryItemsForCategory(
  accessories: Accessories | null | undefined,
  catalogKey: AccessoryCatalogKey,
): AccessoryItem[] {
  if (!accessories) return []
  switch (catalogKey) {
    case 'sov':
      return accessories.sov ?? []
    case 'limit_switch_box':
      return accessories.limit_switch_boxes ?? []
    case 'positioner':
      return accessories.positioners ?? []
    default:
      return []
  }
}

export type AccessorySelectGroup = {
  label: string
  items: AccessoryItem[]
}

export function groupAccessoryItems(
  items: AccessoryItem[],
  subcategories: AccessorySubcategory[],
): AccessorySelectGroup[] {
  const groups: AccessorySelectGroup[] = []
  const used = new Set<string>()
  for (const sub of subcategories) {
    const matched = items.filter((item) => sub.match(item))
    for (const item of matched) used.add(item.id)
    if (matched.length > 0) {
      groups.push({ label: sub.label, items: matched })
    }
  }
  const other = items.filter((item) => !used.has(item.id))
  if (other.length > 0) {
    groups.push({ label: 'Other', items: other })
  }
  return groups
}
