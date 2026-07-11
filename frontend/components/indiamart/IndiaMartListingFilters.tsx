'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CompactListingSearch from '@/components/listing/CompactListingSearch'
import {
  ListingFilterActions,
  ListingFilterCell,
  ListingFilterGrid,
  ListingFilterShell,
  listingFilterInputClass,
  listingFilterSelectTriggerClass,
} from '@/components/listing/ListingFilterPrimitives'
import type { LocalIndiaMartFilters } from '@/lib/filterIndiaMartLocal'

type Props = {
  filters: LocalIndiaMartFilters
  onChange: (next: LocalIndiaMartFilters) => void
  queryTypeOptions: string[]
  showArchived: boolean
  onShowArchivedChange: (v: boolean) => void
  onClear: () => void
  hasActiveFilters: boolean
}

const PICKUP_OPTIONS = [
  { value: '', label: 'All pickup' },
  { value: 'bucket', label: 'In bucket' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'archived', label: 'Archived' },
] as const

export default function IndiaMartListingFilters({
  filters,
  onChange,
  queryTypeOptions,
  showArchived,
  onShowArchivedChange,
  onClear,
  hasActiveFilters,
}: Props) {
  const set = (partial: Partial<LocalIndiaMartFilters>) => onChange({ ...filters, ...partial })

  return (
    <ListingFilterShell>
      <ListingFilterGrid>
        <ListingFilterCell label="Search :" stacked className="col-span-2">
          <CompactListingSearch
            value={filters.search}
            onChange={(search) => set({ search })}
            placeholder="Buyer, product…"
            aria-label="Search IndiaMart leads"
          />
        </ListingFilterCell>

        <ListingFilterCell label="Type :" stacked>
          <Select
            value={filters.queryType || 'ALL'}
            onValueChange={(v) => set({ queryType: v === 'ALL' ? '' : v ?? '' })}
          >
            <SelectTrigger className={listingFilterSelectTriggerClass}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {queryTypeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ListingFilterCell>

        <ListingFilterCell label="Pickup :" stacked>
          <Select
            value={filters.pickup || 'ALL'}
            onValueChange={(v) =>
              set({ pickup: (v === 'ALL' ? '' : v) as LocalIndiaMartFilters['pickup'] })
            }
          >
            <SelectTrigger className={listingFilterSelectTriggerClass}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {PICKUP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || 'ALL'} value={opt.value || 'ALL'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ListingFilterCell>

        <ListingFilterCell label="From :" stacked>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className={listingFilterInputClass}
          />
        </ListingFilterCell>

        <ListingFilterCell label="To :" stacked>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            className={listingFilterInputClass}
          />
        </ListingFilterCell>

        <div className="flex min-h-[52px] items-end rounded-md border border-[#E2E6DC] bg-white px-3 py-2.5 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[11px] text-gray-700">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onShowArchivedChange(e.target.checked)}
              className="size-3.5 rounded border-gray-300 text-brand-green-600 focus:ring-brand-green-500/30"
            />
            Load archived
          </label>
        </div>
      </ListingFilterGrid>

      {hasActiveFilters ? (
        <ListingFilterActions>
          <Button type="button" variant="ghost" className="h-7 px-3 text-[11px]" onClick={onClear}>
            Clear filters
          </Button>
        </ListingFilterActions>
      ) : null}
    </ListingFilterShell>
  )
}
