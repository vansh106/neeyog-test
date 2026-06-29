import {
  MASTER_SIDEBAR_NAV,
  flattenMasterNavLeaves,
  type MasterNavNode,
} from '@/lib/masterSidebarNav'
import type { DashboardChartsResponse } from '@/lib/api'

export type CategoryMetric = DashboardChartsResponse['category_performance']['categories'][number]

export type HierarchicalCategoryRow = CategoryMetric & {
  depth: number
  is_group: boolean
  bar_width_pct: number
}

/** Dashboard matrix: family (depth 0) and category (depth 1) only — no sub-categories or SKUs. */
const CATEGORY_PERF_MAX_DEPTH = 1

/** Top-level product families always listed (even with zero activity this month). */
export const CATEGORY_PERF_ROOT_FAMILIES = ['Valves', 'Hoses', 'Dampers'] as const

/** Extra metric keys rolled into specific masters nav groups. */
const GROUP_EXTRA_KEYS: Record<string, string[]> = {
  Valves: ['coarse:valves'],
  Hoses: ['coarse:hoses'],
  Dampers: ['coarse:dampers'],
  'Hose Fittings': ['coarse:fittings'],
  'Ball Valve': ['legacy:ball_valve'],
}

/** Legacy / mis-keyed analytics rows → masters catalog keys. */
function canonicalCategoryKey(key: string): string {
  if (key.startsWith('unknown:fp_damper_')) return key.slice('unknown:'.length)
  if (key === 'unknown:fp_damper') return 'coarse:dampers'
  return key
}

function mergeMetricsByCanonicalKey(metrics: CategoryMetric[]): CategoryMetric[] {
  const merged = new Map<string, CategoryMetric>()
  for (const metric of metrics) {
    const key = canonicalCategoryKey(metric.category_key)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, key === metric.category_key ? metric : { ...metric, category_key: key })
      continue
    }
    const won_value = existing.won_value + metric.won_value
    const quoted_value = existing.quoted_value + metric.quoted_value
    const po_count = existing.po_count + metric.po_count
    merged.set(key, {
      ...existing,
      won_value,
      quoted_value,
      po_count,
      win_rate_pct: winRatePct(won_value, quoted_value),
    })
  }
  return [...merged.values()]
}

function collectLeafCatalogKeys(node: MasterNavNode): string[] {
  if (node.kind === 'leaf') return [node.key]
  return node.children.flatMap(collectLeafCatalogKeys)
}

function rollupMetrics(
  keys: string[],
  byKey: Map<string, CategoryMetric>,
): Pick<CategoryMetric, 'won_value' | 'quoted_value' | 'po_count'> {
  let won_value = 0
  let quoted_value = 0
  let po_count = 0
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    const metric = byKey.get(key)
    if (!metric) continue
    won_value += metric.won_value
    quoted_value += metric.quoted_value
    po_count += metric.po_count
  }
  return { won_value, quoted_value, po_count }
}

function metricsForNode(node: MasterNavNode, byKey: Map<string, CategoryMetric>) {
  const keys = collectLeafCatalogKeys(node)
  if (node.kind === 'group') {
    const extra = GROUP_EXTRA_KEYS[node.label]
    if (extra) keys.push(...extra)
  }
  return rollupMetrics(keys, byKey)
}

function hasActivity(node: MasterNavNode, byKey: Map<string, CategoryMetric>): boolean {
  const rollup = metricsForNode(node, byKey)
  if (rollup.won_value > 0 || rollup.quoted_value > 0) return true
  if (node.kind === 'group') {
    return node.children.some((child) => hasActivity(child, byKey))
  }
  return false
}

function winRatePct(won: number, quoted: number): number {
  if (quoted > 0) return Math.round((won / quoted) * 1000) / 10
  return won > 0 ? 100 : 0
}

