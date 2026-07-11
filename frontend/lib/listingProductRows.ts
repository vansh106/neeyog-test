import type { ListingCategoryLine, ListingItemDescriptionLine } from '@/types'

export type ListingProductRowPair = {
  category: ListingCategoryLine | null
  description: ListingItemDescriptionLine | null
}

/** Min height so category + sub-category aligns with the paired description row. */
export function listingProductRowMinHeightClass(category: ListingCategoryLine | null): string {
  if (category?.sub_category?.trim()) return 'min-h-[2.85rem]'
  return 'min-h-[1.4rem]'
}

export function normalizeCategoryLines(
  lines?: ListingCategoryLine[] | null,
  category?: string | null,
  subCategory?: string | null,
): ListingCategoryLine[] {
  if (lines && lines.length > 0) return lines
  if (category?.trim()) return [{ category: category.trim(), sub_category: subCategory ?? null }]
  return []
}

export function normalizeDescriptionLines(
  lines?: ListingItemDescriptionLine[] | null,
  fallbackShort?: string | null,
): ListingItemDescriptionLine[] {
  if (lines && lines.length > 0) return lines
  if (fallbackShort?.trim()) {
    const text = fallbackShort.trim()
    return [{ short: text, full: text }]
  }
  return []
}

/** Pair category and description rows by line-item index for aligned listing columns. */
export function pairListingProductRows(
  categoryLines?: ListingCategoryLine[] | null,
  descriptionLines?: ListingItemDescriptionLine[] | null,
  fallback?: { category?: string | null; subCategory?: string | null; descShort?: string | null },
): ListingProductRowPair[] {
  const categories = normalizeCategoryLines(
    categoryLines,
    fallback?.category,
    fallback?.subCategory,
  )
  const descriptions = normalizeDescriptionLines(descriptionLines, fallback?.descShort)
  const count = Math.max(categories.length, descriptions.length, 1)

  if (categories.length === 0 && descriptions.length === 0) {
    return [{ category: null, description: null }]
  }

  return Array.from({ length: count }, (_, index) => ({
    category: categories[index] ?? null,
    description: descriptions[index] ?? null,
  }))
}
