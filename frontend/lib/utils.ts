import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Valid list/quote price: finite number strictly greater than zero. */
export function isPositivePrice(amount: unknown): amount is number {
  const n = typeof amount === 'number' ? amount : Number(amount)
  return Number.isFinite(n) && n > 0
}

export const PRICE_TBD_LABEL = 'TBD'

/** Display a price in INR, or ``TBD`` when missing / zero. */
export function formatPriceOrTbd(amount: number | null | undefined, withSymbol = true): string {
  if (!isPositivePrice(amount)) return withSymbol ? `₹${PRICE_TBD_LABEL}` : PRICE_TBD_LABEL
  return formatCurrency(amount)
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}
