import { DEFAULT_LABOR_RATE } from '../estimator/defaults.ts'
import type { EstimateDefaults } from './types.ts'

type Unsafe = Record<string, unknown>

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export const emptyEstimateDefaults: EstimateDefaults = {
  walls_paint_id: null,
  walls_primer_id: null,
  ceiling_paint_id: null,
  ceiling_primer_id: null,
  trim_paint_id: null,
  trim_primer_id: null,
  override_labor_rate: DEFAULT_LABOR_RATE,
}

function asNullableText(value: unknown) {
  const text = value == null ? '' : String(value).trim()
  return text || null
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeEstimateDefaults(row: Unsafe | null | undefined): EstimateDefaults {
  return {
    walls_paint_id: asNullableText(row?.walls_paint_id),
    walls_primer_id: asNullableText(row?.walls_primer_id),
    ceiling_paint_id: asNullableText(row?.ceiling_paint_id),
    ceiling_primer_id: asNullableText(row?.ceiling_primer_id),
    trim_paint_id: asNullableText(row?.trim_paint_id),
    trim_primer_id: asNullableText(row?.trim_primer_id),
    override_labor_rate: asNumber(row?.override_labor_rate) ?? emptyEstimateDefaults.override_labor_rate,
  }
}

export function parseEstimateDefaults(input: unknown): ParseResult<EstimateDefaults> {
  const row = (input ?? null) as Unsafe | null
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ok: false, error: 'Missing estimate defaults payload.' }
  }

  const data = normalizeEstimateDefaults(row)
  if (data.override_labor_rate < 0 || data.override_labor_rate > 10000) {
    return { ok: false, error: 'Labor rate must be between 0 and 10000.' }
  }
  return { ok: true, data }
}

export function getEstimateDefaultsValidationError(data: EstimateDefaults) {
  const parsed = parseEstimateDefaults(data)
  return parsed.ok ? null : parsed.error
}
