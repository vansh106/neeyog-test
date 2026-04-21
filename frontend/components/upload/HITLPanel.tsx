'use client'

import { Clock } from 'lucide-react'

export function HITLPanel() {
  return (
    <div className="rounded-xl border border-brand-gold-200 bg-brand-gold-50 p-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-brand-gold-500" />
        <span className="text-[13px] font-medium text-brand-gold-700">
          Review & Approval
        </span>
        <span className="ml-auto rounded-full bg-brand-gold-100 px-2 py-0.5 text-[10px] font-medium text-brand-gold-600">
          Coming in next build
        </span>
      </div>
      <p className="mt-2 text-[12px] text-brand-gold-600">
        Human-in-the-loop approval panel will
        appear here after AI processing is rebuilt.
      </p>
    </div>
  )
}
