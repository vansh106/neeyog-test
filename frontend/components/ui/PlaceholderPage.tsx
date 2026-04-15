import { type LucideIcon, Circle } from 'lucide-react'

export default function PlaceholderPage({
  icon: Icon,
  title,
  description,
  features,
}: {
  icon: LucideIcon
  title: string
  description: string
  features: string[]
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 rounded-full bg-[#F0F7F2] flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-[#4EA362]" />
      </div>
      <h1 className="text-[24px] font-semibold tracking-[-0.3px] text-gray-900 mb-2">{title}</h1>
      <p className="text-[14px] text-[#8A9488] max-w-md mb-8">{description}</p>
      <div className="space-y-3 text-left max-w-sm w-full mb-8">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            <Circle className="w-4 h-4 text-[#8A9488] flex-shrink-0" />
            <span className="text-[14px] text-[#8A9488]">{f}</span>
          </div>
        ))}
      </div>
      <span className="inline-flex items-center rounded-full bg-[#FDFBEA] text-[#857600] border border-[#F5E57A] text-[11px] font-medium px-3 py-1">
        Planned for next release
      </span>
    </div>
  )
}
