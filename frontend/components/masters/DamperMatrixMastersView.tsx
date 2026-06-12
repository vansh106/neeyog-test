'use client'

import { damperMatrixColumns, damperSheetLabel, getDamperFullSchema } from '@/lib/damperSchema'

type Props = {
  catalogKey: string
}

export default function DamperMatrixMastersView({ catalogKey }: Props) {
  const schema = getDamperFullSchema(catalogKey)
  const columns = damperMatrixColumns(catalogKey)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-navy-200 bg-brand-navy-50/40 p-4">
        <p className="text-[15px] font-semibold text-gray-900">{damperSheetLabel(catalogKey)}</p>
        <p className="mt-1 text-[13px] text-surface-muted">
          Matrix specification — any combination of column values is valid. Fields marked{' '}
          <span className="font-medium text-brand-gold-700">ME</span> are manual entry (optional) in
          quotations. Pricing is entered manually per quote (no catalog price).
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border bg-white shadow-sm">
        <table className="min-w-[960px] w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="bg-[#1e3a5f] text-[11px] font-semibold uppercase tracking-wide text-amber-200">
              <th className="border border-[#2a4a6f] px-2 py-2">Sr.No</th>
              <th className="border border-[#2a4a6f] px-2 py-2">Damper Type</th>
              {columns.map((col) => (
                <th
                  key={col.title}
                  colSpan={col.subColumns.length}
                  className="border border-[#2a4a6f] px-2 py-2 text-center"
                >
                  {col.title}
                </th>
              ))}
            </tr>
            <tr className="bg-[#2d6a6a] text-[10px] font-medium uppercase tracking-wide text-amber-100">
              <th className="border border-[#3a7a7a] px-2 py-1" />
              <th className="border border-[#3a7a7a] px-2 py-1" />
              {columns.map((col) =>
                col.subColumns.map((sub) => (
                  <th key={sub.key} className="border border-[#3a7a7a] px-2 py-1 text-center">
                    {sub.subLabel || '—'}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-surface-border bg-[#f8faf8] px-2 py-2 align-top font-mono">
                1
              </td>
              <td className="border border-surface-border bg-[#f8faf8] px-2 py-2 align-top font-medium">
                {schema.damper_type}
              </td>
              {columns.map((col) =>
                col.subColumns.map((sub) => (
                  <td
                    key={sub.key}
                    className="border border-surface-border px-2 py-2 align-top"
                  >
                    <ul className="space-y-0.5">
                      {sub.options.map((opt) => (
                        <li
                          key={opt}
                          className={
                            opt === 'ME'
                              ? 'font-semibold text-brand-gold-700'
                              : 'text-gray-800'
                          }
                        >
                          {opt}
                        </li>
                      ))}
                    </ul>
                  </td>
                )),
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
