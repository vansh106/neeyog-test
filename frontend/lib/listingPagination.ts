export const LISTING_PAGE_SIZE = 100

export function listingTotalPages(totalItems: number, pageSize = LISTING_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize))
}

export function listingPageSlice<T>(items: T[], page: number, pageSize = LISTING_PAGE_SIZE): T[] {
  const totalPages = listingTotalPages(items.length, pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function listingSerialNumber(
  page: number,
  indexInPage: number,
  pageSize = LISTING_PAGE_SIZE,
  totalItems?: number,
): number {
  const safePage =
    totalItems != null
      ? Math.min(Math.max(1, page), listingTotalPages(totalItems, pageSize))
      : Math.max(1, page)
  return (safePage - 1) * pageSize + indexInPage + 1
}

export function listingPageRange(
  page: number,
  totalItems: number,
  pageSize = LISTING_PAGE_SIZE,
): { from: number; to: number } {
  if (totalItems <= 0) return { from: 0, to: 0 }
  const from = (Math.max(1, page) - 1) * pageSize + 1
  const to = Math.min(totalItems, from + pageSize - 1)
  return { from, to }
}
