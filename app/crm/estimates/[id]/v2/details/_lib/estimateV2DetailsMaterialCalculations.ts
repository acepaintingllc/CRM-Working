import { asMaybeNumber } from '@/lib/estimator/parsing'
import type { UnsafeRecord } from '@/types/estimator/v2'

export type EstimateV2DetailsWallCalculationRow = {
  id: string
  effectiveAreaSf: number | null
  rawPaintGallons: number | null
  paintProductId?: string | null
}

export type EstimateV2DetailsCeilingCalculationRow = {
  id: string
  effectiveAreaSf: number | null
  rawPaintGallons: number | null
  paintProductId?: string | null
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

function extractWallCalculationRows(payload: unknown): EstimateV2DetailsWallCalculationRow[] | null {
  if (!isUnsafeRecord(payload)) return null
  if (!Array.isArray(payload.scopes)) return null
  const rowsById = new Map<string, EstimateV2DetailsWallCalculationRow>()
  for (const row of payload.scopes.filter(isUnsafeRecord).map(parseWallCalculationRow)) {
    if (row.id) rowsById.set(row.id, row)
  }
  if (Array.isArray(payload.scope_traces)) {
    for (const trace of payload.scope_traces.filter(isUnsafeRecord).map(parseWallCalculationRow)) {
      if (!trace.id) continue
      const existing = rowsById.get(trace.id)
      rowsById.set(trace.id, {
        id: trace.id,
        effectiveAreaSf: existing?.effectiveAreaSf ?? trace.effectiveAreaSf,
        rawPaintGallons: existing?.rawPaintGallons ?? trace.rawPaintGallons,
        paintProductId: existing?.paintProductId ?? trace.paintProductId,
      })
    }
  }
  return Array.from(rowsById.values())
}

function parseCalculationId(row: UnsafeRecord) {
  return String(row.id ?? '')
}

function parseCalculationScopeId(row: UnsafeRecord) {
  return String(row.id ?? row.scope_id ?? row.scopeId ?? '')
}

function parseWallCalculationRow(row: UnsafeRecord): EstimateV2DetailsWallCalculationRow {
  return {
    id: parseCalculationScopeId(row),
    effectiveAreaSf: asMaybeNumber(
      row.effective_area_sf ?? row.effectiveAreaSf ?? (row.area as UnsafeRecord | undefined)?.effective_area_sf
    ),
    rawPaintGallons: asMaybeNumber(
      row.raw_paint_gallons ??
        row.rawPaintGallons ??
        ((row.gallons as UnsafeRecord | undefined)?.paint as UnsafeRecord | undefined)?.raw
    ),
    paintProductId: String(
      row.paint_product_id ??
        row.paintProductId ??
        ((row.paint_material as UnsafeRecord | undefined)?.paint_product_id) ??
        ''
    ) || null,
  }
}

function parseCeilingCalculationRow(row: UnsafeRecord): EstimateV2DetailsCeilingCalculationRow {
  return {
    id: parseCalculationId(row),
    effectiveAreaSf: asMaybeNumber(row.effective_area_sf ?? row.effectiveAreaSf),
    rawPaintGallons: asMaybeNumber(row.raw_paint_gallons ?? row.rawPaintGallons),
    paintProductId: String(row.paint_product_id ?? row.paintProductId ?? '') || null,
  }
}

function parseTrimCalculationRow(row: UnsafeRecord): EstimateV2DetailsTrimCalculationRow {
  return {
    id: parseCalculationId(row),
    effectiveMeasurement: asMaybeNumber(row.effective_measurement ?? row.effectiveMeasurement),
    rawPaintGallons: asMaybeNumber(row.raw_paint_gallons ?? row.rawPaintGallons),
  }
}

export function extractEstimateV2DetailsCalculationRows(payloads: {
  wallCalculations: unknown
  ceilingCalculations: unknown
  trimCalculations: unknown
}): EstimateV2DetailsCalculationRows {
  return {
    wallCalculationRows: extractWallCalculationRows(payloads.wallCalculations),
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
