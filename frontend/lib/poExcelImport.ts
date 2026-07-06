/**
 * Manual PO Excel import — template download and workbook parsing.
 */

import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'

import {
  getAllMasterNotesCategories,
  getAllMasterNotesSubCategories,
  getMasterNotesCategories,
  getMasterNotesFamilies,
  getMasterNotesSubCategories,
  OTHERS_FAMILY_LABEL,
} from '@/lib/enquiryMasterNotes'
import { uuidv4 } from '@/lib/manualAssemblyLineItem'
import { isPositivePrice } from '@/lib/utils'
import type { ManualLineItem, OthersCategory } from '@/types'

export const PO_IMPORT_SHEET_NAME = 'PO Import'
export const PO_IMPORT_LISTS_SHEET = 'Lists'

export const PO_IMPORT_UNITS = ['Nos', 'Mtr', 'Set', 'Kg', 'Ltr'] as const

const CLIENT_FIELD_ROWS: { label: string; key: keyof PoImportClient; required: boolean }[] = [
  { label: 'Client Company*', key: 'client_company', required: true },
  { label: 'Contact Name*', key: 'client_name', required: true },
  { label: 'Email', key: 'client_email', required: false },
  { label: 'Phone', key: 'client_phone', required: false },
  { label: 'SO Number', key: 'so_number', required: false },
  { label: 'PO Notes', key: 'notes', required: false },
]

export const PO_IMPORT_PRODUCT_HEADERS = [
  'Family*',
  'Category*',
  'Sub-category',
  'Description*',
  'Quantity*',
  'Unit',
  'Unit Price',
  'Discount %',
] as const

const PRODUCT_HEADER_ROW = 13
const PRODUCT_DATA_START_ROW = 14

/** Placeholder text in optional fields — treat as empty. */
const CLIENT_HINT_VALUES = new Set(['required', 'optional'])

export type PoImportClient = {
  client_company: string
  client_name: string
  client_email?: string
  client_phone?: string
  so_number?: string
  notes?: string
}

export type PoImportProductRow = {
  rowNumber: number
  family: string
  category: string
  sub_category: string
  description: string
  quantity: number
  unit: string
  unit_price: number | null
  discount_pct: number
  errors: string[]
}

export type PoImportParseResult = {
  client: PoImportClient
  products: PoImportProductRow[]
  lineItems: ManualLineItem[]
  errors: string[]
  valid: boolean
}

function normalizeLabel(value: string): string {
  return value.replace(/\*/g, '').trim().toLowerCase()
}

function parseNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function cellText(raw: unknown): string {
  if (raw == null) return ''
  return String(raw).trim()
}


function importRowToLineItem(row: PoImportProductRow): ManualLineItem {
  const desc = row.description.trim()
  const family = row.family.trim()
  const category = row.category.trim()
  const subCategory = row.sub_category.trim()
  const unitPrice = row.unit_price
  const priceTbd = unitPrice == null || !isPositivePrice(unitPrice)

  const cascade: Record<string, string> = {
    description: desc,
    product_family: family,
    family,
    category,
  }
  if (subCategory) cascade.sub_category = subCategory

  return {
    id: uuidv4(),
    category: 'temporary_product',
    cascadeSelections: cascade,
    selectedProduct: {
      id: `temporary_product:${uuidv4()}`,
      name: desc,
      size_inch: null,
      size_mm: null,
      material: '',
      base_price: priceTbd ? null : unitPrice,
      unit: row.unit || 'Nos',
      display_label: desc,
    },
    quantity: row.quantity,
    customer_discount_pct: row.discount_pct > 0 ? row.discount_pct : undefined,
    price_tbd: priceTbd,
  }
}

