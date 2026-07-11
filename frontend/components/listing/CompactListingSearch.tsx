'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { listingFilterInputClass } from '@/components/listing/ListingFilterPrimitives'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  'aria-label'?: string
  className?: string
}

export default function CompactListingSearch({
  value,
  onChange,
  placeholder = 'Search…',
  'aria-label': ariaLabel = 'Search',
  className,
}: Props) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-surface-muted" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(listingFilterInputClass, 'pl-7 pr-2')}
      />
    </div>
  )
}
