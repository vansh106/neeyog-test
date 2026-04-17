'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CheckedState = boolean | 'indeterminate'

export function Checkbox({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> & {
  checked?: CheckedState
  onCheckedChange?: (checked: boolean) => void
}) {
  const isIndeterminate = checked === 'indeterminate'
  const isChecked = checked === true

  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border border-[#E2E6DC] text-brand-green-600 focus:ring-2 focus:ring-brand-green-200',
        className,
      )}
      checked={isChecked}
      ref={(el) => {
        if (el) el.indeterminate = isIndeterminate
      }}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  )
}

