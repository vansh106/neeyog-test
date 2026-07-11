'use client'

import {
  listingProductRowMinHeightClass,
  pairListingProductRows,
} from '@/lib/listingProductRows'
import { cn } from '@/lib/utils'
import type { ListingCategoryLine, ListingItemDescriptionLine } from '@/types'

type Props = {
  lines?: ListingCategoryLine[] | null
  category?: string | null
  subCategory?: string | null
  descriptionLines?: ListingItemDescriptionLine[] | null
  fallbackDescShort?: string | null
  className?: string
}

export default function ListingCategoryCell({
  lines,
  category,
  subCategory,
  descriptionLines,
  fallbackDescShort,
  className,
}: Props) {
  const pairs = pairListingProductRows(lines, descriptionLines, {
    category,
    subCategory,
    descShort: fallbackDescShort,
  })
  const hasContent = pairs.some((pair) => pair.category)

  if (!hasContent) {
    return <span className={cn('text-[12px] text-surface-muted', className)}>—</span>
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {pairs.map((pair, idx) => {
        if (!pair.category) {
          return (
            <li
              key={`empty-cat-${idx}`}
              className={cn(listingProductRowMinHeightClass(null), 'text-[12px] text-surface-muted')}
            >
              —
            </li>
          )
        }
        return (
          <li
            key={`${idx}-${pair.category.category}-${pair.category.sub_category ?? ''}`}
            className={listingProductRowMinHeightClass(pair.category)}
          >
            <p className="font-medium text-gray-900">{pair.category.category}</p>
            {pair.category.sub_category ? (
              <p className="mt-0.5 text-[12px] text-surface-muted">{pair.category.sub_category}</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
