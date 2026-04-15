'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AIReasoningPanel({ reasoning }: { reasoning: string[] }) {
  const [open, setOpen] = useState(false)

  if (!reasoning || reasoning.length === 0) return null

  return (
    <div className="border border-[#E2E6DC] rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-[14px] font-medium hover:bg-[#F4F5F0] transition-colors"
      >
        <span>AI Decision Trail</span>
        {open ? <ChevronDown className="w-4 h-4 text-[#8A9488]" /> : <ChevronRight className="w-4 h-4 text-[#8A9488]" />}
      </button>
      <div className={cn('overflow-hidden transition-all duration-300', open ? 'max-h-[1000px]' : 'max-h-0')}>
        <div className="px-4 pb-4 space-y-3">
          {reasoning.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-[#2A6B3C] flex-shrink-0" />
              <span className="font-mono text-[12px] text-gray-700 leading-relaxed">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