function winRateTier(
  winRate: number,
  won: number,
  quoted: number,
  medianRate: number,
): CategoryMetric['win_rate_tier'] {
  if (quoted <= 0 && won <= 0) return 'neutral'
  if (winRate >= medianRate + 5) return 'high'
  if (winRate <= medianRate - 5) return 'low'
  return 'medium'
}

function groupRowKey(label: string, depth: number): string {
  return `group:${depth}:${label.toLowerCase().replace(/\s+/g, '_')}`
}

function collapseChildren(node: MasterNavNode): boolean {
  if (node.kind !== 'group') return false
  const keys = collectLeafCatalogKeys(node)
  return keys.length > 0 && new Set(keys).size === 1
}

function walkNav(
  nodes: MasterNavNode[],
  byKey: Map<string, CategoryMetric>,
  depth: number,
  maxWon: number,
  medianRate: number,
  out: HierarchicalCategoryRow[],
  forceInclude = false,
) {
  for (const node of nodes) {
    const isPinnedFamily =
      depth === 0 &&
      node.kind === 'group' &&
      (CATEGORY_PERF_ROOT_FAMILIES as readonly string[]).includes(node.label)
    const include = forceInclude || isPinnedFamily || hasActivity(node, byKey)
    if (!include) continue

    const rollup = metricsForNode(node, byKey)
    const label = node.label
    const winRate = winRatePct(rollup.won_value, rollup.quoted_value)
    const categoryKey = node.kind === 'leaf' ? node.key : groupRowKey(label, depth)

    out.push({
      category_key: categoryKey,
      category_label: label,
      category_abbr: label.slice(0, 4).toUpperCase(),
      won_value: rollup.won_value,
      quoted_value: rollup.quoted_value,
      po_count: rollup.po_count,
      win_rate_pct: winRate,
      win_rate_tier: winRateTier(winRate, rollup.won_value, rollup.quoted_value, medianRate),
      depth,
      is_group: node.kind === 'group',
      bar_width_pct: maxWon > 0 ? Math.round((rollup.won_value / maxWon) * 1000) / 10 : 0,
    })

    if (node.kind === 'group' && !collapseChildren(node) && depth < CATEGORY_PERF_MAX_DEPTH) {
      const forceChildren =
        forceInclude ||
        (depth === 0 && (CATEGORY_PERF_ROOT_FAMILIES as readonly string[]).includes(node.label))
      walkNav(node.children, byKey, depth + 1, maxWon, medianRate, out, forceChildren)
    }
  }
}

function coveredCatalogKeys(): Set<string> {
  const keys = new Set<string>()
  for (const leaf of flattenMasterNavLeaves()) {
    keys.add(leaf.key)
  }
  for (const extra of Object.values(GROUP_EXTRA_KEYS)) {
    for (const key of extra) keys.add(key)
  }
  return keys
}

