'use client'

import { Input } from '@/components/ui/input'
import { BUILT_IN_LOST_REASONS, type LostRemarksDraft } from '@/lib/quotationLostRemarks'
import { cn } from '@/lib/utils'

type Props = {
  value: LostRemarksDraft
  onChange: (next: LostRemarksDraft) => void
  disabled?: boolean
  className?: string
}

const selectClass =
  'h-8 w-full rounded-md border border-[#E2E6DC] bg-white px-2 text-[12px] text-gray-900 disabled:opacity-50'

export default function QuotationLostRemarksFields({ value, onChange, disabled, className }: Props) {
  const update = (patch: Partial<LostRemarksDraft>) => {
    onChange({ ...value, ...patch })
  }

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-[11px]">
        <span className="font-medium text-[#8A9488]">Lost reason</span>
        <select
          className={cn(selectClass, 'mt-1')}
          value={value.reason1}
          disabled={disabled}
          onChange={(e) => update({ reason1: e.target.value })}
        >
          <option value="">Select reason…</option>
          {BUILT_IN_LOST_REASONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[11px]">
        <span className="font-medium text-[#8A9488]">
          Remarks <span className="text-red-600">*</span>
        </span>
        <Input
          value={value.other1}
          disabled={disabled}
          onChange={(e) => update({ other1: e.target.value })}
          placeholder="Required — add context or details"
          className="mt-1 h-8 border-[#E2E6DC] text-[12px]"
        />
      </label>
    </div>
  )
}
