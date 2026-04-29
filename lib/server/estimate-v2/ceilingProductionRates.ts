import { asNullableNumber, asText } from '../../estimator/parsing.ts'
import type { CeilingCalculationScopeRow } from '../../estimator/ceilingTypes.ts'

type CeilingProductionRateRow = {
  id?: unknown
  scope_id?: unknown
  sqft_per_hr?: unknown
  prep_sqft_per_hr?: unknown
  primer_sqft_per_hr?: unknown
  active?: unknown
}

function normalizeId(value: unknown) {
  return asText(value).toUpperCase()
}

function positiveNumber(value: unknown) {
  const parsed = asNullableNumber(value)
  return parsed != null && parsed > 0 ? parsed : null
}

function isActive(row: CeilingProductionRateRow) {
  const active = normalizeId(row.active)
  return active !== 'N' && active !== 'FALSE' && active !== 'INACTIVE'
}

function isCeilingProductionRate(row: CeilingProductionRateRow) {
  const scope = normalizeId(row.scope_id)
  return scope === 'CEILINGS' || scope === 'CEILING' || scope === 'CEIL'
}

function resolveBaseCeilingProductionRate(rows: CeilingProductionRateRow[]) {
  const ceilingRows = rows.filter((row) => isActive(row) && isCeilingProductionRate(row))
  return (
    ceilingRows.find((row) => normalizeId(row.id) === 'CEIL_STD') ??
    ceilingRows[0] ??
    null
  )
}

export function applyBaseCeilingProductionRates<TScope extends CeilingCalculationScopeRow>(params: {
  scopes: TScope[]
  productionRates: CeilingProductionRateRow[]
}): TScope[] {
  const rate = resolveBaseCeilingProductionRate(params.productionRates)
  if (!rate) return params.scopes

  const paintRate = positiveNumber(rate.sqft_per_hr ?? rate.prep_sqft_per_hr)
  const primerRate = positiveNumber(rate.primer_sqft_per_hr)
  if (paintRate == null && primerRate == null) return params.scopes

  return params.scopes.map((scope) => ({
    ...scope,
    paint_prod_rate_sqft_per_hour:
      positiveNumber(scope.paint_prod_rate_sqft_per_hour) ?? paintRate,
    primer_prod_rate_sqft_per_hour:
      positiveNumber(scope.primer_prod_rate_sqft_per_hour) ?? primerRate,
  }))
}
