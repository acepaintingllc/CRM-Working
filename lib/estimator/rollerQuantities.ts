export type RollerApplicatorQuantityReason =
  | 'empty'
  | 'not-number'
  | 'not-integer'
  | 'not-positive'

export type RollerApplicatorQuantityNormalization =
  | {
      ok: true
      input: unknown
      displayValue: string
      persistenceValue: string
      numberValue: number
      reason: null
    }
  | {
      ok: false
      input: unknown
      displayValue: string
      persistenceValue: null
      numberValue: null
      reason: RollerApplicatorQuantityReason
    }

export function normalizeRollerApplicatorQuantity(
  value: unknown
): RollerApplicatorQuantityNormalization {
  const displayValue = value == null ? '' : String(value).trim()
  if (!displayValue) {
    return {
      ok: false,
      input: value,
      displayValue,
      persistenceValue: null,
      numberValue: null,
      reason: 'empty',
    }
  }

  const numberValue = Number(displayValue)
  if (!Number.isFinite(numberValue)) {
    return {
      ok: false,
      input: value,
      displayValue,
      persistenceValue: null,
      numberValue: null,
      reason: 'not-number',
    }
  }

  if (!Number.isInteger(numberValue)) {
    return {
      ok: false,
      input: value,
      displayValue,
      persistenceValue: null,
      numberValue: null,
      reason: 'not-integer',
    }
  }

  if (numberValue <= 0) {
    return {
      ok: false,
      input: value,
      displayValue,
      persistenceValue: null,
      numberValue: null,
      reason: 'not-positive',
    }
  }

  return {
    ok: true,
    input: value,
    displayValue: String(numberValue),
    persistenceValue: String(numberValue),
    numberValue,
    reason: null,
  }
}
