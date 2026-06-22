import * as XLSX from 'xlsx'

import type { WinLossAnalysisReportResponse, WinLossAnalysisRow } from '@/lib/api'

export type WinLossAnalysisExportFormat = 'csv' | 'xlsx'

const EXPORT_HEADERS = [
  'Quote Ref',
  'Customer Name',
  'Product / Category',
  'Category',
  'Quoted Value (INR)',
  'Outcome',
  'Loss Reason',
  'Salesperson',
] as const

function rowToExportRecord(row: WinLossAnalysisRow) {
  return {
    'Quote Ref': row.quote_ref,
    'Customer Name': row.customer_name,
    'Product / Category': row.product,
    Category: row.category,
    'Quoted Value (INR)': row.quoted_value,
    Outcome: row.outcome === 'won' ? 'Won' : 'Lost',
    'Loss Reason': row.outcome === 'lost' ? row.loss_reason ?? '' : '',
    Salesperson: row.salesperson,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildFilename(report: WinLossAnalysisReportResponse, ext: string) {
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  return `win-loss-analysis-${from}-${to}.${ext}`
}

export function exportWinLossAnalysisReport(
  report: WinLossAnalysisReportResponse,
  rows: WinLossAnalysisRow[],
  format: WinLossAnalysisExportFormat,
) {
  const dataRows = rows.map(rowToExportRecord)
  const filename = buildFilename(report, format)

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows, { header: [...EXPORT_HEADERS] })
    const csv = XLSX.utils.sheet_to_csv(sheet)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(dataRows, { header: [...EXPORT_HEADERS] })
  XLSX.utils.book_append_sheet(workbook, sheet, 'Win Loss Analysis')
  XLSX.writeFile(workbook, filename)
}

function computeLossReasonBreakdown(lostRows: WinLossAnalysisRow[]) {
  const counts: Record<string, number> = {}
  for (const row of lostRows) {
    const reason = row.loss_reason ?? 'Unspecified'
    counts[reason] = (counts[reason] ?? 0) + 1
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const maxCount = sorted[0]?.[1] ?? 0
  return {
    total: lostRows.length,
    reasons: sorted.map(([reason, count]) => ({
      reason,
      count,
      is_top: count === maxCount && maxCount > 0,
      bar_width_pct: maxCount > 0 ? Math.round((count / maxCount) * 1000) / 10 : 0,
    })),
    insights: [] as string[],
  }
}

export function computeWinLossSummary(rows: WinLossAnalysisRow[]) {
  const wonRows = rows.filter((r) => r.outcome === 'won')
  const lostRows = rows.filter((r) => r.outcome === 'lost')
  const totalQuotedValue = rows.reduce((s, r) => s + r.quoted_value, 0)
  const totalWonValue = wonRows.reduce((s, r) => s + r.quoted_value, 0)
  const totalLostValue = lostRows.reduce((s, r) => s + r.quoted_value, 0)
  const breakdown = computeLossReasonBreakdown(lostRows)
  const top = breakdown.reasons[0]

  return {
    total_quoted_value: Math.round(totalQuotedValue * 100) / 100,
    total_won_value: Math.round(totalWonValue * 100) / 100,
    total_lost_value: Math.round(totalLostValue * 100) / 100,
    total_quoted_count: rows.length,
    total_won_count: wonRows.length,
    total_lost_count: lostRows.length,
    win_rate_value_pct:
      totalQuotedValue > 0 ? Math.round((totalWonValue / totalQuotedValue) * 1000) / 10 : 0,
    win_rate_count_pct: rows.length > 0 ? Math.round((wonRows.length / rows.length) * 1000) / 10 : 0,
    top_loss_reason: top?.reason ?? null,
    top_loss_reason_count: top?.count ?? 0,
    loss_reason_breakdown: breakdown,
  }
}
