'use client'

import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatRelativeTime, truncateId } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EnquiryListItem } from '@/types'

export default function RecentEnquiries({ enquiries }: { enquiries: EnquiryListItem[] }) {
  const rows = enquiries.slice(0, 5)

  return (
    <div className="bg-white border border-[#E2E6DC] rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.3px] text-gray-900">Recent Enquiries</h2>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-surface-muted">No enquiries yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-[#E2E6DC] hover:bg-transparent">
              <TableHead className="text-[11px] font-medium text-surface-muted">ID</TableHead>
              <TableHead className="text-[11px] font-medium text-surface-muted">Flow</TableHead>
              <TableHead className="text-[11px] font-medium text-surface-muted">Status</TableHead>
              <TableHead className="text-[11px] font-medium text-surface-muted text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.enquiry_id} className="border-[#E2E6DC] hover:bg-[#F8FAF7]">
                <TableCell colSpan={4} className="p-0">
                  <Link
                    href={`/enquiries/${e.enquiry_id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_5.5rem] gap-3 items-center px-2 py-2.5 text-inherit no-underline"
                  >
                    <span className="font-mono text-[11px] text-surface-muted">{truncateId(e.enquiry_id)}</span>
                    <StatusBadge status={e.flow_type} />
                    <StatusBadge status={e.status} />
                    <span className="text-right text-[12px] text-surface-muted whitespace-nowrap">
                      {formatRelativeTime(e.created_at)}
                    </span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="px-5 py-3 border-t border-[#E2E6DC]">
        <Link href="/enquiries" className="text-[12px] font-medium text-brand-green-500 hover:text-brand-green-600">
          View all →
        </Link>
      </div>
    </div>
  )
}
