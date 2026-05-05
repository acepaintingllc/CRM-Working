export type V2NumericOverrideField = {
  label: string
  value: unknown
}

const NUMERIC_INPUT_RE = /^\+?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

export function isBlankOrFiniteNonnegativeNumberInput(value: unknown) {
  if (value == null) return true
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0
  if (typeof value !== 'string') return false

  const raw = value.trim()
  if (!raw) return true
  if (!NUMERIC_INPUT_RE.test(raw)) return false

  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0
}

export function validateV2NumericOverrideFields(params: {
  issues: string[]
  scopeLabel: string
  fields: V2NumericOverrideField[]
}) {
  for (const field of params.fields) {
    if (isBlankOrFiniteNonnegativeNumberInput(field.value)) continue
    params.issues.push(
      `${params.scopeLabel}: ${field.label} override must be blank or a nonnegative finite number`
    )
  }
}
