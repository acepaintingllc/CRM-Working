import { asText } from './parsing.ts'

export type RollerApplicatorQuantityReason =
  | 'empty'
  | 'not-number'
  | 'not-integer'
  | 'not-positive'

export type RollerApplicatorQuantityResult =
  | {
      ok: true
      displayValue: string
      value: number
    }
  | {
      ok: false
      displayValue: string
      reason: RollerApplicatorQuantityReason
    }

export function normalizeRollerApplicatorQuantity(
  value: unknown
): RollerApplicatorQuantityResult {
  const displayValue = asText(value)
  if (!displayValue) return { ok: false, displayValue, reason: 'empty' }

  const numeric = Number(displayValue)
  if (!Number.isFinite(numeric)) return { ok: false, displayValue, reason: 'not-number' }
  if (!Number.isInteger(numeric)) return { ok: false, displayValue, reason: 'not-integer' }
  if (numeric <= 0) return { ok: false, displayValue, reason: 'not-positive' }

  return { ok: true, displayValue: String(numeric), value: numeric }
}
