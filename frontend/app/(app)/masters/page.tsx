'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Database } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
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
import { useProducts } from '@/lib/queries'
import { formatCurrency, formatPriceOrTbd } from '@/lib/utils'
import { suppliersApi } from '@/lib/api'
import type { Product, SupplierPriceRow, SupplierResponse } from '@/types'
import MastersEditor from '@/components/masters/MastersEditor'
import SupplierPricingTab from '@/components/masters/SupplierPricingTab'
import SuppliersTab from '@/components/masters/SuppliersTab'
import ClientsTab from '@/components/masters/ClientsTab'
import OthersMastersTab from '@/components/masters/OthersMastersTab'

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

function parseCatalogRefFromProductId(productId: string): { catalog_table: string; catalog_row_id: string } | null {
  const parts = String(productId || '').split(':')
  if (parts.length < 2) return null
  const catalog_table = parts[0]?.trim()
  const catalog_row_id = parts.slice(1).join(':').trim()
  if (!catalog_table || !catalog_row_id) return null
  return { catalog_table, catalog_row_id }
}

const MASTERS_TABS = new Set([
  'catalog',
  'edit',
  'others',
  'clients',
  'suppliers',
  'supplier-pricing',
])

export default function MastersPage() {
  const searchParams = useSearchParams()
  const defaultTab = (searchParams.get('tab') || 'catalog').toLowerCase()
  const initialCategory = searchParams.get('category') || undefined
  const initialTab = MASTERS_TABS.has(defaultTab) ? defaultTab : 'catalog'

  const { data: products, isPending: productsPending } = useProducts()

  const [category, setCategory] = useState<string>('all')
  const [supplierId, setSupplierId] = useState<string>('') // empty = no supplier filter (table unchanged)
  const list = products ?? []

  const { data: suppliers = [] } = useQuery<SupplierResponse[]>({
    queryKey: ['suppliers', 'active'],
    queryFn: () => suppliersApi.getSuppliers(true),
    staleTime: 60_000,
  })

  const supplierLabel = useMemo(() => {
    if (!supplierId) return null
    return suppliers.find((s) => s.id === supplierId)?.name ?? null
  }, [supplierId, suppliers])

  const categories = useMemo(() => {
    const set = new Set(list.map((p) => p.category).filter(Boolean))
    return Array.from(set).sort()
  }, [list])

  const filtered = useMemo(() => {
    if (category === 'all') return list
    return list.filter((p) => p.category === category)
  }, [list, category])

  const supplierPricingEnabled = Boolean(supplierId)
  const supplierPricingTable = category !== 'all' ? category : undefined
  const { data: supplierPrices = [] } = useQuery<SupplierPriceRow[]>({
    queryKey: ['supplierPrices', supplierId, supplierPricingTable ?? 'all'],
    queryFn: () => suppliersApi.getSupplierPrices(supplierId, supplierPricingTable),
    enabled: supplierPricingEnabled,
    staleTime: 30_000,
  })

  const supplierPriceByCatalogRowId = useMemo(() => {
    const map = new Map<string, SupplierPriceRow>()
    for (const r of supplierPrices) {
      map.set(`${r.catalog_table}:${r.catalog_row_id}`, r)
    }
    return map
  }, [supplierPrices])

  return (
    <PageShell title="Masters">
      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="mb-6 flex flex-wrap gap-1">
          <TabsTrigger value="catalog">Product Catalog</TabsTrigger>
          <TabsTrigger value="edit">Edit Masters</TabsTrigger>
          <TabsTrigger value="others">Others</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="supplier-pricing">Supplier pricing</TabsTrigger>
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

              <span className="ml-2 text-[12px] text-[#8A9488]">Supplier</span>
              <Select
                value={supplierId || '__none__'}
                onValueChange={(v) => setSupplierId(v === '__none__' || v == null ? '' : v)}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="No supplier">
                    {supplierLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">No supplier</span>
                  </SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.is_preferred ? ' ★' : ''}
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
                    {supplierPricingEnabled && <th className="px-4 py-3">Supplier</th>}
                    {supplierPricingEnabled && <th className="px-4 py-3 text-right">Supplier list price</th>}
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Active</th>
                  </tr>
                </thead>
                {productsPending ? (
                  <ProductTableSkeleton />
                ) : filtered.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={supplierPricingEnabled ? 8 : 6} className="p-0">
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
                    {filtered.map((p) => {
                      const ref = parseCatalogRefFromProductId(p.id)
                      const priceRow = ref
                        ? supplierPriceByCatalogRowId.get(`${ref.catalog_table}:${ref.catalog_row_id}`)
                        : undefined
                      return (
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
                          {supplierPricingEnabled && (
                            <td className="px-4 py-3 text-surface-muted">{supplierLabel ?? '—'}</td>
                          )}
                          {supplierPricingEnabled && (
                            <td className="px-4 py-3 text-right font-mono text-surface-muted">
                              {formatPriceOrTbd(priceRow?.list_price_inr ?? null)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-surface-muted">{p.unit}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`mx-auto block size-2 rounded-full ${p.is_active ? 'bg-brand-green-400' : 'bg-gray-300'}`}
                              title={p.is_active ? 'Active' : 'Inactive'}
                              aria-label={p.is_active ? 'Active' : 'Inactive'}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                )}
              </table>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#E2E6DC] bg-[#F9FAF7] p-4 text-[13px] leading-relaxed text-[#8A9488]">
            Prices are supplier-specific. Use the Suppliers tab / pricelist import to update list prices per supplier.
          </div>
        </TabsContent>

        <TabsContent value="edit" className="mt-0">
          <MastersEditor initialCategory={initialCategory} />
        </TabsContent>

        <TabsContent value="others" className="mt-0">
          <OthersMastersTab />
        </TabsContent>

        <TabsContent value="clients" className="mt-0">
          <ClientsTab />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-0">
          <SuppliersTab />
        </TabsContent>

        <TabsContent value="supplier-pricing" className="mt-0">
          <SupplierPricingTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
