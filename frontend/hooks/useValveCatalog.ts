'use client'

import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import { configuratorApi } from '@/lib/api'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Network / disconnect / timeouts — retry full-category-catalog fetch. */
function isTransientCatalogFetchError(err: unknown): boolean {
  if (axios.isCancel?.(err)) return true
  if (!err || typeof err !== 'object') {
    const s = String(err || '').toLowerCase()
    return s.includes('timeout') || s.includes('cancel')
  }
  const o = err as { name?: string; code?: string; message?: string }
  const name = String(o.name || '')
  const code = String(o.code || '')
  if (name === 'CanceledError' || name === 'AbortError') return true
  if (code === 'ERR_CANCELED' || code === 'ECONNABORTED') return true
  const msg = String(o.message || '').toLowerCase()
  if (msg.includes('cancel') || msg.includes('aborted')) return true
  if (msg.includes('timeout') || msg.includes('network')) return true
  if (msg.includes('502') || msg.includes('503') || msg.includes('504') || /\b5\d\d\b/.test(msg)) {
    return true
  }
  return false
}

async function getFullCategoryCatalogReliable(cat: string): Promise<{
  category: string
  count: number
  rows: CatalogRow[]
}> {
  const maxAttempts = 4
  const backoffMs = [0, 400, 1200, 2800]
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (backoffMs[attempt] > 0) await sleep(backoffMs[attempt])
    try {
      const res = await configuratorApi.getFullCategoryCatalog<{
        category: string
        count: number
        rows: CatalogRow[]
      }>(cat)
      return res
    } catch (e) {
      lastErr = e
      const retry = isTransientCatalogFetchError(e)
      if (!retry || attempt === maxAttempts - 1) throw e
    }
  }
  throw lastErr
}

/** Session cache: catalog API key (e.g. ``butterfly_valve``) → rows */
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

export function useValveCatalog(categoryKey: string | null) {
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCatalog = useCallback(async (cat: string, force = false) => {
    if (!cat) return
    if (!force && valveCatalogCache.has(cat)) {
      setCatalog(valveCatalogCache.get(cat)!)
      setError(null)
      return
    }
    if (force) valveCatalogCache.delete(cat)
    setIsLoading(true)
    setError(null)
    try {
      const res = await getFullCategoryCatalogReliable(cat)
      const rows = (res.rows ?? []).map((r) => ({
        ...r,
        id: r.id ?? (r.row_id != null ? String(r.row_id) : ''),
      }))
      valveCatalogCache.set(cat, rows)
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

/** Warm one category (e.g. matcher seed on enquiry completion) — avoids loading every sheet at once. */
export async function warmupValveCatalogCategory(category: string | null | undefined): Promise<void> {
  const cat = (category || '').trim()
  if (!cat || valveCatalogCache.has(cat)) return
  try {
    const res = await getFullCategoryCatalogReliable(cat)
    const rows = (res.rows ?? []).map((r) => ({
      ...r,
      id: r.id ?? (r.row_id != null ? String(r.row_id) : ''),
    }))
    valveCatalogCache.set(cat, rows)
  } catch {
    /* on-demand fetch in ValveConfigurator will retry */
  }
}

/**
 * Populate cache when a seeded category is known (enquiry matcher / prefilled valve).
 * Sequential prefetch of **all** categories was removed — it overloaded DB (especially with
 * NullPool TLS handshakes per request) and caused CancelledError on large sheets.
 */
export function useWarmupMatcherCatalog(categoryKey: string | null | undefined): void {
  useEffect(() => {
    void warmupValveCatalogCategory(categoryKey)
  }, [categoryKey])
}

/** Deprecated: sequential fetch of every valve type hammered Postgres. Prefer ``warmupValveCatalogCategory``. */
export async function prefetchValveCatalogs(): Promise<void> {
  try {
    const cats = await configuratorApi.getValveTypes<{ key: string; label: string }[]>()
    for (const c of cats || []) {
      if (!c?.key) continue
      if (valveCatalogCache.has(c.key)) continue
      try {
        const res = await getFullCategoryCatalogReliable(c.key)
        const rows = (res.rows ?? []).map((r) => ({
          ...r,
          id: r.id ?? (r.row_id != null ? String(r.row_id) : ''),
        }))
        valveCatalogCache.set(c.key, rows)
      } catch {
        /* skip category */
      }
    }
  } catch {
    /* non-fatal — configurator will fetch on demand */
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
        const res = await getFullCategoryCatalogReliable(cat)
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
