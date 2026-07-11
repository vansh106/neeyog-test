import { mastersApi } from '@/lib/api'
import type { MasterSheetDefaultSupplier, SupplierResponse } from '@/types'

/** Resolve default supplier id for a masters sheet (nav-specific, then sheet-wide). */
export async function fetchSheetDefaultSupplierId(
  catalogTable: string,
  navSlug?: string | null,
): Promise<string | null> {
  const res = await mastersApi.getSheetDefaultSupplier(catalogTable, navSlug ?? undefined)
  const id = res.default?.supplier_id?.trim()
  return id || null
}

export function pickActiveSupplierId(
  suppliers: SupplierResponse[],
  supplierId: string | null | undefined,
): string | null {
  const active = suppliers.filter((s) => s.is_active)
  if (!active.length) return null
  if (supplierId && active.some((s) => s.id === supplierId)) return supplierId
  const pref = active.find((s) => s.is_preferred)
  return pref?.id ?? active[0].id
}

export async function resolveSupplierForSheet(
  catalogTable: string,
  navSlug: string | null | undefined,
  suppliers: SupplierResponse[],
): Promise<string | null> {
  const sheetDefaultId = await fetchSheetDefaultSupplierId(catalogTable, navSlug)
  return pickActiveSupplierId(suppliers, sheetDefaultId)
}

/** Nav-specific default, then sheet-wide (nav_slug empty) — mirrors backend lookup. */
export function lookupSheetDefaultSupplierId(
  items: MasterSheetDefaultSupplier[],
  catalogTable: string,
  navSlug?: string | null,
): string | null {
  const table = catalogTable.trim()
  if (!table) return null
  const slug = (navSlug ?? '').trim()
  const exact = items.find(
    (row) => row.catalog_table === table && (row.nav_slug ?? '').trim() === slug,
  )
  if (exact?.supplier_id?.trim()) return exact.supplier_id.trim()
  if (slug) {
    const sheetWide = items.find(
      (row) => row.catalog_table === table && !(row.nav_slug ?? '').trim(),
    )
    if (sheetWide?.supplier_id?.trim()) return sheetWide.supplier_id.trim()
  }
  return null
}

export function resolveSupplierFromSheetDefaults(
  items: MasterSheetDefaultSupplier[],
  catalogTable: string,
  navSlug: string | null | undefined,
  suppliers: SupplierResponse[],
): string | null {
  const sheetDefaultId = lookupSheetDefaultSupplierId(items, catalogTable, navSlug)
  return pickActiveSupplierId(suppliers, sheetDefaultId)
}

export type { MasterSheetDefaultSupplier }
