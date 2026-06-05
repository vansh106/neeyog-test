import { suppliersApi } from '@/lib/api'
import type { AccessoryItem, OperatorKey, OperatorModel, ValveProduct } from '@/types'

export type SupplierPriceComponentKey =
  | 'valve'
  | 'fitting_end_1'
  | 'fitting_end_2'
  | 'operator'
  | 'sov'
  | 'lsb'
  | 'positioner'

export async function fetchSupplierListPriceInr(
  supplierId: string,
  catalogTable: string,
  catalogRowId: string,
): Promise<number | null> {
  const sid = supplierId.trim()
  const table = catalogTable.trim()
  const rowId = catalogRowId.trim()
  if (!sid || !table || !rowId) return null
  try {
    const pr = await suppliersApi.getProductPrice(sid, table, rowId)
    if (pr?.list_price_inr == null) return null
    const n = Number(pr.list_price_inr)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function catalogPartForSupplierPrice(
  key: SupplierPriceComponentKey,
  ctx: {
    resolvedValve: ValveProduct | null
    resolvedFittingEnd1: ValveProduct | null
    resolvedFittingEnd2: ValveProduct | null
    operatorModel: OperatorModel | null
    operatorKey: OperatorKey | null
    sov: AccessoryItem | null
    lsb: AccessoryItem | null
    positioner: AccessoryItem | null
  },
): { catalog_table: string; catalog_row_id: string } | null {
  if (key === 'valve' && ctx.resolvedValve?.id && ctx.resolvedValve.catalog_category) {
    return {
      catalog_table: ctx.resolvedValve.catalog_category,
      catalog_row_id: String(ctx.resolvedValve.id),
    }
  }
  if (
    key === 'fitting_end_1' &&
    ctx.resolvedFittingEnd1?.id &&
    ctx.resolvedFittingEnd1.catalog_category
  ) {
    return {
      catalog_table: ctx.resolvedFittingEnd1.catalog_category,
      catalog_row_id: String(ctx.resolvedFittingEnd1.id),
    }
  }
  if (
    key === 'fitting_end_2' &&
    ctx.resolvedFittingEnd2?.id &&
    ctx.resolvedFittingEnd2.catalog_category
  ) {
    return {
      catalog_table: ctx.resolvedFittingEnd2.catalog_category,
      catalog_row_id: String(ctx.resolvedFittingEnd2.id),
    }
  }
  if (
    key === 'operator' &&
    (ctx.operatorKey === 'da' || ctx.operatorKey === 'sa') &&
    ctx.operatorModel?.id
  ) {
    return { catalog_table: 'operator', catalog_row_id: String(ctx.operatorModel.id) }
  }
  if (key === 'sov' && ctx.sov?.id) {
    return { catalog_table: 'sov', catalog_row_id: String(ctx.sov.id) }
  }
  if (key === 'lsb' && ctx.lsb?.id) {
    return { catalog_table: 'limit_switch_box', catalog_row_id: String(ctx.lsb.id) }
  }
  if (key === 'positioner' && ctx.positioner?.id) {
    return { catalog_table: 'positioner', catalog_row_id: String(ctx.positioner.id) }
  }
  return null
}
