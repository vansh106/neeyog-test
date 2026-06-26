'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ExternalLink,
  HandMetal,
  Loader2,
  RefreshCw,
  Search,
  Store,
} from 'lucide-react'

import IndiaMartPickupSheet from '@/components/indiamart/IndiaMartPickupSheet'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { indiamartApi } from '@/lib/api'
import { useIndiaMartQueries } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { IndiaMartPickupResponse, IndiaMartQueryItem } from '@/types'

function formatQueryTime(queryTime: string | null, createdAt?: string | null): string {
  const iso = queryTime || createdAt
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function relSyncTime(iso: string | null): string {
  if (!iso) return 'Never synced'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'Never synced'
  const mins = Math.floor((Date.now() - t) / 60000)
  if (mins < 1) return 'Synced just now'
  if (mins < 60) return `Synced ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `Synced ${hrs}h ago`
  return `Synced ${Math.floor(hrs / 24)}d ago`
}

function rowTone(row: IndiaMartQueryItem): string {
  if (row.is_archived) return 'bg-gray-50/80 opacity-70'
  if (row.is_picked_up) return 'bg-emerald-50/90 hover:bg-emerald-50'
  return 'bg-amber-50/70 hover:bg-amber-50'
}

export default function IndiaMartPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [pickupTarget, setPickupTarget] = useState<IndiaMartQueryItem | null>(null)
  const [pickupOpen, setPickupOpen] = useState(false)

  const { data, isPending, isFetching } = useIndiaMartQueries(showArchived)

  const syncMut = useMutation({
    mutationFn: () => indiamartApi.syncNow(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indiamart-queries'] }),
  })

  const archiveMut = useMutation({
    mutationFn: (id: string) => indiamartApi.archiveQuery(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indiamart-queries'] }),
  })

  const rows = useMemo(() => {
    const list = data?.queries ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((row) => {
      const blob = [
        row.sender_name,
        row.sender_company,
        row.sender_email,
        row.sender_mobile,
        row.query_product_name,
        row.query_message,
        row.unique_query_id,
        row.query_type_label,
        row.picked_up_by_name,
        row.enquiry_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [data?.queries, search])

  const openPickup = (row: IndiaMartQueryItem) => {
    if (!row.can_pickup) return
    setPickupTarget(row)
    setPickupOpen(true)
  }

  const handlePickedUp = (result: IndiaMartPickupResponse) => {
    qc.invalidateQueries({ queryKey: ['indiamart-queries'] })
    if (result.enquiry_id) {
      router.push(`/enquiries/${result.enquiry_id}`)
    }
  }

  return (
    <PageShell
      title="IndiaMart Leads"
      subtitle="Open leads sit in the bucket until someone picks them up and creates an enquiry."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-surface-muted">{relSyncTime(data?.last_sync_at ?? null)}</span>
          {data?.using_dummy_data && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Demo data (set INDIAMART_CRM_KEY)
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncMut.isPending || isFetching}
            onClick={() => syncMut.mutate()}
          >
            {syncMut.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Sync now
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px]">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-900">
          <span className="size-2 rounded-full bg-amber-400" />
          Available to pick up
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-900">
          <span className="size-2 rounded-full bg-emerald-500" />
          Picked up
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-surface-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search buyer, company, product, enquiry no…"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-gray-700">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show archived
        </label>
        <span className="text-[12px] text-surface-muted">{rows.length} lead{rows.length === 1 ? '' : 's'}</span>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No IndiaMart leads yet"
          description="Leads appear here after the first sync. Use Sync now or wait for the background job."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E2E6DC] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="border-b border-[#E2E6DC] bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-surface-muted">
                <tr>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Buyer / Company</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 min-w-[220px]">Message</th>
                  <th className="px-4 py-3">Pickup</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E6DC]/60">
                {rows.map((row) => (
                  <tr key={row.id} className={cn('transition-colors', rowTone(row))}>
                    <td className="px-4 py-3 align-top whitespace-nowrap text-surface-muted">
                      {formatQueryTime(row.query_time, row.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-gray-900">{row.sender_name || 'IndiaMart Buyer'}</div>
                      <div className="text-[12px] text-surface-muted">{row.sender_company || '—'}</div>
                      <div className="mt-1 text-[11px] text-surface-muted">
                        {[row.sender_city, row.sender_state].filter(Boolean).join(', ') || '—'}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600">
                        {row.sender_mobile || row.sender_email || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-gray-800">{row.query_product_name || '—'}</td>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex rounded-full border border-[#E2E6DC] bg-white/70 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                        {row.query_type_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="line-clamp-3 text-gray-700">{row.query_message || '—'}</p>
                      <p className="mt-1 font-mono text-[10px] text-surface-muted">{row.unique_query_id}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.is_picked_up ? (
                        <div className="space-y-1">
                          <p className="text-[12px] font-medium text-emerald-800">
                            {row.picked_up_by_name || 'Picked up'}
                          </p>
                          {row.enquiry_number ? (
                            <Link
                              href={`/enquiries/${row.enquiry_id}`}
                              className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-brand-green-700 hover:text-brand-green-800"
                            >
                              {row.enquiry_number}
                              <ExternalLink className="size-3" />
                            </Link>
                          ) : row.enquiry_id ? (
                            <Link
                              href={`/enquiries/${row.enquiry_id}`}
                              className="text-[12px] font-medium text-brand-green-600 hover:text-brand-green-700"
                            >
                              View enquiry
                            </Link>
                          ) : null}
                        </div>
                      ) : row.is_archived ? (
                        <span className="text-[12px] text-surface-muted">Archived</span>
                      ) : (
                        <span className="text-[12px] font-medium text-amber-800">In bucket</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex flex-col items-end gap-2">
                        {row.can_pickup ? (
                          <Button
                            type="button"
                            size="sm"
                            className="bg-brand-green-600 text-white hover:bg-brand-green-700"
                            onClick={() => openPickup(row)}
                          >
                            <HandMetal className="mr-1.5 size-4" />
                            Pick up
                          </Button>
                        ) : row.enquiry_id ? (
                          <Link
                            href={`/enquiries/${row.enquiry_id}`}
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                          >
                            Open enquiry
                          </Link>
                        ) : null}
                        {!row.is_archived && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-surface-muted"
                            disabled={archiveMut.isPending}
                            onClick={() => archiveMut.mutate(row.id)}
                          >
                            <Archive className="mr-1.5 size-3.5" />
                            Archive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <IndiaMartPickupSheet
        queryId={pickupTarget?.id ?? null}
        open={pickupOpen}
        onOpenChange={setPickupOpen}
        onPickedUp={handlePickedUp}
      />
    </PageShell>
  )
}
