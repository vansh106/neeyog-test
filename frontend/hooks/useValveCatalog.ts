'use client'

import { useCallback, useState } from 'react'

import { configuratorApi } from '@/lib/api'

/** Session cache: valve type string → rows */
const valveCatalogCache = new Map<string, CatalogRow[]>()

/** Session cache: `masters_${category}` → rows */
const mastersCatalogCache = new Map<string, CatalogRow[]>()

export type CatalogRow = Record<string, string | number | null | undefined>
export type Filters = Record<string, string>

function cellMatchesSelected(rowVal: unknown, selected: string): boolean {
  if (rowVal == null && selected === '') return false
  if (rowVal == null) return false
  if (typeof rowVal === 'number' && Number.isFinite(rowVal)) {
    const n = Number(selected)
    return Number.isFinite(n) && rowVal === n
  }
  return String(rowVal).trim() === selected.trim()
}

/** Distinct non-empty values for `field` after applying `priorFilters` (AND). */
export function computeDistinctOptions(catalog: CatalogRow[], field: string, priorFilters: Filters): string[] {
  const filtered = catalog.filter((row) => {
    for (const [key, val] of Object.entries(priorFilters)) {
      if (!val) continue
      if (!cellMatchesSelected(row[key], val)) return false
    }
    return true
  })

  const seen = new Set<string>()
  const result: string[] = []
  for (const row of filtered) {
    const val = row[field]
    if (val === null || val === undefined) continue
    const str = String(val).trim()
    if (!str) continue
    if (seen.has(str)) continue
    seen.add(str)
    result.push(str)
  }
  return result.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** First row matching all non-empty filters, or null if none. */
export function resolveMatchingRow(catalog: CatalogRow[], allFilters: Filters): CatalogRow | null {
  const entries = Object.entries(allFilters).filter(([, v]) => v && String(v).trim() !== '')
  if (entries.length === 0) return null
  const matches = catalog.filter((row) => entries.every(([k, v]) => cellMatchesSelected(row[k], v)))
  if (matches.length === 0) return null
  return matches[0]
}

export function useValveCatalog(valveType: string | null) {
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCatalog = useCallback(async (type: string, force = false) => {
    if (!type) return
    if (!force && valveCatalogCache.has(type)) {
      setCatalog(valveCatalogCache.get(type)!)
      setError(null)
      return
    }
    if (force) valveCatalogCache.delete(type)
    setIsLoading(true)
    setError(null)
    try {
      const res = await configuratorApi.getFullCatalog<{
        valve_type: string
        count: number
        rows: CatalogRow[]
      }>(type)
      const rows = res.rows ?? []
      valveCatalogCache.set(type, rows)
      setCatalog(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog')
      setCatalog([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getOptions = useCallback(
    (field: string, priorFilters: Filters): string[] => {
      if (catalog.length === 0) return []
      return computeDistinctOptions(catalog, field, priorFilters)
    },
    [catalog],
  )

  const resolve = useCallback(
    (allFilters: Filters): CatalogRow | null => {
      if (catalog.length === 0) return null
      return resolveMatchingRow(catalog, allFilters)
    },
    [catalog],
  )

  return {
    catalog,
    isLoading,
    error,
    loadCatalog,
    getOptions,
    resolve,
    rowCount: catalog.length,
  }
}

/** Warm the in-memory valve catalog cache (e.g. from Manual Entry mount). */
export async function prefetchValveCatalogs(): Promise<void> {
  for (const vt of ['Butterfly Valve', 'Ball Valve'] as const) {
    try {
      const res = await configuratorApi.getFullCatalog<{
        valve_type: string
        count: number
        rows: CatalogRow[]
      }>(vt)
      valveCatalogCache.set(vt, res.rows ?? [])
    } catch {
      /* non-fatal — configurator will fetch on demand */
    }
  }
}

export function useMastersCatalog(category: string | null) {
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCatalog = useCallback(
    async (cat: string, force = false) => {
      if (!cat) return
      const key = `masters_${cat}`
      if (!force && mastersCatalogCache.has(key)) {
        setCatalog(mastersCatalogCache.get(key)!)
        setError(null)
        return
      }
      if (force) mastersCatalogCache.delete(key)
      setIsLoading(true)
      setError(null)
      try {
        const res = await configuratorApi.getFullCategoryCatalog<{
          category: string
          count: number
          rows: CatalogRow[]
        }>(cat)
        const rows = res.rows ?? []
        mastersCatalogCache.set(key, rows)
        setCatalog(rows)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load catalog')
        setCatalog([])
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const reloadCatalog = useCallback(async () => {
    if (!category) return
    await loadCatalog(category, true)
  }, [category, loadCatalog])

  const getOptions = useCallback(
    (field: string, priorFilters: Filters): string[] => {
      if (catalog.length === 0) return []
      return computeDistinctOptions(catalog, field, priorFilters)
    },
    [catalog],
  )

  const resolve = useCallback(
    (allFilters: Filters): CatalogRow | null => {
      if (catalog.length === 0) return null
      return resolveMatchingRow(catalog, allFilters)
    },
    [catalog],
  )

  return {
    catalog,
    isLoading,
    error,
    loadCatalog,
    reloadCatalog,
    getOptions,
    resolve,
    rowCount: catalog.length,
  }
}
