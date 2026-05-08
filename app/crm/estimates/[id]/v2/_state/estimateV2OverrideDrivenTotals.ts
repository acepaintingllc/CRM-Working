function hasNonNegativeNumber(value: unknown) {
  if (value == null || value === '') return false
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
}

export function buildOverrideDrivenTotalById(params: {
  rows: Array<Record<string, unknown>>
  calculatedTotalById: Map<string, number | null>
  overrideKeys: string[]
}) {
  const next = new Map<string, number | null>()
  for (const row of params.rows) {
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const hasTotalDrivingOverride = params.overrideKeys.some((key) => hasNonNegativeNumber(row[key]))
    next.set(id, hasTotalDrivingOverride ? params.calculatedTotalById.get(id) ?? null : null)
  }
  return next
}
