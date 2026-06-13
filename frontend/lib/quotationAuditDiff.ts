import type { QuotationAuditChangeView, QuotationAuditItem, QuotationAuditSection } from '@/types'
import { formatCurrency } from '@/lib/utils'

function lineTitle(lineKey: string): string {
  const parts = lineKey.split(':')
  if (parts.length >= 2) return parts[0].replace(/_/g, ' ') || lineKey
  return lineKey.length > 3 ? lineKey : 'Product line'
}

function legacyLineSection(
  lineKey: string,
  changes: Record<string, { from: unknown; to: unknown }>,
  side: 'before' | 'after',
): QuotationAuditSection {
  const fieldLabels: Record<string, string> = {
    description: 'Description',
    quantity: 'Quantity',
    unit_price: 'Unit price',
    line_total: 'Line total',
    customer_discount_pct: 'Discount',
    unit: 'Unit',
  }
  const title = lineTitle(lineKey)
  const rows = [{ key: `line.${lineKey}.title`, label: 'Product', value: title }]
  for (const [field, delta] of Object.entries(changes)) {
    const raw = side === 'before' ? delta.from : delta.to
    const value =
      field === 'unit_price' || field === 'line_total'
        ? formatCurrency(Number(raw))
        : String(raw ?? '—')
    rows.push({
      key: `line.${lineKey}.${field}`,
      label: fieldLabels[field] || field,
      value,
    })
  }
  return {
    title,
    rows,
    highlight_all: Object.keys(changes).length >= 3,
  }
}

/** Build a change view from older audit entries that only stored line diffs. */
export function buildLegacyAuditChangeView(item: QuotationAuditItem): QuotationAuditChangeView | null {
  const diff = item.diff
  if (!diff) return null

  const beforeSections: QuotationAuditSection[] = []
  const afterSections: QuotationAuditSection[] = []
  const changedKeys = new Set<string>()

  for (const entry of diff.changed ?? []) {
    const lineKey = String(entry.line ?? 'line')
    const changes = entry.changes ?? {}
    if (Object.keys(changes).length === 0) continue
    beforeSections.push(legacyLineSection(lineKey, changes, 'before'))
    afterSections.push(legacyLineSection(lineKey, changes, 'after'))
    for (const field of Object.keys(changes)) {
      changedKeys.add(`line.${lineKey}.${field}`)
    }
  }

  for (const lineKey of diff.added ?? []) {
    const label = lineTitle(String(lineKey))
    afterSections.push({
      title: label,
      rows: [{ key: `line.${lineKey}.added`, label: 'Product', value: label }],
      highlight_all: true,
    })
    changedKeys.add(`line.${lineKey}.added`)
  }

  for (const lineKey of diff.removed ?? []) {
    const label = lineTitle(String(lineKey))
    beforeSections.push({
      title: label,
      rows: [{ key: `line.${lineKey}.removed`, label: 'Product', value: label }],
      highlight_all: true,
    })
    changedKeys.add(`line.${lineKey}.removed`)
  }

  if (beforeSections.length === 0 && afterSections.length === 0) return null

  return {
    before: { sections: beforeSections },
    after: { sections: afterSections },
    changed_keys: [...changedKeys],
  }
}

export function resolveAuditChangeView(item: QuotationAuditItem): QuotationAuditChangeView | null {
  const cv = item.change_view
  if (cv?.before?.sections?.length || cv?.after?.sections?.length) {
    return cv
  }
  return buildLegacyAuditChangeView(item)
}

export function auditItemHasChangeView(item: QuotationAuditItem): boolean {
  return resolveAuditChangeView(item) != null
}
