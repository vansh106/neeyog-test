'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

export default function AnimatedCounter({
  value,
  duration = 1.2,
  prefix = '',
  className = '',
}: {
  value: number
  duration?: number
  prefix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate(v) {
        setDisplayed(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}{displayed.toLocaleString('en-IN')}
    </span>
  )
}
