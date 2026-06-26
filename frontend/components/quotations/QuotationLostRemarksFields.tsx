'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import {
  getLostReasonSelectOptions,
  LOST_REASON_OTHER,
  rememberCustomLostReason,
  type LostRemarksDraft,
} from '@/lib/quotationLostRemarks'
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
  const [, setOptionsTick] = useState(0)
  const options = getLostReasonSelectOptions()

  const refreshCustomOptions = (text: string) => {
    if (!text.trim()) return
    rememberCustomLostReason(text)
    setOptionsTick((n) => n + 1)
  }

  const update = (patch: Partial<LostRemarksDraft>) => {
    onChange({ ...value, ...patch })
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-[11px] font-medium text-[#8A9488]">Lost reason</label>
      <select
        className={selectClass}
        value={value.reason1}
        disabled={disabled}
        onChange={(e) =>
          update({ reason1: e.target.value, other1: e.target.value === LOST_REASON_OTHER ? value.other1 : '' })
        }
      >
        <option value="">Select reason…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value={LOST_REASON_OTHER}>{LOST_REASON_OTHER}</option>
      </select>
      {value.reason1 === LOST_REASON_OTHER && (
        <Input
          value={value.other1}
          disabled={disabled}
          onChange={(e) => update({ other1: e.target.value })}
          onBlur={() => refreshCustomOptions(value.other1)}
          placeholder="Describe reason (added to list)"
          className="h-8 border-[#E2E6DC] text-[12px]"
        />
      )}
    </div>
  )
}
