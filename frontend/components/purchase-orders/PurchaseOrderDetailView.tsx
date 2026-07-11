'use client'

import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import { Building2, FileText, Package, Pencil, Receipt, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import type { PurchaseOrder, PurchaseOrderLineItem } from '@/types'

type Props = {
  po: PurchaseOrder
  canEdit?: boolean
  onEditOverview?: () => void
  onEditClient?: () => void
  onEditProducts?: () => void
  onEditFinancial?: () => void
}

function formatPoDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function lineTitle(line: PurchaseOrderLineItem): string {
  const raw = (line.product_name || line.description || 'Product').trim()
  return raw.split('\n')[0] || 'Product'
}

function lineDetails(line: PurchaseOrderLineItem): string | null {
  const raw = (line.product_name || line.description || '').trim()
  const lines = raw.split('\n').slice(1).map((l) => l.trim()).filter(Boolean)
  return lines.length > 0 ? lines.join('\n') : null
}

function DetailCard({
  title,
  icon: Icon,
  accent = 'navy',
  children,
  className,
  onEdit,
  editLabel = 'Edit',
}: {
  title: string
  icon: ComponentType<{ className?: string }>
  accent?: 'navy' | 'green' | 'gold'
  children: ReactNode
  className?: string
  onEdit?: () => void
  editLabel?: string
}) {
  const border =
    accent === 'green'
      ? 'border-t-brand-green-300'
      : accent === 'gold'
        ? 'border-t-brand-gold-300'
        : 'border-t-brand-navy-200'

  return (
    <section
      className={cn(
        'rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm border-t-2',
        border,
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-[#8A9488]" />
          <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
        </div>
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-[#E2E6DC] text-[12px]"
            onClick={onEdit}
          >
            <Pencil className="mr-1.5 size-3.5" />
            {editLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-gray-900">{value || '—'}</p>
    </div>
  )
}

export default function PurchaseOrderDetailView({
  po,
  canEdit = false,
  onEditOverview,
  onEditClient,
  onEditProducts,
  onEditFinancial,
}: Props) {
  const finCfg = po.financial_config ?? {}
  const itemTotal = po.subtotal
  const pfAmount = po.pf_amount
  const pfRate = po.pf_rate
  const freightAmount = Number(po.freight_amount ?? 0)
  const freightRate = po.freight_rate
  const freightNote = po.freight_note || 'Included'
  const taxableSubtotal = Math.round((itemTotal + pfAmount + freightAmount) * 100) / 100
  const gstAmount = po.gst_amount
  const cgstAmount = Number(finCfg.cgst_amount ?? gstAmount / 2)
  const sgstAmount = Number(finCfg.sgst_amount ?? gstAmount / 2)
  const igstAmount = Number(finCfg.igst_amount ?? 0)
  const showIgst = Boolean(finCfg.igst_applicable) && igstAmount > 0
  const showCgst = !showIgst && finCfg.cgst_applicable !== false && cgstAmount > 0
  const showSgst = !showIgst && finCfg.sgst_applicable !== false && sgstAmount > 0

  const pfLabel = pfRate != null ? `P & F (${Number(pfRate)}%)` : 'P & F'
  const freightLabel =
    freightAmount > 0 && freightRate != null ? `Freight (${Number(freightRate)}%)` : 'Freight'

  const concernPerson =
    po.client_name?.trim() &&
    po.client_company?.trim() &&
    po.client_name.trim().toLowerCase() !== po.client_company.trim().toLowerCase()
      ? po.client_name
      : null

  return (
    <div className="space-y-5">
      <DetailCard
        title="Order overview"
        icon={FileText}
        onEdit={canEdit ? onEditOverview : undefined}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="PO number" value={<span className="font-mono">{po.po_number}</span>} />
          <Field label="SO number" value={po.so_number ? <span className="font-mono">{po.so_number}</span> : '—'} />
          <Field
            label="SO date"
            value={po.so_date ? formatPoDate(`${po.so_date.slice(0, 10)}T12:00:00`) : '—'}
          />
          <Field label="Date" value={formatPoDate(po.created_at)} />
          <Field label="Type" value={po.po_type === 'quoted' ? 'Quoted' : 'Non-quoted'} />
          <Field
            label="Quote reference"
            value={
              po.quote_number && po.quotation_id ? (
                <Link href={`/quotations/${po.quotation_id}`} className="text-brand-navy-700 hover:underline">
                  {po.quote_number}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <Field label="Category" value={po.primary_category} />
          <Field label="Recorded by" value={po.created_by_name} />
          <Field label="Grand total" value={formatCurrency(po.total_amount)} />
        </div>
      </DetailCard>

      <DetailCard
        title="Client"
        icon={UserRound}
        accent="green"
        onEdit={canEdit && po.po_type === 'non_quoted' ? onEditClient : undefined}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3 sm:col-span-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-green-50 text-brand-green-700">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">{po.client_company || po.client_name}</p>
              {concernPerson ? (
                <p className="mt-0.5 text-[13px] text-surface-muted">{concernPerson}</p>
              ) : null}
            </div>
          </div>
          <Field label="Contact phone" value={po.client_phone} />
          <Field label="Email" value={po.client_email} />
        </div>
      </DetailCard>

      <DetailCard
        title="Products"
        icon={Package}
        accent="gold"
        onEdit={canEdit ? onEditProducts : undefined}
      >
        <div className="space-y-3">
          {po.line_items.map((line, idx) => {
            const disc =
              typeof line.customer_discount_pct === 'number' && Number.isFinite(line.customer_discount_pct)
                ? line.customer_discount_pct
                : 0
            const lineTotal = line.line_total ?? line.unit_price * line.quantity
            const details = lineDetails(line)
            const quoted =
              typeof line.quoted_unit_price === 'number' && line.quoted_unit_price !== line.unit_price
                ? line.quoted_unit_price
                : null

            return (
              <div
                key={idx}
                className="rounded-lg border border-[#E2E6DC] bg-[#FAFAF8] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                      Product {idx + 1}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-gray-900">{lineTitle(line)}</p>
                    {details ? (
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-surface-muted">
                        {details}
                      </pre>
                    ) : null}
                    {line.size ? (
                      <p className="mt-2 text-[12px] text-surface-muted">
                        <span className="font-medium text-gray-700">Size:</span> {line.size}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-right font-mono text-[15px] font-semibold text-gray-900">
                    {formatCurrency(lineTotal)}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 border-t border-[#E2E6DC] pt-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label="Quantity"
                    value={`${line.quantity} ${line.unit || 'Nos'}`}
                  />
                  <Field label="Unit price" value={formatCurrency(line.unit_price)} />
                  <Field label="Discount" value={disc ? `${disc}%` : '0%'} />
                  {quoted != null ? (
                    <Field label="Quoted price" value={formatCurrency(quoted)} />
                  ) : (
                    <Field label="Line total" value={formatCurrency(lineTotal)} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </DetailCard>

      <DetailCard
        title="Financial summary"
        icon={Receipt}
        onEdit={canEdit ? onEditFinancial : undefined}
      >
        <div className="flex justify-end">
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-[#E2E6DC] bg-[#FFF8E7]">
            <table className="w-full text-[13px]">
              <tbody>
                <FinRow label="Item total" value={formatCurrency(itemTotal)} />
                <FinRow label={pfLabel} value={formatCurrency(pfAmount)} />
                <FinRow
                  label={freightLabel}
                  value={freightAmount > 0 ? formatCurrency(freightAmount) : freightNote}
                />
                <FinRow label="Subtotal (taxable)" value={formatCurrency(taxableSubtotal)} bold />
                {showIgst && <FinRow label="IGST" value={formatCurrency(igstAmount)} />}
                {showCgst && <FinRow label="CGST (9%)" value={formatCurrency(cgstAmount)} />}
                {showSgst && <FinRow label="SGST (9%)" value={formatCurrency(sgstAmount)} />}
                <tr className="border-t-2 border-brand-gold-400 bg-brand-gold-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">Grand total</td>
                  <td className="px-4 py-3 text-right font-mono text-[15px] font-bold text-gray-900">
                    {formatCurrency(po.total_amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </DetailCard>

      {po.notes?.trim() || canEdit ? (
        <DetailCard
          title="Notes"
          icon={FileText}
          onEdit={canEdit ? onEditOverview : undefined}
          editLabel="Edit notes"
        >
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">
            {po.notes?.trim() || '—'}
          </p>
        </DetailCard>
      ) : null}
    </div>
  )
}

function FinRow({
  label,
  value,
  bold = false,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <tr className="border-b border-[#E2E6DC]/80 last:border-0">
      <td className={cn('px-4 py-2.5 text-surface-muted', bold && 'font-medium text-gray-900')}>
        {label}
      </td>
      <td
        className={cn(
          'px-4 py-2.5 text-right font-mono tabular-nums',
          bold ? 'font-medium text-gray-900' : 'text-gray-800',
        )}
      >
        {value}
      </td>
    </tr>
  )
}
