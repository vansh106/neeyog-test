'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  listingProductRowMinHeightClass,
  pairListingProductRows,
} from '@/lib/listingProductRows'
import { sanitizeQuotationDescription } from '@/lib/quotationLineDisplay'
import { cn } from '@/lib/utils'
import type { ListingItemDescriptionLine } from '@/types'

export type { ListingItemDescriptionLine }

type Props = {
  lines?: ListingItemDescriptionLine[] | null
  /** Legacy single-line fallback when API has not returned item_desc_lines yet. */
  fallbackShort?: string | null
  /** Category rows from the same quotation — used to match row heights in the adjacent column. */
  categoryLines?: import('@/types').ListingCategoryLine[] | null
  category?: string | null
  subCategory?: string | null
  className?: string
}

function ItemDescriptionInfoTooltip({ full }: { full: string }) {
  const text = sanitizeQuotationDescription(full)

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded text-[#8A9488] hover:bg-[#ECEEE8] hover:text-gray-900"
        aria-label="View full item description"
      >
        <Info className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent
        side="left"
        align="start"
        sideOffset={8}
        className="max-h-[min(70vh,420px)] w-[min(92vw,380px)] max-w-none overflow-y-auto whitespace-pre-line border border-[#E2E6DC] bg-white px-3 py-2.5 text-left text-[12px] leading-relaxed font-normal text-gray-900 shadow-lg **:data-[slot=tooltip-arrow]:hidden"
      >
        {text || '—'}
      </TooltipContent>
    </Tooltip>
  )
}

export default function ListingItemDescriptionsCell({
  lines,
  fallbackShort,
  categoryLines,
  category,
  subCategory,
  className,
}: Props) {
  const pairs = pairListingProductRows(categoryLines, lines, {
    category,
    subCategory,
    descShort: fallbackShort,
  })
  const hasContent = pairs.some((pair) => pair.description)

  if (!hasContent) {
    return <span className={cn('text-[12px] text-surface-muted', className)}>—</span>
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {pairs.map((pair, idx) => {
        const rowClass = listingProductRowMinHeightClass(pair.category)
        if (!pair.description) {
          return (
            <li key={`empty-desc-${idx}`} className={cn(rowClass, 'text-[12px] text-surface-muted')}>
              —
            </li>
          )
        }
        return (
          <li key={`${idx}-${pair.description.short.slice(0, 24)}`} className={cn(rowClass, 'flex min-w-0 items-start gap-1')}>
            <span
              className="min-w-0 flex-1 truncate text-[12px] text-surface-muted"
              title={pair.description.short}
            >
              {pair.description.short}
            </span>
            {pair.description.full.trim() ? (
              <ItemDescriptionInfoTooltip full={pair.description.full} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
