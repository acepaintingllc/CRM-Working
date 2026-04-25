import { asMaybeNumber } from '@/lib/estimator/parsing'
import type { UnsafeRecord } from '@/types/estimator/v2'

export type EstimateV2DetailsWallCalculationRow = {
  id: string
  effectiveAreaSf: number | null
  rawPaintGallons: number | null
}

export type EstimateV2DetailsCeilingCalculationRow = {
  id: string
  effectiveAreaSf: number | null
  rawPaintGallons: number | null
}

export type EstimateV2DetailsTrimCalculationRow = {
  id: string
  effectiveMeasurement: number | null
  rawPaintGallons: number | null
}

export type EstimateV2DetailsAggregateCalculationRow =
  | EstimateV2DetailsCeilingCalculationRow
  | EstimateV2DetailsTrimCalculationRow

export type EstimateV2DetailsCalculationRows = {
  wallCalculationRows: EstimateV2DetailsWallCalculationRow[] | null
  ceilingCalculationRows: EstimateV2DetailsCeilingCalculationRow[] | null
  trimCalculationRows: EstimateV2DetailsTrimCalculationRow[] | null
}

export function calculationRowsById<T extends { id: string }>(rows: T[] | null | undefined) {
  return new Map((rows ?? []).map((row) => [row.id, row] as const))
}

function isUnsafeRecord(value: unknown): value is UnsafeRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractCalculationScopeRows<TRow>(
  payload: unknown,
  parseRow: (row: UnsafeRecord) => TRow
): TRow[] | null {
  if (!isUnsafeRecord(payload)) return null
  if (!Array.isArray(payload.scopes)) return null
  return payload.scopes.filter(isUnsafeRecord).map(parseRow)
}

function parseCalculationId(row: UnsafeRecord) {
  return String(row.id ?? '')
}

function parseWallCalculationRow(row: UnsafeRecord): EstimateV2DetailsWallCalculationRow {
  return {
    id: parseCalculationId(row),
    effectiveAreaSf: asMaybeNumber(row.effective_area_sf),
    rawPaintGallons: asMaybeNumber(row.raw_paint_gallons),
  }
}

function parseCeilingCalculationRow(row: UnsafeRecord): EstimateV2DetailsCeilingCalculationRow {
  return {
    id: parseCalculationId(row),
    effectiveAreaSf: asMaybeNumber(row.effective_area_sf),
    rawPaintGallons: asMaybeNumber(row.raw_paint_gallons),
  }
}

function parseTrimCalculationRow(row: UnsafeRecord): EstimateV2DetailsTrimCalculationRow {
  return {
    id: parseCalculationId(row),
    effectiveMeasurement: asMaybeNumber(row.effective_measurement),
    rawPaintGallons: asMaybeNumber(row.raw_paint_gallons),
  }
}

export function extractEstimateV2DetailsCalculationRows(payloads: {
  wallCalculations: unknown
  ceilingCalculations: unknown
  trimCalculations: unknown
}): EstimateV2DetailsCalculationRows {
  return {
    wallCalculationRows: extractCalculationScopeRows(
      payloads.wallCalculations,
      parseWallCalculationRow
    ),
    ceilingCalculationRows: extractCalculationScopeRows(
      payloads.ceilingCalculations,
      parseCeilingCalculationRow
    ),
    trimCalculationRows: extractCalculationScopeRows(
      payloads.trimCalculations,
      parseTrimCalculationRow
    ),
  }
}
