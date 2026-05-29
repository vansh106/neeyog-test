import type { SupplierResponse } from '@/types'

/** True when supplier is assigned to this masters catalog table (empty assignment = all). */
export function supplierServesCatalogCategory(
  supplier: SupplierResponse,
  catalogCategoryKey: string | null | undefined,
): boolean {
  const key = catalogCategoryKey?.trim()
  if (!key) return true
  const keys = supplier.category_keys ?? []
  if (keys.length === 0) return true
  return keys.includes(key)
}

/** Active suppliers for a catalog sheet; always keeps ``selectedSupplierId`` if set. */
export function suppliersForCatalogCategory(
  suppliers: SupplierResponse[],
  catalogCategoryKey: string | null | undefined,
  selectedSupplierId?: string | null,
): SupplierResponse[] {
  return suppliers.filter((s) => {
    if (!s.is_active) return false
    if (selectedSupplierId && s.id === selectedSupplierId) return true
    return supplierServesCatalogCategory(s, catalogCategoryKey)
  })
}
