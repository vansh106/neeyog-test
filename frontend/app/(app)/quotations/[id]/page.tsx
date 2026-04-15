'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FileText } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { useQuotation, useClientConfig, useEnquiry } from '@/lib/queries'
import { quotationsApi } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import type { QuotationLineItem } from '@/types'

function formatQuoteDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function QuotationDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Skeleton className="h-[520px] w-full rounded-xl border border-[#E2E6DC]" />
      </div>
      <div className="lg:col-span-2">
        <Skeleton className="h-[360px] w-full rounded-xl border border-[#E2E6DC]" />
      </div>
    </div>
  )
}

export default function QuotationDetailPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''

  const { data: quotation, isPending, isError } = useQuotation(id)
  const { data: clientConfig } = useClientConfig()
  const { data: linkedEnquiry } = useEnquiry(quotation?.enquiry_id ?? '')

  if (!id) {
    return (
      <PageShell title="Quotation">
        <EmptyState
          icon={FileText}
          title="Invalid quotation"
          description="No quotation id was provided in the URL."
        />
      </PageShell>
    )
  }

  if (isPending) {
    return (
      <PageShell title="Quotation">
        <QuotationDetailSkeleton />
      </PageShell>
    )
  }

  if (isError || !quotation) {
    return (
      <PageShell title="Quotation">
        <EmptyState
          icon={FileText}
          title="Quotation not found"
          description="This quotation may have been removed or the link is incorrect."
        />
      </PageShell>
    )
  }

  const companyName = clientConfig?.company_name || 'PARTH VALVES AND HOSES LLP'
  const address = clientConfig?.address || ''
  const gst = clientConfig?.gst_number || ''
  const phone = clientConfig?.phone || ''
  const email = clientConfig?.email || ''

  const pdfHref = quotationsApi.getPdfUrl(id)
  const lineItems = quotation.line_items ?? []

  return (
    <PageShell title={`Quote ${quotation.quote_number}`}>
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-surface-muted">
        <Link href="/quotations" className="text-brand-green-600 hover:underline">
          Quotations
        </Link>
        <span aria-hidden>/</span>
        <span className="font-mono text-brand-gold-500">{quotation.quote_number}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
            <div className="p-6 md:p-8">
              <header className="text-center">
                <p className="text-[18px] font-bold text-gray-900">{companyName}</p>
                <div className="mx-auto mt-2 max-w-xl space-y-0.5 text-[11px] leading-relaxed text-[#8A9488]">
                  {address && <p>{address}</p>}
                  <p className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">
                    {gst && <span>GST: {gst}</span>}
                    {phone && <span>Tel: {phone}</span>}
                    {email && <span>{email}</span>}
                  </p>
                </div>
                <div className="my-5 border-b border-[#E2E6DC]" />
                <h2 className="text-[20px] font-semibold text-brand-gold-500">QUOTATION</h2>
                <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] text-gray-700">
                  <span>
                    <span className="text-[#8A9488]">No. </span>
                    <span className="font-mono font-medium text-brand-gold-500">{quotation.quote_number}</span>
                  </span>
                  <span>
                    <span className="text-[#8A9488]">Date </span>
                    <span>{formatQuoteDate(quotation.created_at)}</span>
                  </span>
                </div>
              </header>

              <section className="mt-8 text-left">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">To</p>
                <div className="mt-2 space-y-1 text-[14px] text-gray-900">
                  <p className="font-semibold">{quotation.client_name}</p>
                  {quotation.client_company && <p>{quotation.client_company}</p>}
                  {quotation.client_email && (
                    <p className="text-surface-muted">{quotation.client_email}</p>
                  )}
                  {quotation.client_phone && (
                    <p className="text-surface-muted">{quotation.client_phone}</p>
                  )}
                </div>
              </section>

              <div className="mt-8 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                      <th className="px-2 py-2.5">Sr No</th>
                      <th className="px-2 py-2.5">Description</th>
                      <th className="px-2 py-2.5">Size</th>
                      <th className="px-2 py-2.5 text-right">Qty</th>
                      <th className="px-2 py-2.5">Unit</th>
                      <th className="px-2 py-2.5 text-right">Unit Price</th>
                      <th className="px-2 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line: QuotationLineItem, idx: number) => (
                      <tr
                        key={idx}
                        className={cn(
                          'border-b border-[#E2E6DC] text-[13px]',
                          idx % 2 === 1 ? 'bg-[#F9FAF7]' : 'bg-white',
                        )}
                      >
                        <td className="px-2 py-2.5 text-surface-muted">{idx + 1}</td>
                        <td className="max-w-[200px] px-2 py-2.5 text-gray-900">
                          {line.product_name || line.description}
                        </td>
                        <td className="px-2 py-2.5 text-surface-muted">{line.size || '—'}</td>
                        <td className="px-2 py-2.5 text-right font-mono">{line.quantity}</td>
                        <td className="px-2 py-2.5 text-surface-muted">{line.unit}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-gray-800">
                          {formatCurrency(line.unit_price)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-gray-900">
                          {formatCurrency(line.line_total ?? line.total ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-[13px]">
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8A9488]">Subtotal</span>
                    <span className="font-mono text-gray-900">{formatCurrency(quotation.subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8A9488]">GST @ {quotation.gst_rate}%</span>
                    <span className="font-mono text-gray-900">{formatCurrency(quotation.gst_amount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8A9488]">P&amp;F @ {quotation.pf_rate}%</span>
                    <span className="font-mono text-gray-900">{formatCurrency(quotation.pf_amount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#8A9488]">Freight</span>
                    <span className="text-right text-gray-800">{quotation.freight_note || 'Extra at actual'}</span>
                  </div>
                  <div className="border-t border-[#E2E6DC] pt-2" />
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-gray-900">TOTAL</span>
                    <span className="text-[20px] font-bold font-mono text-brand-green-600">
                      {formatCurrency(quotation.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              <section className="mt-8 space-y-1 text-[12px] leading-relaxed text-[#8A9488]">
                <p>GST {quotation.gst_rate}% extra as applicable.</p>
                <p>P&amp;F {quotation.pf_rate}% extra as applicable.</p>
                <p>Freight extra at actual.</p>
                <p>Payment terms as per company policy / proforma invoice.</p>
                <p>Material Test Certificate (MTC) can be provided on request where applicable.</p>
              </section>

              {quotation.notes && (
                <section className="mt-6 rounded-lg border border-[#E2E6DC] bg-[#F9FAF7] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] text-gray-800">{quotation.notes}</p>
                </section>
              )}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Total</p>
              <p className="mt-1 text-[28px] font-bold font-mono text-brand-green-600">
                {formatCurrency(quotation.total_amount)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={quotation.status} />
              </div>
              <p className="mt-3 text-[13px] text-surface-muted">
                Created {formatQuoteDate(quotation.created_at)}
              </p>
              <p className="mt-1 text-[13px] text-surface-muted">
                Valid for {quotation.validity_days} day{quotation.validity_days === 1 ? '' : 's'} from issue
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href={pdfHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'default' }),
                  'w-full border-transparent bg-brand-green-500 text-white hover:bg-brand-green-600',
                )}
              >
                Download PDF
              </a>
              <a
                href={pdfHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'default' }),
                  'w-full border-[#E2E6DC]',
                )}
              >
                Open PDF in New Tab
              </a>
            </div>

            <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                Linked Enquiry
              </p>
              <Link
                href={`/enquiries/${quotation.enquiry_id}`}
                className="mt-2 inline-block font-mono text-[13px] text-brand-green-600 hover:underline"
              >
                {quotation.enquiry_id}
              </Link>
              {linkedEnquiry?.flow_type != null && linkedEnquiry.flow_type !== '' && (
                <p className="mt-2 text-[12px] text-surface-muted">
                  Flow:{' '}
                  <span className="font-medium text-gray-800">
                    {linkedEnquiry.flow_type.replace(/_/g, ' ')}
                  </span>
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  )
}
