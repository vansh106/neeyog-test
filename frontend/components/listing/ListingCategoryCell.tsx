'use client'

import { cn } from '@/lib/utils'
import type { ListingCategoryLine } from '@/types'

type Props = {
  lines?: ListingCategoryLine[] | null
  category?: string | null
  subCategory?: string | null
  className?: string
}

export default function ListingCategoryCell({
  lines,
  category,
  subCategory,
  className,
}: Props) {
  const rows =
    lines && lines.length > 0
      ? lines
      : category
        ? [{ category, sub_category: subCategory ?? null }]
        : []

  if (rows.length === 0) {
    return <span className={cn('text-[12px] text-surface-muted', className)}>—</span>
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {rows.map((row, idx) => (
        <li key={`${idx}-${row.category}`}>
          <p className="font-medium text-gray-900">{row.category}</p>
          {row.sub_category ? (
            <p className="mt-0.5 text-[12px] text-surface-muted">{row.sub_category}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
