import ExcelJS from 'exceljs'

export const LISTING_EXPORT_GROUP_COLORS = ['FFF4F8F4', 'FFE8F0E8'] as const

export type ListingExcelColumn = {
  header: string
  key: string
  width?: number
}

export async function downloadListingExcelWorkbook(args: {
  sheetName: string
  filename: string
  columns: ListingExcelColumn[]
  rows: Record<string, string | number | null | undefined>[]
  /** Alternating fill per group (e.g. one quotation / PO / enquiry). */
  groupIndexForRow: (rowIndex: number) => number
}): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Neeyog Packaging CPQ'
  wb.created = new Date()

  const ws = wb.addWorksheet(args.sheetName)
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const headerRow = ws.addRow(args.columns.map((c) => c.header))
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3D5C45' },
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  headerRow.height = 22

  args.columns.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width ?? 16
  })

  args.rows.forEach((rowData, rowIdx) => {
    const values = args.columns.map((col) => {
      const raw = rowData[col.key]
      if (raw == null || raw === '') return ''
      return raw
    })
    const row = ws.addRow(values)
    const group = args.groupIndexForRow(rowIdx)
    const fillArgb = LISTING_EXPORT_GROUP_COLORS[group % LISTING_EXPORT_GROUP_COLORS.length]
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD8DED4' } },
        left: { style: 'thin', color: { argb: 'FFD8DED4' } },
        bottom: { style: 'thin', color: { argb: 'FFD8DED4' } },
        right: { style: 'thin', color: { argb: 'FFD8DED4' } },
      }
    })
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = args.filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function formatListingExportDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatListingExportFollowUp(iso: string | null | undefined): string {
  return formatListingExportDate(iso)
}

export function formatListingExportAge(iso: string): string {
  const created = new Date(iso)
  if (Number.isNaN(created.getTime())) return ''
  const diffMs = Date.now() - created.getTime()
  const days = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

export function listingExportFilename(prefix: string, rangeLabel: string): string {
  const safe = rangeLabel.replace(/[^\w.-]+/g, '_').slice(0, 40)
  const stamp = new Date().toISOString().slice(0, 10)
  return `${prefix}_${safe}_${stamp}.xlsx`
}
