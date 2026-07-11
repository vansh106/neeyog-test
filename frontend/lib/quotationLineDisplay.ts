import type { QuotationLineItem, QuotationPdfDisplayOverrides } from '@/types'
import { collapseDuplicateFittingDescription } from '@/lib/hoseFittingDescription'
import { stripSupplierNamesFromText } from '@/lib/stripSupplierFromQuotationText'

/** Omit spec lines with no value (legacy quotes used ``----`` placeholders). */
export function sanitizeQuotationDescription(desc: string, supplierNames: string[] = []): string {
  if (!desc) return ''
  const sep = ' : '
  const deduped = collapseDuplicateFittingDescription(desc)
  return deduped
    .split('\n')
    .filter((line) => {
      const i = line.indexOf(sep)
      if (i === -1) return Boolean(stripSupplierNamesFromText(line.trim(), supplierNames))
      const label = line.slice(0, i).trim().toLowerCase()
      if (label === 'supplier' || label === 'supplier id') return false
      const val = line.slice(i + sep.length).trim()
      if (!val || val === '----' || val === '—' || val === '-') return false
      return Boolean(stripSupplierNamesFromText(val, supplierNames))
    })
    .map((line) => {
      const i = line.indexOf(sep)
      if (i === -1) return stripSupplierNamesFromText(line.trim(), supplierNames)
      const label = line.slice(0, i).trim()
      const val = stripSupplierNamesFromText(line.slice(i + sep.length).trim(), supplierNames)
      return `${label}${sep}${val}`
    })
    .join('\n')
}

export function effectiveLinePdfDisplay(
  line: QuotationLineItem,
  idx: number,
  overrides: QuotationPdfDisplayOverrides | null | undefined,
  supplierNames: string[] = [],
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
  return { description: sanitizeQuotationDescription(desc, supplierNames), size: size || '—' }
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
