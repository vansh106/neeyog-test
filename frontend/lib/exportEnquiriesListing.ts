import { enquiryDetailTypeLabel } from '@/lib/enquiryDetailType'
import { enquiryQuoteStatusLabel } from '@/lib/enquiryQuoteStatus'
import { formatEnquirySourceLabel } from '@/lib/enquirySource'
import {
  downloadListingExcelWorkbook,
  formatListingExportAge,
  formatListingExportDate,
  formatListingExportFollowUp,
  listingExportFilename,
  type ListingExcelColumn,
} from '@/lib/listingExportExcel'
import {
  filterItemsByCreatedAt,
  listingExportRangeLabel,
  type ListingExportRange,
} from '@/lib/listingExportRange'
import type { EnquiryListItem } from '@/types'

const COLUMNS: ListingExcelColumn[] = [
  { header: 'S.No.', key: 'serial', width: 8 },
  { header: 'Enq No.', key: 'enquiry_number', width: 14 },
  { header: 'Source', key: 'source', width: 14 },
  { header: 'Enquiry Type', key: 'enquiry_type', width: 16 },
  { header: 'Date', key: 'date', width: 14 },
  { header: 'Client', key: 'client', width: 24 },
  { header: 'Items Description', key: 'items_desc', width: 48 },
  { header: 'Notes', key: 'notes', width: 32 },
  { header: 'Age', key: 'age', width: 10 },
  { header: 'Quote Status', key: 'quote_status', width: 16 },
  { header: 'Quote Number', key: 'quote_number', width: 14 },
  { header: 'User', key: 'user', width: 16 },
  { header: 'Next Follow-up', key: 'next_follow_up', width: 14 },
]

function enquiryItemsDescription(e: EnquiryListItem): string {
  const lines = e.item_desc_lines ?? []
  const isQuoted = Boolean(e.quotation_id || e.quote_number)
  if (isQuoted && lines.length > 0) {
    return lines
      .map((l) => l.full?.trim() || l.short?.trim())
      .filter(Boolean)
      .join('\n\n')
  }
  if (lines.length > 0) {
    return lines
      .map((l) => l.full?.trim() || l.short?.trim())
      .filter(Boolean)
      .join('\n')
  }
  return e.item_desc_short?.trim() ?? ''
}

export async function exportEnquiriesListingExcel(
  enquiries: EnquiryListItem[],
  range: ListingExportRange,
): Promise<void> {
  const filtered = filterItemsByCreatedAt(enquiries, range)
  if (filtered.length === 0) {
    throw new Error('No enquiries found for the selected time period')
  }

  const rows = filtered.map((e, index) => ({
    serial: index + 1,
    enquiry_number: (e.enquiry_number || '').trim() || e.enquiry_id.slice(0, 8),
    source: formatEnquirySourceLabel(e.source),
    enquiry_type: enquiryDetailTypeLabel(e.enquiry_detail_type),
    date: formatListingExportDate(e.created_at),
    client: (e.client_org_name ?? '').trim() || '—',
    items_desc: enquiryItemsDescription(e),
    notes: (e.notes ?? '').trim(),
    age: formatListingExportAge(e.created_at),
    quote_status: enquiryQuoteStatusLabel(e.enquiry_quote_status),
    quote_number: e.quote_number ?? '',
    user: e.created_by_name ?? '',
    next_follow_up: formatListingExportFollowUp(e.next_follow_up_date),
  }))

  await downloadListingExcelWorkbook({
    sheetName: 'Enquiries',
    filename: listingExportFilename('enquiries', listingExportRangeLabel(range)),
    columns: COLUMNS,
    rows,
    groupIndexForRow: (rowIndex) => rowIndex,
  })
}
