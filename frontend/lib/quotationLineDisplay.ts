import type { QuotationLineItem, QuotationPdfDisplayOverrides } from '@/types'

export function effectiveLinePdfDisplay(
  line: QuotationLineItem,
  idx: number,
  overrides: QuotationPdfDisplayOverrides | null | undefined,
): { description: string; size: string } {
  const row = overrides?.lines?.[idx]
  const desc =
    (typeof row?.description === 'string' && row.description !== ''
      ? row.description
      : typeof row?.product_name === 'string' && row.product_name !== ''
        ? row.product_name
        : null) ??
    (line.product_name || line.description || '')
  const size =
    (typeof row?.size === 'string' && row.size !== '' ? row.size : null) ?? (line.size || '')
  return { description: desc, size: size || '—' }
}

/** dd/mm/yyyy (matches quotation PDF letterhead). */
export function formatDateDdMmYyyy(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}
