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
import AmountRangeFilter from '@/components/listing/AmountRangeFilter'
import CompactListingSearch from '@/components/listing/CompactListingSearch'
import {
  ListingFilterActions,
  ListingFilterCell,
  ListingFilterGrid,
  ListingFilterShell,
  listingFilterInputClass,
  listingFilterSelectTriggerClass,
} from '@/components/listing/ListingFilterPrimitives'
import type { LocalPurchaseOrderFilters } from '@/lib/filterPurchaseOrdersLocal'

type Props = {
  filters: LocalPurchaseOrderFilters
  onChange: (next: LocalPurchaseOrderFilters) => void
  categoryOptions: string[]
  userOptions: string[]
  onClear: () => void
  hasActiveFilters: boolean
}

export default function PurchaseOrderListingFilters({
  filters,
  onChange,
  categoryOptions,
  userOptions,
  onClear,
  hasActiveFilters,
}: Props) {
  const set = (partial: Partial<LocalPurchaseOrderFilters>) => onChange({ ...filters, ...partial })

  return (
    <ListingFilterShell>
      <ListingFilterGrid wide>
        <ListingFilterCell label="Search :" stacked className="col-span-2 sm:col-span-2 lg:col-span-2">
          <CompactListingSearch
            value={filters.search}
            onChange={(search) => set({ search })}
            placeholder="PO, client, quote…"
            aria-label="Search purchase orders"
          />
        </ListingFilterCell>

        <ListingFilterCell label="Client :" stacked>
          <Input
            value={filters.clientName}
            onChange={(e) => set({ clientName: e.target.value })}
            placeholder="Name…"
            className={listingFilterInputClass}
          />
        </ListingFilterCell>

        <ListingFilterCell label="Type :" stacked>
          <Select
            value={filters.type || 'ALL'}
            onValueChange={(v) => set({ type: v === 'ALL' ? '' : v ?? '' })}
          >
            <SelectTrigger className={listingFilterSelectTriggerClass}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="non_quoted">Non-quoted</SelectItem>
            </SelectContent>
          </Select>
        </ListingFilterCell>

        <ListingFilterCell label="Category :" stacked>
          <Select
            value={filters.category || 'ALL'}
            onValueChange={(v) => set({ category: v === 'ALL' ? '' : v ?? '' })}
          >
            <SelectTrigger className={listingFilterSelectTriggerClass}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ListingFilterCell>

        <ListingFilterCell label="User :" stacked>
          <Select
            value={filters.user || 'ALL'}
            onValueChange={(v) => set({ user: v === 'ALL' ? '' : v ?? '' })}
          >
            <SelectTrigger className={listingFilterSelectTriggerClass}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {userOptions.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
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

        <AmountRangeFilter
          label="PO ₹"
          min={filters.boundsMin}
          max={filters.boundsMax}
          valueMin={filters.amountMin}
          valueMax={filters.amountMax}
          onChange={(amountMin, amountMax) => set({ amountMin, amountMax })}
          className="col-span-2 sm:col-span-2 lg:col-span-2 xl:col-span-2"
        />
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
