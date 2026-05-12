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

type PrejobCalculatedRow = Record<string, unknown> & {
  id?: unknown
  label?: unknown
  trip_name?: unknown
  trip_count?: unknown
  trip_num?: unknown
  trip_rate?: unknown
  manual_adjustment?: unknown
  calculated_total?: unknown
  raw_total?: unknown
  effective_total?: unknown
  final_total?: unknown
  include?: unknown
  notes?: unknown
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

function readPrejobLabel(row: Record<string, unknown>, calculated?: PrejobCalculatedRow) {
  return (
    calculated?.label ??
    calculated?.trip_name ??
    row.trip_name ??
    row.man_trip_name ??
    row.task
  )
}

export function enrichEstimateV2PrejobRows<TRow extends Record<string, unknown>>(params: {
  rawRows: TRow[]
  calculatedRows: PrejobCalculatedRow[]
}): TRow[] {
  const calculatedById = new Map(params.calculatedRows.map((row) => [asText(row.id), row]))
  const matchedIds = new Set<string>()

  const mergedRows = params.rawRows.map((row) => {
    const id = asText(row.id)
    const calculated = calculatedById.get(id)
    if (!calculated) return row
    matchedIds.add(id)
    const label = readPrejobLabel(row, calculated)

    return {
      ...row,
      ...calculated,
      label,
      trip_name: calculated.trip_name ?? label,
      trip_num: calculated.trip_num ?? calculated.trip_count ?? row.trip_num,
      trip_rate: calculated.trip_rate ?? row.trip_rate,
      manual_adjustment: calculated.manual_adjustment ?? row.manual_adjustment,
      calculated_total: calculated.calculated_total,
      raw_total: calculated.raw_total,
      effective_total: calculated.effective_total,
      final_total: calculated.final_total ?? calculated.effective_total,
      include: calculated.include ?? row.include,
      notes: calculated.notes ?? row.notes,
    }
  })

  const calculatedOnlyRows = params.calculatedRows.filter(
    (row) => !matchedIds.has(asText(row.id))
  ) as TRow[]
  return [...mergedRows, ...calculatedOnlyRows]
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
