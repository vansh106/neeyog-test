'use client'

import { type LucideIcon } from 'lucide-react'
import AnimatedCounter from '@/components/ui/AnimatedCounter'

export default function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-white border border-[#E2E6DC] rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-[18px] h-[18px]" style={{ color }} />
        </div>
      </div>
      <div className="text-[28px] font-semibold tracking-[-0.5px] text-gray-900">
        <AnimatedCounter value={value} />
      </div>
      <div className="text-[12px] text-[#8A9488] mt-1">{label}</div>
    </div>
  )
}
