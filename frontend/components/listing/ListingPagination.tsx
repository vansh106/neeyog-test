'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  LISTING_PAGE_SIZE,
  listingPageRange,
  listingTotalPages,
} from '@/lib/listingPagination'
import { cn } from '@/lib/utils'

type Props = {
  page: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
  className?: string
}

export default function ListingPagination({
  page,
  totalItems,
  pageSize = LISTING_PAGE_SIZE,
  onPageChange,
  className,
}: Props) {
  const totalPages = listingTotalPages(totalItems, pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const { from, to } = listingPageRange(safePage, totalItems, pageSize)

  if (totalItems <= 0) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E6DC] bg-[#F9FAF7] px-4 py-3',
        className,
      )}
    >
      <p className="text-[13px] text-surface-muted tabular-nums">
        Showing {from}–{to} of {totalItems}
        {totalPages > 1 ? (
          <span className="text-[#B0B8AD]"> · {pageSize} per page</span>
        ) : null}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2 text-[12px]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="tabular-nums text-surface-muted">
            Page {safePage} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
