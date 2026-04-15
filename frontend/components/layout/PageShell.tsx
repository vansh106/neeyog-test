'use client'

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

export default function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1 }}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.3px]">{title}</h1>
          {subtitle && <p className="text-[14px] text-surface-muted mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </motion.div>
  )
}
