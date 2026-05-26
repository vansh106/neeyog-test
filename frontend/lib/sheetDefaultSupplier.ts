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

export type { MasterSheetDefaultSupplier }
