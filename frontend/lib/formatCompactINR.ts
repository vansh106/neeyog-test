/** Compact INR display for dashboard analytics (e.g. ₹13.1L, ₹69K). */
export function formatCompactINR(amount: number): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '₹0'

  const abs = Math.abs(n)
  if (abs >= 10_000_000) {
    const cr = n / 10_000_000
    const text = cr >= 10 ? Math.round(cr).toString() : cr.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
    return `₹${text}Cr`
  }
  if (abs >= 100_000) {
    const lakhs = n / 100_000
    const text =
      lakhs >= 100
        ? Math.round(lakhs).toString()
        : lakhs >= 10
          ? Math.round(lakhs).toString()
          : lakhs.toFixed(1).replace(/\.0$/, '')
    return `₹${text}L`
  }
  if (abs >= 1_000) {
    const thousands = n / 1_000
    const text = thousands >= 10 ? Math.round(thousands).toString() : thousands.toFixed(1).replace(/\.0$/, '')
    return `₹${text}K`
  }
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
