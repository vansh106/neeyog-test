import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  complete:          'bg-[#F0F7F2] text-[#235A32] border border-[#AEDAB5]',
  incomplete:        'bg-[#FDFBEA] text-[#857600] border border-[#F5E57A]',
  ambiguous:         'bg-amber-50 text-amber-700 border border-amber-200',
  not_found:         'bg-red-50 text-red-600 border border-red-200',
  pending_approval:  'bg-blue-50 text-blue-700 border border-blue-200',
  approved:          'bg-[#F0F7F2] text-[#235A32] border border-[#AEDAB5]',
  draft:             'bg-gray-50 text-gray-600 border border-gray-200',
  sent:              'bg-[#F0F7F2] text-[#235A32] border border-[#AEDAB5]',
  failed:            'bg-red-50 text-red-600 border border-red-200',
  received:          'bg-blue-50 text-blue-600 border border-blue-200',
  parsing:           'bg-[#FDFBEA] text-[#857600] border border-[#F5E57A]',
  matching:          'bg-[#FDFBEA] text-[#857600] border border-[#F5E57A]',
  quoting:           'bg-[#FDFBEA] text-[#857600] border border-[#F5E57A]',
  awaiting_info:     'bg-amber-50 text-amber-700 border border-amber-200',
  quoted:            'bg-[#F0F7F2] text-[#235A32] border border-[#AEDAB5]',
}

export default function StatusBadge({ status, className }: { status: string | null; className?: string }) {
  const s = status || 'unknown'
  const style = STATUS_STYLES[s] || 'bg-gray-50 text-gray-500 border border-gray-200'
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap', style, className)}>
      {s.replace(/_/g, ' ')}
    </span>
  )
}
