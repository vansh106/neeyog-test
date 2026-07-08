import type { PurchaseOrderListItem, QuotationListItem } from '@/types'
import {
  buildListingSubCategoriesByCategory,
  listingMainCategoryOptions,
  listingSubCategoryOptionsForCategory,
  normalizeListingMainCategory,
  resolveListingCategoryPair,
} from '@/lib/listingCategoryCatalog'

export type ListingCategoryFilterOptions = {
  categories: string[]
  subCategoriesByCategory: Record<string, string[]>
}

function isAllFilterValue(value: string): boolean {
  return !value.trim() || value === 'ALL'
}

function rowPairsFromQuotation(row: QuotationListItem) {
  if (row.category_lines && row.category_lines.length > 0) {
    return row.category_lines.map((line) => ({
      category: line.category,
      subCategory: line.sub_category,
    }))
  }
  return [
    {
      category: row.category_label || row.primary_category,
      subCategory: row.sub_category,
    },
  ]
}

function rowMatchesCategoryFilters(
  pairs: Array<{ category: string | null | undefined; subCategory: string | null | undefined }>,
  category: string,
  subCategory: string,
): boolean {
  const catFilter = (category || '').trim()
  const subFilter = (subCategory || '').trim()
  if (isAllFilterValue(catFilter) && isAllFilterValue(subFilter)) return true

  const resolved = pairs.map((p) => resolveListingCategoryPair(p.category, p.subCategory))

  if (!isAllFilterValue(subFilter)) {
    const mainFilter = isAllFilterValue(catFilter)
      ? null
      : normalizeListingMainCategory(catFilter)
    return resolved.some((p) => {
      if (p.sub !== subFilter) return false
      if (mainFilter && p.main !== mainFilter) return false
      return true
    })
  }

  const mainFilter = normalizeListingMainCategory(catFilter)
  if (!mainFilter) return false
  return resolved.some((p) => p.main === mainFilter)
}

function rowPairsFromPurchaseOrder(row: PurchaseOrderListItem) {
  if (row.category_lines && row.category_lines.length > 0) {
    return row.category_lines.map((line) => ({
      category: line.category,
      subCategory: line.sub_category,
    }))
  }
  return [
    {
      category: row.category_label || row.primary_category,
      subCategory: row.sub_category,
    },
  ]
}

export function collectQuotationCategoryFilterOptions(
  rows: QuotationListItem[],
): ListingCategoryFilterOptions {
  const pairs = rows.flatMap(rowPairsFromQuotation)
  const subCategoriesByCategory = buildListingSubCategoriesByCategory(pairs)
  return {
    categories: listingMainCategoryOptions(subCategoriesByCategory),
    subCategoriesByCategory,
  }
}

export function collectPurchaseOrderCategoryFilterOptions(
  rows: PurchaseOrderListItem[],
): ListingCategoryFilterOptions {
  const pairs = rows.flatMap(rowPairsFromPurchaseOrder)
  const subCategoriesByCategory = buildListingSubCategoriesByCategory(pairs)
  return {
    categories: listingMainCategoryOptions(subCategoriesByCategory),
    subCategoriesByCategory,
  }
}

export function quotationMatchesCategoryFilters(
  row: QuotationListItem,
  category: string,
  subCategory: string,
): boolean {
  return rowMatchesCategoryFilters(rowPairsFromQuotation(row), category, subCategory)
}

export function purchaseOrderMatchesCategoryFilters(
  row: PurchaseOrderListItem,
  category: string,
  subCategory: string,
): boolean {
  return rowMatchesCategoryFilters(rowPairsFromPurchaseOrder(row), category, subCategory)
}

export function subCategoryOptionsForSelectedCategory(
  category: string,
  options: ListingCategoryFilterOptions,
): string[] {
  return listingSubCategoryOptionsForCategory(category, options.subCategoriesByCategory)
}
