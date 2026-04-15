'use client'

import { useEffect, useRef } from 'react'
import { Check, AlertTriangle, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentEvent } from '@/types'

const AGENT_LABELS: Record<string, string> = {
  parser: 'Email Parser',
  matcher: 'Product Matcher',
  quote_builder: 'Quotation Builder',
  system: 'System',
}

const AGENT_COLORS: Record<string, { dot: string; chip: string; border: string }> = {
  parser: {
    dot: 'bg-brand-navy-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    border: 'border-brand-navy-500',
  },
  matcher: {
    dot: 'bg-brand-gold-400',
    chip: 'bg-brand-gold-50 text-brand-gold-700 border-brand-gold-200',
    border: 'border-brand-gold-400',
  },
  quote_builder: {
    dot: 'bg-brand-green-500',
    chip: 'bg-brand-green-50 text-brand-green-700 border-brand-green-200',
    border: 'border-brand-green-500',
  },
  system: {
    dot: 'bg-surface-muted',
    chip: 'bg-gray-50 text-gray-600 border-gray-200',
    border: 'border-surface-muted',
  },
}

function getAgentStyle(agent: string) {
  return AGENT_COLORS[agent] || AGENT_COLORS.system
}

function EventIcon({ type }: { type: string }) {
  if (type === 'agent_complete' || type === 'enquiry_created') {
    return <Check className="h-3 w-3 text-brand-green-600" strokeWidth={3} />
  }
  if (type === 'agent_warning') {
    return <AlertTriangle className="h-3 w-3 text-amber-600" strokeWidth={2.5} />
  }
  if (type === 'agent_error') {
    return <X className="h-3 w-3 text-red-600" strokeWidth={3} />
  }
  return null
}

function formatTime(timestamp?: string): string {
  if (!timestamp) return ''
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

export default function LiveAgentTimeline({
  events,
  isStreaming,
}: {
  events: AgentEvent[]
  isStreaming: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  const visible = events.filter(
    (e) => e.type !== 'result' && e.type !== 'stream_end',
  )

  if (visible.length === 0 && !isStreaming) return null

  const lastEvent = visible[visible.length - 1]
  const showThinking = isStreaming && lastEvent?.type === 'agent_start'

  return (
    <div className="max-h-[400px] overflow-y-auto rounded-xl border border-surface-border bg-white shadow-sm">
      <div className="px-5 pt-4 pb-1">
        <h3 className="text-[14px] font-medium tracking-[-0.1px] text-gray-500 uppercase text-[11px] tracking-wide">
          Live Agent Activity
        </h3>
      </div>
      <div className="relative px-5 pb-4">
        {visible.map((evt, i) => {
          const agent = evt.agent || 'system'
          const style = getAgentStyle(agent)
          const isStart = evt.type === 'agent_start'
          const isComplete = evt.type === 'agent_complete'
          const isWarning = evt.type === 'agent_warning'
          const isError = evt.type === 'agent_error'
          const isLast = i === visible.length - 1

          return (
            <div key={i} className="relative flex gap-3 group">
              {/* Vertical line */}
              {!isLast && (
                <div className="absolute left-[7px] top-[20px] bottom-0 w-px bg-surface-border" />
              )}

              {/* Dot */}
              <div className="relative z-10 mt-[6px] flex-shrink-0">
                {isStart && isLast && isStreaming ? (
                  <div className="relative flex items-center justify-center">
                    <span className={cn('h-4 w-4 rounded-full', style.dot)} />
                    <span className={cn('absolute h-4 w-4 rounded-full animate-ping opacity-40', style.dot)} />
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full',
                      isComplete && 'bg-brand-green-100',
                      isWarning && 'bg-amber-100',
                      isError && 'bg-red-100',
                      isStart && style.dot,
                      !isComplete && !isWarning && !isError && !isStart && style.dot,
                    )}
                  >
                    <EventIcon type={evt.type} />
                  </div>
                )}
              </div>

              {/* Content */}
              <div
                className={cn(
                  'flex-1 pb-4 min-w-0',
                  isWarning && 'rounded-lg bg-brand-gold-50/50 px-3 py-2 -mx-1 mb-2',
                  isError && 'rounded-lg bg-red-50 px-3 py-2 -mx-1 mb-2',
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', style.chip)}>
                    {AGENT_LABELS[agent] || agent}
                  </span>
                  {evt.timestamp && (
                    <span className="font-mono text-[10px] text-surface-muted">
                      {formatTime(evt.timestamp)}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'mt-1 text-[13px] leading-snug',
                    isComplete && 'text-gray-900',
                    isWarning && 'text-amber-800',
                    isError && 'text-red-700',
                    isStart && 'text-gray-800 font-medium',
                    !isComplete && !isWarning && !isError && !isStart && 'text-gray-700',
                  )}
                >
                  {evt.message}
                </p>
                {evt.detail && (
                  <p className="mt-0.5 text-[12px] text-surface-muted">{evt.detail}</p>
                )}
                {isComplete && evt.data && Object.keys(evt.data).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono text-surface-muted">
                    {Object.entries(evt.data).map(([k, v]) => (
                      <span key={k}>
                        {k}: <span className="text-gray-700">{typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {showThinking && (
          <div className="flex items-center gap-3 pl-[7px] pt-1">
            <Loader2 className="h-4 w-4 animate-spin text-surface-muted" />
            <span className="text-[12px] text-surface-muted italic">AI is working...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