function validateProductRow(
  row: Omit<PoImportProductRow, 'errors'>,
  othersTree: OthersCategory[],
): string[] {
  const errors: string[] = []
  const families = getMasterNotesFamilies()
  const family = row.family.trim()
  const category = row.category.trim()
  const subCategory = row.sub_category.trim()

  if (!family) errors.push('Family is required')
  else if (!families.includes(family)) errors.push(`Unknown family "${family}"`)

  if (!category) errors.push('Category is required')
  else if (family) {
    const allowed = getMasterNotesCategories(family, othersTree)
    if (allowed.length > 0 && !allowed.includes(category)) {
      errors.push(`Category "${category}" is not valid for family "${family}"`)
    }
  }

  if (subCategory && family && category) {
    const allowedSubs = getMasterNotesSubCategories(family, category, othersTree)
    if (allowedSubs.length > 0 && !allowedSubs.includes(subCategory)) {
      errors.push(`Sub-category "${subCategory}" is not valid for ${family} › ${category}`)
    }
  }

  if (!row.description.trim()) errors.push('Description is required')
  if (!Number.isFinite(row.quantity) || row.quantity < 1) errors.push('Quantity must be at least 1')

  if (row.unit_price != null && !isPositivePrice(row.unit_price)) {
    errors.push('Unit price must be a positive number when provided')
  }

  if (row.discount_pct < 0 || row.discount_pct > 100) {
    errors.push('Discount % must be between 0 and 100')
  }

  return errors
}

function isProductRowEmpty(cells: string[]): boolean {
  return cells.every((c) => !c.trim())
}

function readClientFieldValue(row: (string | number | null)[]): string {
  const candidates = [cellText(row[1]), cellText(row[2])]
  for (const raw of candidates) {
    const v = raw.trim()
    if (!v) continue
    if (CLIENT_HINT_VALUES.has(v.toLowerCase())) continue
    return v
  }
  return ''
}

function parseClientFromRows(rows: (string | number | null)[][]): PoImportClient {
  const client: PoImportClient = {
    client_company: '',
    client_name: '',
  }
  for (const row of rows) {
    const label = normalizeLabel(cellText(row[0]))
    const value = readClientFieldValue(row)
    const field = CLIENT_FIELD_ROWS.find((f) => normalizeLabel(f.label) === label)
    if (!field || !value) continue
    if (field.key === 'client_company') client.client_company = value
    else if (field.key === 'client_name') client.client_name = value
    else if (field.key === 'client_email') client.client_email = value
    else if (field.key === 'client_phone') client.client_phone = value
    else if (field.key === 'so_number') client.so_number = value
    else if (field.key === 'notes') client.notes = value
  }
  return client
}

function findProductHeaderRowIndex(rows: (string | number | null)[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const first = normalizeLabel(cellText(rows[i]?.[0]))
    if (first === 'family' || first.startsWith('family ')) return i
  }
  return PRODUCT_HEADER_ROW - 1
}

/** Parse an uploaded manual PO import workbook. */
export function parsePoImportWorkbook(
  buffer: ArrayBuffer,
  othersTree: OthersCategory[] = [],
): PoImportParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === PO_IMPORT_SHEET_NAME.toLowerCase()) ??
    wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as (string | number | null)[][]

  const client = parseClientFromRows(rows)
  const errors: string[] = []

  if (!client.client_company.trim()) errors.push('Client Company is required')
  if (!client.client_name.trim()) errors.push('Contact Name is required')

  const headerIdx = findProductHeaderRowIndex(rows)
  const products: PoImportProductRow[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const cells = PO_IMPORT_PRODUCT_HEADERS.map((_, col) => cellText(row[col]))
    if (isProductRowEmpty(cells)) continue

    const qty = parseNumber(row[4])
    const unitPrice = parseNumber(row[6])
    const discount = parseNumber(row[7]) ?? 0

    const product: PoImportProductRow = {
      rowNumber: i + 1,
      family: cells[0],
      category: cells[1],
      sub_category: cells[2],
      description: cells[3],
      quantity: qty != null ? Math.max(1, Math.round(qty)) : 0,
      unit: cells[5] || 'Nos',
      unit_price: unitPrice,
      discount_pct: discount,
      errors: [],
    }
    product.errors = validateProductRow(product, othersTree)
    products.push(product)
  }

  if (products.length === 0) errors.push('Add at least one product row')

  for (const p of products) {
    if (p.errors.length > 0) {
      errors.push(`Row ${p.rowNumber}: ${p.errors.join('; ')}`)
    }
  }

  const validProducts = products.filter((p) => p.errors.length === 0)
  const lineItems = validProducts.map(importRowToLineItem)

  return {
    client,
    products,
    lineItems,
    errors,
    valid: errors.length === 0 && lineItems.length > 0,
  }
}

