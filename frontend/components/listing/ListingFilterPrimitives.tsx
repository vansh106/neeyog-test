'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const listingFilterInputClass =
  'h-7 w-full min-w-0 border-[#C5C9C0] bg-white px-2 py-0 text-[11px] leading-tight disabled:cursor-not-allowed disabled:opacity-50'

export const listingFilterSelectTriggerClass =
  'h-7 w-full min-w-0 border-[#C5C9C0] bg-white px-2 text-[11px] leading-tight'

export function ListingFilterCell({
  label,
  children,
  className,
  alignEnd,
  stacked,
}: {
  label: string
  children: ReactNode
  className?: string
  alignEnd?: boolean
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-1', className)}>
        {label.trim() ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
            {label.replace(/\s*:\s*$/, '')}
          </span>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
    )
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', alignEnd && 'justify-end', className)}>
      {label.trim() ? (
        <span className="shrink-0 whitespace-nowrap text-[11px] leading-none text-gray-700">{label}</span>
      ) : null}
      <div className={cn('min-w-0', label.trim() ? 'flex-1' : 'w-full')}>{children}</div>
    </div>
  )
}

export function ListingFilterShell({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-[#C5C9C0] bg-[#FAFBF8] p-3 shadow-sm text-[11px] md:p-4">
      {children}
    </div>
  )
}

export function ListingFilterGrid({
  children,
  className,
  wide = false,
}: {
  children: ReactNode
  className?: string
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        wide
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ListingFilterActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#E2E6DC] pt-3', className)}>
      {children}
    </div>
  )
}
