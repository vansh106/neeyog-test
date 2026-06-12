'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { mastersApi } from '@/lib/api'
import type { OthersCategory, OthersSheet } from '@/types'

const OTHERS_ROOT_KEY = 'Others'
const DEPTH_ROOT = 0
const DEPTH_CATEGORY = 1

export function othersMastersHref(categoryId: string, sheetId: string): string {
  const params = new URLSearchParams({
    tab: 'others',
    categoryId,
    sheetId,
  })
  return `/masters?${params.toString()}`
}

function categoryPathKey(categoryName: string): string {
  return `${OTHERS_ROOT_KEY}/${categoryName}`
}

export default function OthersSidebarNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const tab = searchParams.get('tab')
  const activeSheetId = searchParams.get('sheetId')
  const activeCategoryId = searchParams.get('categoryId')
  const isOthersRoute = pathname === '/masters' && tab === 'others'

  const { data, isPending } = useQuery({
    queryKey: ['othersMastersTree'],
    queryFn: () => mastersApi.getOthersTree<{ items: OthersCategory[] }>(),
    staleTime: 10_000,
  })
  const categories = data?.items ?? []

  const activeCategory = React.useMemo(
    () =>
      categories.find((c) => c.id === activeCategoryId) ??
      categories.find((c) => c.sheets.some((s) => s.id === activeSheetId)) ??
      null,
    [categories, activeCategoryId, activeSheetId],
  )

  const [openPaths, setOpenPaths] = React.useState<Set<string>>(() => new Set())

  React.useEffect(() => {
    if (!isOthersRoute) return
    setOpenPaths((prev) => {
      const next = new Set(prev)
      next.add(OTHERS_ROOT_KEY)
      if (activeCategory) next.add(categoryPathKey(activeCategory.name))
      return next
    })
  }, [isOthersRoute, activeCategory?.name, activeCategory])

  const togglePath = React.useCallback((pathKey: string) => {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return next
    })
  }, [])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['othersMastersTree'] })

  const createCategoryMut = useMutation({
    mutationFn: (name: string) => mastersApi.createOthersCategory(name),
    onSuccess: () => invalidate(),
  })

  const createSheetMut = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      mastersApi.createOthersSheet(categoryId, name),
    onSuccess: (sheet: OthersSheet) => {
      invalidate()
      setOpenPaths((prev) => {
        const next = new Set(prev)
        next.add(OTHERS_ROOT_KEY)
        const cat = categories.find((c) => c.id === sheet.category_id)
        if (cat) next.add(categoryPathKey(cat.name))
        return next
      })
    },
  })

  const onAddCategory = () => {
    const name = window.prompt('New categorisation name')
    if (!name?.trim()) return
    createCategoryMut.mutate(name.trim())
  }

  const onAddSheet = (categoryId: string, categoryName: string) => {
    const name = window.prompt('New sheet name')
    if (!name?.trim()) return
    createSheetMut.mutate(
      { categoryId, name: name.trim() },
      {
        onSuccess: (sheet: OthersSheet) => {
          window.location.href = othersMastersHref(categoryId, sheet.id)
        },
      },
    )
  }

  const othersRootOpen = openPaths.has(OTHERS_ROOT_KEY)
  const padRoot = 8 + DEPTH_ROOT * 10
  const padCategory = 8 + DEPTH_CATEGORY * 10
  const padSheet = 8 + (DEPTH_CATEGORY + 1) * 10

  return (
    <>
      <button
        type="button"
        onClick={() => togglePath(OTHERS_ROOT_KEY)}
        className={cn(
          'flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-left text-[12px] transition-colors',
          'font-medium text-[#a8c9ac] hover:bg-surface-sidebar2 hover:text-white',
          isOthersRoute && 'text-white',
        )}
        style={{ paddingLeft: padRoot }}
      >
        {othersRootOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 opacity-80" />
        )}
        <span className="truncate">Others</span>
      </button>

      {othersRootOpen && (
        <>
          <button
            type="button"
            onClick={onAddCategory}
            disabled={createCategoryMut.isPending}
            className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-[11px] text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white"
            style={{ paddingLeft: padCategory }}
          >
            {createCategoryMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3 shrink-0" />
            )}
            Add categorisation
          </button>

          {isPending ? (
            <div
              className="flex items-center gap-2 py-1.5 text-[11px] text-[#8AAF8E]"
              style={{ paddingLeft: padCategory }}
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : categories.length === 0 ? (
            <p className="py-1 text-[11px] text-[#6d8f72]" style={{ paddingLeft: padCategory }}>
              No categorisations yet
            </p>
          ) : (
            categories.map((cat) => {
              const catKey = categoryPathKey(cat.name)
              const catOpen = openPaths.has(catKey)
              return (
                <React.Fragment key={cat.id}>
                  <button
                    type="button"
                    onClick={() => togglePath(catKey)}
                    className={cn(
                      'flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-left text-[12px] transition-colors',
                      'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
                      activeCategory?.id === cat.id && isOthersRoute && 'text-white',
                    )}
                    style={{ paddingLeft: padCategory }}
                  >
                    {catOpen ? (
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-80" />
                    )}
                    <span className="truncate">{cat.name}</span>
                  </button>

                  {catOpen && (
                    <>
                      <button
                        type="button"
                        onClick={() => onAddSheet(cat.id, cat.name)}
                        disabled={createSheetMut.isPending}
                        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-[11px] text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white"
                        style={{ paddingLeft: padSheet }}
                      >
                        {createSheetMut.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3 shrink-0" />
                        )}
                        Add sheet
                      </button>

                      {cat.sheets.length === 0 ? (
                        <p
                          className="py-1 text-[11px] text-[#6d8f72]"
                          style={{ paddingLeft: padSheet }}
                        >
                          No sheets
                        </p>
                      ) : (
                        cat.sheets.map((sheet) => {
                          const active =
                            isOthersRoute && activeSheetId === sheet.id
                          return (
                            <Link
                              key={sheet.id}
                              href={othersMastersHref(cat.id, sheet.id)}
                              className={cn(
                                'flex items-center gap-2 rounded-md py-1.5 pr-2 text-[12px] transition-colors',
                                active
                                  ? 'bg-surface-sidebar2 text-white'
                                  : 'text-[#8AAF8E] hover:bg-surface-sidebar2 hover:text-white',
                              )}
                              style={{ paddingLeft: padSheet }}
                              title={sheet.name}
                            >
                              <span className="truncate">{sheet.name}</span>
                            </Link>
                          )
                        })
                      )}
                    </>
                  )}
                </React.Fragment>
              )
            })
          )}
        </>
      )}
    </>
  )
}
