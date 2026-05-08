import { asText } from '../../estimator/parsing.ts'

type AccessFeeCalculatedRow = {
  id?: unknown
  label?: unknown
  group?: unknown
  catalogAmount?: unknown
  calculatedTotal?: unknown
  total?: unknown
  overridden?: unknown
}

export function enrichEstimateV2AccessFeeRows<TRow extends Record<string, unknown>>(params: {
  rawRows: TRow[]
  calculatedRows: AccessFeeCalculatedRow[]
}): TRow[] {
  const calculatedById = new Map(params.calculatedRows.map((row) => [asText(row.id), row]))

  return params.rawRows.map((row) => {
    const calculated = calculatedById.get(asText(row.id))
    if (!calculated) return row

    return {
      ...row,
      label: calculated.label,
      access_group: calculated.group,
      catalog_amount: calculated.catalogAmount,
      calculated_total: calculated.calculatedTotal,
      effective_total: calculated.total,
      overridden: calculated.overridden,
    }
  })
}

export function enrichEstimateV2OtherRows<
  TRawRow extends Record<string, unknown>,
  TCalculatedRow extends Record<string, unknown>,
>(params: {
  rawRows: TRawRow[]
  calculatedRows: TCalculatedRow[]
}): TRawRow[] {
  const calculatedById = new Map(params.calculatedRows.map((row) => [asText(row.id), row]))

  return params.rawRows.map((row) => {
    const calculated = calculatedById.get(asText(row.id))
    return calculated ? { ...row, ...calculated } : row
  })
}
