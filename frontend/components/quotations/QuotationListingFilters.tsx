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
import { listingCategorySubCategorySelects } from '@/components/listing/ListingCategorySubCategoryFilters'
import type { ListingCategoryFilterOptions } from '@/lib/listingCategoryFilter'
import { ARCHIVE_FILTER_OPTIONS } from '@/lib/archiveFilter'
import type { LocalQuotationFilters } from '@/lib/filterQuotationsLocal'
import {
  QUOTATION_CRM_LABELS,
  QUOTATION_CRM_STATUSES,
  type QuotationCrmStatus,
} from '@/lib/quotationCrmStatus'

type Props = {
  filters: LocalQuotationFilters
  onChange: (next: LocalQuotationFilters | ((prev: LocalQuotationFilters) => LocalQuotationFilters)) => void
  categoryOptions: string[]
  subCategoriesByCategory: Record<string, string[]>
  userOptions: string[]
  onClear: () => void
  hasActiveFilters: boolean
}

const FOLLOW_UP_OPTIONS = [
  { value: '', label: 'All follow-ups' },
  { value: 'upcoming', label: 'Upcoming (soonest first)' },
  { value: 'expired', label: 'Expired' },
] as const

export default function QuotationListingFilters({
  filters,
  onChange,
  categoryOptions,
  subCategoriesByCategory,
  userOptions,
  onClear,
  hasActiveFilters,
}: Props) {
  const set = (partial: Partial<LocalQuotationFilters>) =>
    onChange((prev) => ({ ...prev, ...partial }))
  const categoryFilterOptions: ListingCategoryFilterOptions = {
    categories: categoryOptions,
    subCategoriesByCategory,
  }

  return (
    <ListingFilterShell>
      <ListingFilterGrid wide>
        <ListingFilterCell label="Search :" stacked className="col-span-2 sm:col-span-2 lg:col-span-2">
          <CompactListingSearch
            value={filters.search}
            onChange={(search) => set({ search })}
            placeholder="Quote, enq, client…"
            aria-label="Search quotations"
          />
        </ListingFilterCell>

        <ListingFilterCell label="Client :" stacked className="lg:col-span-1">
          <Input
            value={filters.clientName}
            onChange={(e) => set({ clientName: e.target.value })}
            placeholder="Name…"
            className={listingFilterInputClass}
          />
        </ListingFilterCell>

        <ListingFilterCell label="Category :" stacked className="col-span-2 sm:col-span-2 lg:col-span-2">
          {listingCategorySubCategorySelects({
            category: filters.category,
            subCategory: filters.subCategory,
            onCategoryChange: (category) => set({ category, subCategory: '' }),
            onSubCategoryChange: (subCategory) => set({ subCategory }),
            options: categoryFilterOptions,
            selectTriggerClassName: listingFilterSelectTriggerClass,
            layout: 'compact',
            subCategoryLabel: 'Sub-cat',
          })}
        </ListingFilterCell>

        <ListingFilterCell label="Status :" stacked className="lg:col-span-1">
          <Select
            value={filters.status || 'ALL'}
            onValueChange={(v) => set({ status: v === 'ALL' ? '' : v ?? '' })}
          >
            <SelectTrigger className={listingFilterSelectTriggerClass}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {QUOTATION_CRM_STATUSES.map((v) => (
                <SelectItem key={v} value={v}>
                  {QUOTATION_CRM_LABELS[v as QuotationCrmStatus]}
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

        <ListingFilterCell label="Records :" stacked>
          <Select
            value={filters.archive}
            onValueChange={(v) => set({ archive: (v ?? 'active') as LocalQuotationFilters['archive'] })}
          >
            <SelectTrigger className={listingFilterSelectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARCHIVE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ListingFilterCell>

        <ListingFilterCell label="Follow-up :" stacked>
          <Select
            value={filters.followUp || 'ALL'}
            onValueChange={(v) =>
              set({ followUp: (v === 'ALL' ? '' : v) as LocalQuotationFilters['followUp'] })
            }
          >
            <SelectTrigger className={listingFilterSelectTriggerClass}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {FOLLOW_UP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || 'ALL'} value={opt.value || 'ALL'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ListingFilterCell>

        <AmountRangeFilter
          label="PO ₹"
          min={filters.poBoundsMin}
          max={filters.poBoundsMax}
          valueMin={filters.poAmountMin}
          valueMax={filters.poAmountMax}
          onChange={(poAmountMin, poAmountMax) => set({ poAmountMin, poAmountMax })}
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
