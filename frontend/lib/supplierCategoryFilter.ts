import type { SupplierResponse } from '@/types'

/** True when supplier is assigned to this masters catalog sheet (empty assignment = all). */
export function supplierServesCatalogCategory(
  supplier: SupplierResponse,
  catalogCategoryKey: string | null | undefined,
  navSlug?: string | null,
): boolean {
  const key = catalogCategoryKey?.trim()
  if (!key) return true
  const keys = supplier.category_keys ?? []
  if (keys.length === 0) return true
  const composite = navSlug?.trim() ? `${key}#${navSlug.trim()}` : null
  for (const assigned of keys) {
    if (assigned === key) return true
    if (composite && assigned === composite) return true
  }
  return false
}

/** Active suppliers for a catalog sheet; always keeps ``selectedSupplierId`` if set. */
export function suppliersForCatalogCategory(
  suppliers: SupplierResponse[],
  catalogCategoryKey: string | null | undefined,
  selectedSupplierId?: string | null,
  navSlug?: string | null,
): SupplierResponse[] {
  return suppliers.filter((s) => {
    if (!s.is_active) return false
    if (selectedSupplierId && s.id === selectedSupplierId) return true
    return supplierServesCatalogCategory(s, catalogCategoryKey, navSlug)
  })
}
