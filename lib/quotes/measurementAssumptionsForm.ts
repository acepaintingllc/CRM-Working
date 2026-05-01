import type { QuoteMeasurementAssumptions } from '../settings/types.ts'

type Unsafe = Record<string, unknown>

export const emptyQuoteMeasurementAssumptions: QuoteMeasurementAssumptions = {
  standard_door_deduction_sf: 21,
  standard_window_deduction_sf: 15,
  baseboard_opening_deduction_lf: 3,
}

function asMaybeNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeQuoteMeasurementAssumptions(
  value: Unsafe | null | undefined
): QuoteMeasurementAssumptions {
  return {
    standard_door_deduction_sf:
      asMaybeNumber(value?.standard_door_deduction_sf) ??
      emptyQuoteMeasurementAssumptions.standard_door_deduction_sf,
    standard_window_deduction_sf:
      asMaybeNumber(value?.standard_window_deduction_sf) ??
      emptyQuoteMeasurementAssumptions.standard_window_deduction_sf,
    baseboard_opening_deduction_lf:
      asMaybeNumber(value?.baseboard_opening_deduction_lf) ??
      emptyQuoteMeasurementAssumptions.baseboard_opening_deduction_lf,
  }
}

export function parseQuoteMeasurementAssumptions(value: unknown) {
  if (!value || typeof value !== 'object') {
    return { ok: false as const, error: 'Missing measurement assumptions payload.' }
  }

  const normalized = normalizeQuoteMeasurementAssumptions(value as Unsafe)
  const invalidField = Object.entries(normalized).find(([, amount]) => amount < 0)
  if (invalidField) {
    return { ok: false as const, error: 'Measurement deductions cannot be negative.' }
  }

  return { ok: true as const, data: normalized }
}
