import assert from 'node:assert/strict'
import test from 'node:test'
import { applyBaseCeilingProductionRates } from '../estimate-v2/ceilingProductionRates.ts'
import type { V2CeilingScopeSaveRow } from '../estimateV2RoutePayload.ts'

function makeScope(overrides: Partial<V2CeilingScopeSaveRow> = {}): V2CeilingScopeSaveRow {
  return {
    id: 'ceiling-1',
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: 'Main ceiling',
    area_sf: 120,
    length_in: null,
    width_in: null,
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    prime_mode: 'FULL',
    spot_prime_percent: null,
    ceiling_type_id: 'FLAT',
    height_factor: 1,
    complexity_factor: 1,
    ceiling_flag_factor: 1,
    override_area_sf: null,
    override_paint_hours: null,
    override_primer_hours: null,
    override_paint_gallons: null,
    override_primer_gallons: null,
    override_supply_cost: null,
    override_total: null,
    raw_area_sf: null,
    effective_area_sf: null,
    raw_paint_hours: null,
    effective_paint_hours: null,
    raw_primer_hours: null,
    effective_primer_hours: null,
    raw_paint_gallons: null,
    effective_paint_gallons: null,
    raw_primer_gallons: null,
    effective_primer_gallons: null,
    raw_supply_cost: null,
    effective_supply_cost: null,
    raw_total: null,
    effective_total: null,
    notes: null,
    ...overrides,
  }
}

test('applyBaseCeilingProductionRates uses the base ceiling production row for paint and primer rates', () => {
  const [scope] = applyBaseCeilingProductionRates({
    scopes: [makeScope()],
    productionRates: [
      {
        id: 'CEIL_STD',
        scope_id: 'CEILINGS',
        sqft_per_hr: 145,
        primer_sqft_per_hr: 175,
        active: 'Y',
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 145)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 175)
})

test('applyBaseCeilingProductionRates keeps explicit ceiling scope production overrides', () => {
  const [scope] = applyBaseCeilingProductionRates({
    scopes: [
      makeScope({
        paint_prod_rate_sqft_per_hour: 125,
        primer_prod_rate_sqft_per_hour: 155,
      }),
    ],
    productionRates: [
      {
        id: 'CEIL_STD',
        scope_id: 'CEILINGS',
        sqft_per_hr: 145,
        primer_sqft_per_hr: 175,
        active: 'Y',
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 125)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 155)
})

test('applyBaseCeilingProductionRates prefers CEIL_STD over other active ceiling rows', () => {
  const [scope] = applyBaseCeilingProductionRates({
    scopes: [makeScope()],
    productionRates: [
      {
        id: 'CEIL_OTHER',
        scope_id: 'CEILINGS',
        sqft_per_hr: 90,
        primer_sqft_per_hr: 95,
        active: 'Y',
      },
      {
        id: 'CEIL_STD',
        scope_id: 'CEILINGS',
        sqft_per_hr: 145,
        primer_sqft_per_hr: 175,
        active: 'Y',
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 145)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 175)
})