function writeListColumn(ws: ExcelJS.Worksheet, col: number, title: string, values: string[]) {
  ws.getCell(1, col).value = title
  ws.getCell(1, col).font = { bold: true }
  values.forEach((v, i) => {
    ws.getCell(i + 2, col).value = v
  })
}

function listRange(col: number, count: number): string {
  const colLetter = String.fromCharCode(64 + col)
  if (count <= 0) return `"${colLetter}2"`
  return `${PO_IMPORT_LISTS_SHEET}!$${colLetter}$2:$${colLetter}$${count + 1}`
}

type WorksheetWithValidations = ExcelJS.Worksheet & {
  dataValidations: {
    add: (
      range: string,
      rule: {
        type: 'list'
        allowBlank?: boolean
        formulae: string[]
        showErrorMessage?: boolean
        errorTitle?: string
        error?: string
      },
    ) => void
  }
}

function addListValidation(
  ws: ExcelJS.Worksheet,
  range: string,
  formulae: string[],
  opts: { allowBlank?: boolean; errorTitle?: string; error?: string } = {},
) {
  ;(ws as WorksheetWithValidations).dataValidations.add(range, {
    type: 'list',
    allowBlank: opts.allowBlank ?? false,
    formulae,
    showErrorMessage: true,
    errorTitle: opts.errorTitle,
    error: opts.error,
  })
}

