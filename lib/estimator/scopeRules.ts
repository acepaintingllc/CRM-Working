import { n, pos, round4 } from './wallsHelpers.ts'
import type { PrimeMode, SupplyRateRow } from './wallsTypes.ts'

export const HIDDEN_CEILING_COLOR_ID = 'COLOR0'
function normalizeKey(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function scopeMatches(rowScope: string | null | undefined, scope: 'walls' | 'ceilings' | 'trim') {
  const normalized = normalizeKey(rowScope)
  if (scope === 'walls') return normalized === 'wall' || normalized === 'walls'
  if (scope === 'ceilings') return normalized === 'ceiling' || normalized === 'ceilings'
  return normalized === 'trim'
}

export function isPrimerSupplyMode(primeMode: PrimeMode) {
  return primeMode === 'SPOT' || primeMode === 'FULL'
}

export function resolvePrimerSupplyCost(params: {
  primeMode: PrimeMode
  scope: 'walls' | 'ceilings' | 'trim'
  suppliesRates: SupplyRateRow[] | null | undefined
}) {
  if (!isPrimerSupplyMode(params.primeMode)) return 0
  for (const row of params.suppliesRates ?? []) {
    const text = normalizeKey(`${row.key} ${row.unit}`)
    if (!text.includes('primer')) continue
    if (!scopeMatches(row.scope, params.scope)) continue
    return pos(n(row.value)) ?? 0
  }
  return 0
}

export function deductBaseboardOpenings(
  rawMeasurement: number | null,
  openingCount: number | null,
  deductionLf: number
) {
  if (rawMeasurement == null) return null
  const openings = Math.max(0, openingCount ?? 0)
  return round4(Math.max(rawMeasurement - openings * deductionLf, 0))
}
