'use client'

import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CloudUpload, Download, FileSpreadsheet, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { mastersApi } from '@/lib/api'
import {
  downloadPoImportTemplate,
  parsePoImportWorkbook,
  poImportItemTotal,
  type PoImportParseResult,
} from '@/lib/poExcelImport'
import { formatCurrency } from '@/lib/utils'
import type { OthersCategory } from '@/types'
import { cn } from '@/lib/utils'

type Props = {
  disabled?: boolean
  onParsed: (result: PoImportParseResult | null) => void
  parsed: PoImportParseResult | null
}

export default function PurchaseOrderExcelImportSection({
  disabled = false,
  onParsed,
  parsed,
}: Props) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const { data: othersData } = useQuery({
    queryKey: ['masters', 'others-tree'],
    queryFn: () => mastersApi.getOthersTree<{ items: OthersCategory[] }>(),
    staleTime: 60_000,
  })
  const othersTree = othersData?.items ?? []

  const handleDownloadTemplate = async () => {
    setTemplateBusy(true)
    setLocalError(null)
    try {
      await downloadPoImportTemplate(othersTree)
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : 'Could not generate template')
    } finally {
      setTemplateBusy(false)
    }
  }

  const readFile = useCallback(
    async (file: File) => {
      setBusy(true)
      setLocalError(null)
      setFileName(file.name)
      try {
        const buffer = await file.arrayBuffer()
        const result = parsePoImportWorkbook(buffer, othersTree)
        onParsed(result)
        if (!result.valid && result.errors.length > 0) {
          setLocalError(result.errors.slice(0, 3).join(' · '))
        }
      } catch (e: unknown) {
        onParsed(null)
        setLocalError(e instanceof Error ? e.message : 'Could not read Excel file')
      } finally {
        setBusy(false)
      }
    },
    [onParsed, othersTree],
  )

  const clearFile = () => {
    setFileName(null)
    setLocalError(null)
    onParsed(null)
  }

  const itemTotal = parsed?.valid ? poImportItemTotal(parsed.lineItems) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#E2E6DC] bg-[#FAFAF8] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium text-gray-900">Import from Excel</p>
            <p className="mt-1 text-[12px] text-surface-muted">
              Download the template, fill client details and product rows, then upload to create a
              manual PO. Product family, category, and sub-category use the same dropdowns as
              Masters.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || templateBusy}
            onClick={() => void handleDownloadTemplate()}
          >
            {templateBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download template
          </Button>
        </div>

        <div className="mt-4">
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors',
              disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-brand-green-400 hover:bg-white',
              fileName ? 'border-brand-green-300 bg-white' : 'border-[#D8DED4]',
            )}
          >
            <input
              type="file"
              accept=".xlsx,.xlsm"
              className="sr-only"
              disabled={disabled || busy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void readFile(f)
                e.target.value = ''
              }}
            />
            {busy ? (
              <Loader2 className="h-8 w-8 animate-spin text-surface-muted" />
            ) : (
              <CloudUpload className="h-8 w-8 text-surface-muted" />
            )}
            <p className="mt-2 text-[13px] font-medium text-gray-900">
              {fileName ? fileName : 'Upload filled Excel file'}
            </p>
            <p className="text-[12px] text-surface-muted">.xlsx only — uses the &quot;PO Import&quot; sheet</p>
          </label>
          {fileName && !busy && (
            <div className="mt-2 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={clearFile} disabled={disabled}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {localError && <p className="text-[13px] text-red-600">{localError}</p>}

      {parsed && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#E2E6DC] p-3 text-[13px]">
            <p className="font-medium text-gray-900">Client from sheet</p>
            <p className="mt-1 text-surface-muted">
              {parsed.client.client_company || '—'} · {parsed.client.client_name || '—'}
            </p>
            {(parsed.client.client_email || parsed.client.client_phone) && (
              <p className="text-surface-muted">
                {[parsed.client.client_email, parsed.client.client_phone].filter(Boolean).join(' · ')}
              </p>
            )}
            {parsed.client.so_number && (
              <p className="text-surface-muted">SO: {parsed.client.so_number}</p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E2E6DC]">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead className="bg-[#FAFAF8] text-[11px] uppercase text-[#8A9488]">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Family</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Sub-category</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.products.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-[#E2E6DC]">
                    <td className="px-3 py-2 text-surface-muted">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.family || '—'}</td>
                    <td className="px-3 py-2">{row.category || '—'}</td>
                    <td className="px-3 py-2">{row.sub_category || '—'}</td>
                    <td className="max-w-[200px] truncate px-3 py-2" title={row.description}>
                      {row.description || '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{row.quantity || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {row.unit_price != null && row.unit_price > 0
                        ? formatCurrency(row.unit_price)
                        : 'TBD'}
                    </td>
                    <td className="px-3 py-2">
                      {row.errors.length === 0 ? (
                        <span className="text-green-700">OK</span>
                      ) : (
                        <span className="text-red-600" title={row.errors.join('; ')}>
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsed.valid && (
            <div className="flex items-center gap-2 text-[13px] text-gray-900">
              <FileSpreadsheet className="h-4 w-4 text-brand-green-600" />
              <span>
                {parsed.lineItems.length} product{parsed.lineItems.length === 1 ? '' : 's'} ready
                {itemTotal > 0 ? ` · Item total ${formatCurrency(itemTotal)}` : ' · pricing TBD on some lines'}
              </span>
            </div>
          )}

          {!parsed.valid && parsed.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-[12px] text-red-700">
              <p className="font-medium">Fix these issues in the sheet and re-upload:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {parsed.errors.slice(0, 8).map((err) => (
                  <li key={err}>{err}</li>
                ))}
                {parsed.errors.length > 8 && (
                  <li>…and {parsed.errors.length - 8} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