/** Build and download the manual PO import template (.xlsx). */
export async function downloadPoImportTemplate(othersTree: OthersCategory[] = []): Promise<void> {
  const families = getMasterNotesFamilies()
  const categories = getAllMasterNotesCategories(othersTree)
  const subCategories = getAllMasterNotesSubCategories(othersTree)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Parth Valves CPQ'
  wb.created = new Date()

  const instructions = wb.addWorksheet('Instructions')
  instructions.getColumn(1).width = 100
  instructions.mergeCells('A1:A1')
  instructions.getCell(1, 1).value = 'Manual PO Import — Instructions'
  instructions.getCell(1, 1).font = { bold: true, size: 14 }
  instructions.getCell(3, 1).value = [
    '1. Fill client details in column B (Value) on the "PO Import" sheet — fields marked * are required.',
    '2. Add one row per product below the product table header.',
    '3. Use dropdowns for Family, Category, and Sub-category (same options as Masters).',
    '4. Description is free text — include size, material, specs, etc.',
    '5. Unit Price is optional — leave blank for TBD pricing.',
    '6. Quantity is required (minimum 1). Unit defaults to Nos when blank.',
    `7. For "${OTHERS_FAMILY_LABEL}" family, use categories from your Others masters.`,
    '8. Save the file and upload it in Create PO → Import from Excel.',
  ].join('\n')
  instructions.getCell(3, 1).alignment = { wrapText: true, vertical: 'top' }

  const lists = wb.addWorksheet(PO_IMPORT_LISTS_SHEET)
  lists.state = 'veryHidden'
  writeListColumn(lists, 1, 'Families', families)
  writeListColumn(lists, 2, 'Categories', categories)
  writeListColumn(lists, 3, 'Sub-categories', subCategories)
  writeListColumn(lists, 4, 'Units', [...PO_IMPORT_UNITS])

  const ws = wb.addWorksheet(PO_IMPORT_SHEET_NAME)
  ws.getColumn(1).width = 22
  ws.getColumn(2).width = 36
  ws.getColumn(3).width = 28
  ws.getColumn(4).width = 48
  ws.getColumn(5).width = 12
  ws.getColumn(6).width = 10
  ws.getColumn(7).width = 14
  ws.getColumn(8).width = 12

  ws.mergeCells('A1:H1')
  ws.getCell(1, 1).value = 'Manual PO Import Template'
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  ws.getCell(2, 1).value =
    'Enter client values in column B, then add products from row 14 onward. Fields marked * are required.'
  ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF666666' } }

  ws.getCell(4, 1).value = 'CLIENT DETAILS'
  ws.getCell(4, 1).font = { bold: true }
  ws.getCell(4, 2).value = 'Value'
  ws.getCell(4, 2).font = { bold: true }
  ws.getCell(4, 3).value = 'Required?'
  ws.getCell(4, 3).font = { bold: true, italic: true, color: { argb: 'FF888888' } }

  const valueFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF8E8' },
  }

  CLIENT_FIELD_ROWS.forEach((field, idx) => {
    const row = 5 + idx
    ws.getCell(row, 1).value = field.label
    if (field.required) ws.getCell(row, 1).font = { bold: true }
    const valueCell = ws.getCell(row, 2)
    valueCell.fill = valueFill
    ws.getCell(row, 3).value = field.required ? 'Required' : 'Optional'
    ws.getCell(row, 3).font = { italic: true, color: { argb: field.required ? 'FFCC0000' : 'FF888888' } }
  })

  ws.getCell(11, 1).value = 'PRODUCTS'
  ws.getCell(11, 1).font = { bold: true }
  ws.getCell(12, 1).value = 'One row per product. Sub-category is optional when not applicable.'

  PO_IMPORT_PRODUCT_HEADERS.forEach((header, col) => {
    const cell = ws.getCell(PRODUCT_HEADER_ROW, col + 1)
    cell.value = header
    cell.font = { bold: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0E8' },
    }
  })

  for (let r = PRODUCT_DATA_START_ROW; r < PRODUCT_DATA_START_ROW + 20; r++) {
    ws.getCell(r, 5).value = r === PRODUCT_DATA_START_ROW ? 1 : ''
  }

  const lastProductRow = 500
  addListValidation(ws, `A${PRODUCT_DATA_START_ROW}:A${lastProductRow}`, [listRange(1, families.length)], {
    allowBlank: false,
    errorTitle: 'Invalid family',
    error: 'Choose a product family from the list.',
  })
  addListValidation(ws, `B${PRODUCT_DATA_START_ROW}:B${lastProductRow}`, [listRange(2, categories.length)], {
    allowBlank: false,
    errorTitle: 'Invalid category',
    error: 'Choose a category from the list.',
  })
  addListValidation(ws, `C${PRODUCT_DATA_START_ROW}:C${lastProductRow}`, [listRange(3, subCategories.length)], {
    allowBlank: true,
    errorTitle: 'Invalid sub-category',
    error: 'Choose a sub-category from the list or leave blank.',
  })
  addListValidation(ws, `F${PRODUCT_DATA_START_ROW}:F${lastProductRow}`, [listRange(4, PO_IMPORT_UNITS.length)], {
    allowBlank: true,
    errorTitle: 'Invalid unit',
    error: 'Choose a unit from the list.',
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `manual-po-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function poImportItemTotal(lineItems: ManualLineItem[]): number {
  return lineItems.reduce((sum, li) => {
    if (li.price_tbd) return sum
    const base = li.selectedProduct?.base_price
    if (!isPositivePrice(base)) return sum
    const discount = li.customer_discount_pct ?? 0
    const unit = base * (1 - discount / 100)
    return sum + unit * li.quantity
  }, 0)
}
