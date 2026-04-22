import type { QuoteDefaults } from '@/lib/settings/types'
import { DEFAULT_LABOR_RATE } from '@/lib/estimator/defaults'

export function normalizeQuoteDefaults(
  value: Partial<QuoteDefaults> | null | undefined = {}
): QuoteDefaults {
  return {
    walls_paint_id: value?.walls_paint_id ?? null,
    walls_primer_id: value?.walls_primer_id ?? null,
    ceiling_paint_id: value?.ceiling_paint_id ?? null,
    ceiling_primer_id: value?.ceiling_primer_id ?? null,
    trim_paint_id: value?.trim_paint_id ?? null,
    trim_primer_id: value?.trim_primer_id ?? null,
    override_labor_rate: Number(value?.override_labor_rate ?? DEFAULT_LABOR_RATE),
  }
}

export function areQuoteDefaultsEqual(
  current: Partial<QuoteDefaults> | null | undefined,
  saved: Partial<QuoteDefaults> | null | undefined
) {
  const normalizedCurrent = normalizeQuoteDefaults(current)
  const normalizedSaved = normalizeQuoteDefaults(saved)

  return (
    normalizedCurrent.walls_paint_id === normalizedSaved.walls_paint_id &&
    normalizedCurrent.walls_primer_id === normalizedSaved.walls_primer_id &&
    normalizedCurrent.ceiling_paint_id === normalizedSaved.ceiling_paint_id &&
    normalizedCurrent.ceiling_primer_id === normalizedSaved.ceiling_primer_id &&
    normalizedCurrent.trim_paint_id === normalizedSaved.trim_paint_id &&
    normalizedCurrent.trim_primer_id === normalizedSaved.trim_primer_id &&
    normalizedCurrent.override_labor_rate === normalizedSaved.override_labor_rate
  )
}

export function validateQuoteDefaults(value: QuoteDefaults) {
  if (!Number.isFinite(value.override_labor_rate) || value.override_labor_rate < 0) {
    return {
      ok: false as const,
      error: 'Labor rate must be zero or greater.',
    }
  }

  return {
    ok: true as const,
    value,
  }
}
