const MAKE_PATTERN = /\s+make\b/gi

function collapseWhitespace(text: string): string {
  return text.replace(/\s{2,}/g, ' ').replace(/\s+—/g, ' —').trim()
}

/** Remove known supplier names and standalone ``Make`` from customer-facing quotation text. */
export function stripSupplierNamesFromText(text: string, supplierNames: string[]): string {
  if (!text) return ''
  let result = text
  const sorted = [...new Set(supplierNames.map((n) => n.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )
  for (const name of sorted) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '')
  }
  result = result.replace(MAKE_PATTERN, '')
  return collapseWhitespace(result)
}
