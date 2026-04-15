import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export default function MonoText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[13px]', className)}>{children}</span>
}
