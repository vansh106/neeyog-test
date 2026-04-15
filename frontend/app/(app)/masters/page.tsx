'use client'

import { useMemo, useState } from 'react'
import { Database } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProducts, useClientConfig } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'

function formatProductSize(p: Product): string {
  if (p.size_inch != null && p.size_mm != null) {
    return `${p.size_inch}" (${p.size_mm}mm)`
  }
  if (p.size_inch != null) return `${p.size_inch}"`
  if (p.size_mm != null) return `${p.size_mm}mm`
  return '—'
}

function ProductTableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-[#E2E6DC] bg-white">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-48" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-5 w-20 rounded-full" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-16" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-4 py-3 text-right">
            <Skeleton className="ml-auto h-4 w-20" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-10" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="mx-auto h-2 w-2 rounded-full" />
          </td>
        </tr>
      ))}
    </tbody>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#E2E6DC] py-3 last:border-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">{label}</p>
      <p className="mt-1 text-[14px] text-gray-900">{value}</p>
    </div>
  )
}

export default function MastersPage() {
  const { data: products, isPending: productsPending } = useProducts()
  const { data: config, isPending: configPending, isError: configError, isFetched: configFetched } =
    useClientConfig()

  const [category, setCategory] = useState<string>('all')
  const list = products ?? []

  const categories = useMemo(() => {
    const set = new Set(list.map((p) => p.category).filter(Boolean))
    return Array.from(set).sort()
  }, [list])

  const filtered = useMemo(() => {
    if (category === 'all') return list
    return list.filter((p) => p.category === category)
  }, [list, category])

  const configEmpty = configFetched && !configPending && (configError || config == null)

  return (
    <PageShell title="Masters">
      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="catalog">Product Catalog</TabsTrigger>
          <TabsTrigger value="config">Client Config</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] text-surface-muted">
              <span className="font-medium text-gray-900">{filtered.length}</span> product
              {filtered.length === 1 ? '' : 's'}
              {category !== 'all' && (
                <span className="text-surface-muted"> in {category}</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#8A9488]">Category</span>
              <Select value={category} onValueChange={(v) => setCategory(v ?? 'all')}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Active</th>
                  </tr>
                </thead>
                {productsPending ? (
                  <ProductTableSkeleton />
                ) : filtered.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={7} className="p-0">
                        <EmptyState
                          icon={Database}
                          title="No products"
                          description="No products match this filter or the catalog is empty."
                        />
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody>
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-[#E2E6DC] bg-white text-[13px] transition-colors hover:bg-[#F4F5F0]"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                            {p.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-surface-muted">{formatProductSize(p)}</td>
                        <td className="px-4 py-3 text-surface-muted">{p.material ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-brand-gold-500">
                          {formatCurrency(p.base_price)}
                        </td>
                        <td className="px-4 py-3 text-surface-muted">{p.unit}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`mx-auto block size-2 rounded-full ${p.is_active ? 'bg-brand-green-400' : 'bg-gray-300'}`}
                            title={p.is_active ? 'Active' : 'Inactive'}
                            aria-label={p.is_active ? 'Active' : 'Inactive'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#E2E6DC] bg-[#F9FAF7] p-4 text-[13px] leading-relaxed text-[#8A9488]">
            To update prices, use the seed script with an updated XLSX file. Admin → Masters upload
            coming in next version.
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-0">
          {configPending ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-xl border border-[#E2E6DC]" />
              <Skeleton className="h-32 w-full rounded-xl border border-[#E2E6DC]" />
            </div>
          ) : configEmpty ? (
            <p className="text-[14px] text-surface-muted">No config loaded</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
                <h3 className="mb-1 text-[12px] font-semibold text-gray-900">Company Info</h3>
                <ConfigRow label="Company name" value={String(config!.company_name ?? '—')} />
                <ConfigRow label="Address" value={String(config!.address ?? '—')} />
                <ConfigRow label="GST number" value={String(config!.gst_number ?? '—')} />
              </div>
              <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
                <h3 className="mb-1 text-[12px] font-semibold text-gray-900">Pricing Config</h3>
                <ConfigRow
                  label="Default GST rate"
                  value={`${config!.default_gst_rate ?? '—'}%`}
                />
                <ConfigRow
                  label="Default P&amp;F rate"
                  value={`${config!.default_pf_rate ?? '—'}%`}
                />
                <ConfigRow
                  label="Quote validity (days)"
                  value={String(config!.quote_validity_days ?? '—')}
                />
              </div>
              <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm md:col-span-2 lg:col-span-1">
                <h3 className="mb-1 text-[12px] font-semibold text-gray-900">Contact Details</h3>
                <ConfigRow label="Phone" value={String(config!.phone ?? '—')} />
                <ConfigRow label="Email" value={String(config!.email ?? '—')} />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
