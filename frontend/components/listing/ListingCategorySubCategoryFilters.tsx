'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { subCategoryOptionsForSelectedCategory } from '@/lib/listingCategoryFilter'
import type { ListingCategoryFilterOptions } from '@/lib/listingCategoryFilter'

type Props = {
  category: string
  subCategory: string
  onCategoryChange: (category: string) => void
  onSubCategoryChange: (subCategory: string) => void
  options: ListingCategoryFilterOptions
  categoryAllValue?: string
  subCategoryAllValue?: string
  categoryAllLabel?: string
  subCategoryAllLabel?: string
  selectTriggerClassName?: string
  disabled?: boolean
  layout?: 'inline' | 'stacked' | 'compact'
  subCategoryLabel?: string
}

export function listingCategorySubCategorySelects({
  category,
  subCategory,
  onCategoryChange,
  onSubCategoryChange,
  options,
  categoryAllValue = '',
  subCategoryAllValue = '',
  categoryAllLabel = 'All',
  subCategoryAllLabel = 'All',
  selectTriggerClassName,
  disabled = false,
  layout = 'compact',
  subCategoryLabel = 'Sub-cat',
}: Props) {
  const categoryValue = category || categoryAllValue || 'ALL'
  const subCategoryValue = subCategory || subCategoryAllValue || 'ALL'
  const subOptions = subCategoryOptionsForSelectedCategory(
    category && category !== categoryAllValue && category !== 'ALL' ? category : '',
    options,
  )
  const subDisabled =
    disabled ||
    !category ||
    category === categoryAllValue ||
    category === 'ALL' ||
    subOptions.length === 0

  const categorySelect = (
    <Select
      value={categoryValue}
      onValueChange={(v) => {
        const next = v === categoryAllValue || v === 'ALL' ? categoryAllValue : v ?? categoryAllValue
        onCategoryChange(next)
      }}
      disabled={disabled}
    >
      <SelectTrigger className={selectTriggerClassName}>
        <SelectValue placeholder={categoryAllLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={categoryAllValue || 'ALL'}>{categoryAllLabel}</SelectItem>
        {options.categories.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const subCategorySelect = (
    <Select
      value={subCategoryValue}
      onValueChange={(v) =>
        onSubCategoryChange(
          v === subCategoryAllValue || v === 'ALL' ? subCategoryAllValue : v ?? subCategoryAllValue,
        )
      }
      disabled={subDisabled}
    >
      <SelectTrigger className={selectTriggerClassName}>
        <SelectValue placeholder={subCategoryAllLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={subCategoryAllValue || 'ALL'}>{subCategoryAllLabel}</SelectItem>
        {subOptions.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (layout === 'stacked') {
    return (
      <div className="space-y-1">
        {categorySelect}
        <div className="flex min-w-0 items-center gap-1">
          <span className="shrink-0 whitespace-nowrap text-[10px] leading-none text-gray-700">
            {subCategoryLabel}
          </span>
          <div className="min-w-0 flex-1">{subCategorySelect}</div>
        </div>
      </div>
    )
  }

  if (layout === 'inline') {
    return (
      <>
        {categorySelect}
        {subCategorySelect}
      </>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="min-w-0 flex-[1.1]">{categorySelect}</div>
      <span className="shrink-0 whitespace-nowrap text-[10px] leading-none text-gray-700">
        {subCategoryLabel} :
      </span>
      <div className={cn('min-w-0 flex-[1.2]', subDisabled && 'opacity-70')}>{subCategorySelect}</div>
    </div>
  )
}