export function buildHierarchicalCategoryRows(
  metrics: CategoryMetric[],
): HierarchicalCategoryRow[] {
  const normalized = mergeMetricsByCanonicalKey(metrics)
  const byKey = new Map(normalized.map((metric) => [metric.category_key, metric]))
  const covered = coveredCatalogKeys()

  const orphanMetrics = normalized.filter(
    (metric) =>
      !covered.has(metric.category_key) &&
      (metric.won_value > 0 || metric.quoted_value > 0),
  )

  const navRollups: Pick<CategoryMetric, 'won_value' | 'quoted_value'>[] = []
  function collectRollups(nodes: MasterNavNode[], depth = 0, forceInclude = false) {
    for (const node of nodes) {
      const isPinnedFamily =
        depth === 0 &&
        node.kind === 'group' &&
        (CATEGORY_PERF_ROOT_FAMILIES as readonly string[]).includes(node.label)
      const include = forceInclude || isPinnedFamily || hasActivity(node, byKey)
      if (!include) continue
      navRollups.push(metricsForNode(node, byKey))
      if (node.kind === 'group' && depth < CATEGORY_PERF_MAX_DEPTH) {
        const forceChildren =
          forceInclude ||
          (depth === 0 && (CATEGORY_PERF_ROOT_FAMILIES as readonly string[]).includes(node.label))
        collectRollups(node.children, depth + 1, forceChildren)
      }
    }
  }
  collectRollups(MASTER_SIDEBAR_NAV)

  const maxWon = Math.max(
    ...navRollups.map((row) => row.won_value),
    ...orphanMetrics.map((row) => row.won_value),
    0,
  )

  const winRates = navRollups
    .filter((row) => row.quoted_value > 0 || row.won_value > 0)
    .map((row) => winRatePct(row.won_value, row.quoted_value))
  const medianRate = winRates.length > 0 ? [...winRates].sort((a, b) => a - b)[Math.floor(winRates.length / 2)] : 0

  const rows: HierarchicalCategoryRow[] = []
  walkNav(MASTER_SIDEBAR_NAV, byKey, 0, maxWon, medianRate, rows)

  if (orphanMetrics.length > 0) {
    const orphanRollup = rollupMetrics(
      orphanMetrics.map((metric) => metric.category_key),
      byKey,
    )
    const orphanWinRate = winRatePct(orphanRollup.won_value, orphanRollup.quoted_value)
    rows.push({
      category_key: 'group:orphans',
      category_label: 'Other categories',
      category_abbr: 'OTHR',
      won_value: orphanRollup.won_value,
      quoted_value: orphanRollup.quoted_value,
      po_count: orphanRollup.po_count,
      win_rate_pct: orphanWinRate,
      win_rate_tier: winRateTier(
        orphanWinRate,
        orphanRollup.won_value,
        orphanRollup.quoted_value,
        medianRate,
      ),
      depth: 0,
      is_group: true,
      bar_width_pct:
        maxWon > 0 ? Math.round((orphanRollup.won_value / maxWon) * 1000) / 10 : 0,
    })
    for (const metric of orphanMetrics) {
      rows.push({
        ...metric,
        depth: 1,
        is_group: false,
        bar_width_pct: maxWon > 0 ? Math.round((metric.won_value / maxWon) * 1000) / 10 : 0,
      })
    }
  }

  return rows
}

export type CategoryPerformanceFamilyBlock = {
  family: HierarchicalCategoryRow
  children: HierarchicalCategoryRow[]
}

/** Group flat hierarchical rows into family blocks for accordion UI. */
export function groupCategoryPerformanceFamilies(
  rows: HierarchicalCategoryRow[],
): CategoryPerformanceFamilyBlock[] {
  const blocks: CategoryPerformanceFamilyBlock[] = []
  let current: CategoryPerformanceFamilyBlock | null = null

  for (const row of rows) {
    if (row.depth === 0) {
      current = { family: row, children: [] }
      blocks.push(current)
      continue
    }
    if (current && row.depth === 1) {
      current.children.push(row)
    }
  }

  return blocks
}

export function categoryPerformanceInsight(rows: HierarchicalCategoryRow[]): {
  insight: string | null
  highlight_token: string | null
} {
  const topLevel = rows.filter((row) => row.depth === 0)
  const withVolume = topLevel.filter((row) => row.won_value > 0)
  if (withVolume.length === 0) {
    return { insight: null, highlight_token: null }
  }

  const topVol = [...withVolume].sort((a, b) => b.won_value - a.won_value)[0]
  const weakest = [...withVolume].sort((a, b) => a.win_rate_pct - b.win_rate_pct)[0]

  if (topVol.category_key === weakest.category_key) {
    return {
      highlight_token: topVol.category_label,
      insight: `${topVol.category_label} = most volume, weakest win rate`,
    }
  }
  if (weakest.win_rate_pct < topVol.win_rate_pct - 8) {
    return {
      highlight_token: weakest.category_label,
      insight: `${topVol.category_label} leads volume; ${weakest.category_label} has weakest win rate`,
    }
  }
  return { insight: null, highlight_token: null }
}
