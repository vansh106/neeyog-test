import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F0F7F2] flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-[#4EA362]" />
      </div>
      <h3 className="text-[18px] font-semibold tracking-[-0.2px] text-gray-900 mb-1">{title}</h3>
      <p className="text-[14px] text-[#8A9488] max-w-sm mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="bg-[#2A6B3C] hover:bg-[#235A32] text-white">
          {action.label}
        </Button>
      )}
    </div>
  )
}
