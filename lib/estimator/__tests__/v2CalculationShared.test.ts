import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBaseCeilingProductionRates,
  applySelectedWallProductionRates,
  buildAccessFeeDrafts,
  buildEstimatorV2CalculationSettings,
  buildTrimPaintInput,
  resolveEstimatorV2EffectiveJobSettings,
  resolveEstimatorV2RoomModeById,
  toDoorCalculationCatalogs,
  toDrywallCalculationCatalogs,
  toTrimCalculationCatalogs,
  toWallCalculationCatalogs,
} from '../v2CalculationShared.ts'
import type { CeilingCalculationScopeRow } from '../ceilingTypes.ts'
import type { WallCalculationScopeRow } from '../wallsTypes.ts'

test('resolveEstimatorV2EffectiveJobSettings resolves payload values before org defaults and legacy primer aliases', () => {
  const settings = resolveEstimatorV2EffectiveJobSettings({
    jobsettings: {
      walls_paint_id: '',
      primer_id: 'payload-primer',
      trim_paint_id: 'payload-trim',
      labor_day_policy_enabled: false,
      crew_size: '3.8',
    },
    orgDefaults: {
      walls_paint_id: 'org-wall',
      walls_primer_id: 'org-wall-primer',
      trim_paint_id: 'org-trim',
      labor_day_policy_enabled: true,
      crew_size: 2,
    },
  })

  assert.equal(settings.walls_paint_id, 'org-wall')
  assert.equal(settings.walls_primer_id, 'payload-primer')
  assert.equal(settings.trim_paint_id, 'payload-trim')
  assert.equal(settings.labor_day_policy_enabled, false)
  assert.equal(settings.crew_size, 3.8)
  assert.equal(buildEstimatorV2CalculationSettings(settings).crew_size, 3)
})

test('production rate helpers apply catalog defaults without replacing explicit scope rates', () => {
  const [wallScope] = applySelectedWallProductionRates({
    rooms: [{ room_id: 'R001', wall_complexity_type_id: 'WALL_LIGHT' }],
    scopes: [{ id: 'wall-1', room_id: 'r001', paint_prod_rate_sqft_per_hour: null } as WallCalculationScopeRow],
    productionRates: [
      { id: 'WALL_LIGHT', scope_id: 'walls', sqft_per_hr: 150, primer_sqft_per_hr: 175 },
    ],
  })
  const [ceilingScope] = applyBaseCeilingProductionRates({
    scopes: [{ id: 'ceil-1', room_id: 'R001', primer_prod_rate_sqft_per_hour: 120 } as CeilingCalculationScopeRow],
    productionRates: [
      { id: 'CEIL_OTHER', scope_id: 'ceilings', sqft_per_hr: 80, primer_sqft_per_hr: 90, active: 'Y' },
      { id: 'CEIL_STD', scope_id: 'ceilings', sqft_per_hr: 140, primer_sqft_per_hr: 160, active: 'Y' },
    ],
  })

  assert.equal(wallScope.paint_prod_rate_sqft_per_hour, 150)
  assert.equal(wallScope.primer_prod_rate_sqft_per_hour, 175)
  assert.equal(ceilingScope.paint_prod_rate_sqft_per_hour, 140)
  assert.equal(ceilingScope.primer_prod_rate_sqft_per_hour, 120)
})

test('applySelectedWallProductionRates uses selected room wall complexity rates', () => {
  const [scope] = applySelectedWallProductionRates({
    rooms: [{ room_id: 'R001', wall_complexity_id: 'WALL_REPAINT_LIGHT' }],
    scopes: [{ id: 'wall-1', room_id: 'r001' } as WallCalculationScopeRow],
    productionRates: [
      {
        id: 'WALL_REPAINT_LIGHT',
        scope_id: 'WALLS',
        sqft_per_hr: 160,
        primer_sqft_per_hr: 180,
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 160)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 180)
})

test('applySelectedWallProductionRates uses standard repaint wall rate when room has no explicit wall rate', () => {
  const [scope] = applySelectedWallProductionRates({
    rooms: [{ room_id: 'R001', wall_complexity_id: '' }],
    scopes: [{ id: 'wall-1', room_id: 'r001' } as WallCalculationScopeRow],
    productionRates: [
      {
        id: 'WALL_REPAINT_STD',
        scope_id: 'WALLS',
        sqft_per_hr: 130,
        primer_sqft_per_hr: 150,
        active: 'Y',
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 130)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 150)
})

test('applySelectedWallProductionRates falls back to legacy WALL_STD and ignores inactive defaults', () => {
  const [scope] = applySelectedWallProductionRates({
    rooms: [{ room_id: 'R001', wall_complexity_id: null }],
    scopes: [{ id: 'wall-1', room_id: 'r001' } as WallCalculationScopeRow],
    productionRates: [
      {
        id: 'WALL_REPAINT_STD',
        scope_id: 'WALLS',
        sqft_per_hr: 130,
        primer_sqft_per_hr: 150,
        active: 'N',
      },
      {
        id: 'WALL_STD',
        scope_id: 'WALLS',
        sqft_per_hr: 120,
        primer_sqft_per_hr: 140,
        active: 'Y',
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 120)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 140)
})

test('applySelectedWallProductionRates keeps explicit wall scope production overrides', () => {
  const [scope] = applySelectedWallProductionRates({
    rooms: [{ room_id: 'R001', wall_complexity_id: 'WALL_REPAINT_LIGHT' }],
    scopes: [
      {
        id: 'wall-1',
        room_id: 'r001',
        paint_prod_rate_sqft_per_hour: 140,
        primer_prod_rate_sqft_per_hour: 155,
      } as WallCalculationScopeRow,
    ],
    productionRates: [
      {
        id: 'WALL_REPAINT_LIGHT',
        scope_id: 'WALLS',
        sqft_per_hr: 160,
        primer_sqft_per_hr: 180,
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 140)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 155)
})

test('applyBaseCeilingProductionRates uses the base ceiling production row', () => {
  const [scope] = applyBaseCeilingProductionRates({
    scopes: [{ id: 'ceil-1', room_id: 'R001' } as CeilingCalculationScopeRow],
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

test('applyBaseCeilingProductionRates prefers CEIL_STD and does not use arbitrary ceiling rows', () => {
  const [preferredScope] = applyBaseCeilingProductionRates({
    scopes: [{ id: 'ceil-1', room_id: 'R001' } as CeilingCalculationScopeRow],
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
  const [missingBaseScope] = applyBaseCeilingProductionRates({
    scopes: [{ id: 'ceil-1', room_id: 'R001' } as CeilingCalculationScopeRow],
    productionRates: [
      {
        id: 'CEIL_OTHER',
        scope_id: 'CEILINGS',
        sqft_per_hr: 90,
        primer_sqft_per_hr: 95,
        active: 'Y',
      },
    ],
  })

  assert.equal(preferredScope.paint_prod_rate_sqft_per_hour, 145)
  assert.equal(preferredScope.primer_prod_rate_sqft_per_hour, 175)
  assert.equal(missingBaseScope.paint_prod_rate_sqft_per_hour, undefined)
  assert.equal(missingBaseScope.primer_prod_rate_sqft_per_hour, undefined)
})

test('catalog mappers normalize calculation catalogs from route/catalog source rows', () => {
  const raw = {
    paint_products: [{ id: 'paint-1', name: 'Wall Paint', price_per_gal: '45', coverage_sqft_per_gal_per_coat: '350' }],
    supplies_rates: [{ key: 'shop', value: '12', crew_multiplier: 'Y' }],
    trim_items: [{ id: 'base', category: 'baseboard', unit: 'ea', helper_allowed: 'Y' }],
    production_rates: [{ id: 'base-rate', scope: 'base', units_per_hour: '8' }],
    door_types: [{ id: 'panel', label: 'Panel', labor_rate: '0.5', active: true }],
    drywall_rates: [{ id: 'patch', unit_rate_type: 'flat', unit: 'sf', amount: '25', active: true }],
  }

  const wallCatalogs = toWallCalculationCatalogs(raw)
  const trimCatalogs = toTrimCalculationCatalogs(raw)
  const doorCatalogs = toDoorCalculationCatalogs(raw)
  const drywallCatalogs = toDrywallCalculationCatalogs(raw)

  assert.equal(wallCatalogs.paint_products?.[0]?.price_per_gal, 45)
  assert.equal(wallCatalogs.supplies_rates?.[0]?.crew_multiplier, 'Y')
  assert.equal(trimCatalogs.trim_items[0]?.default_unit_type, 'EA')
  assert.equal(trimCatalogs.production_rates[0]?.units_per_hour, 8)
  assert.equal(doorCatalogs.door_unit_rates[0]?.id, 'PANEL')
  assert.equal(drywallCatalogs.drywall_unit_rates[0]?.unit, 'SF')
})

test('room mode, trim paint, and access draft helpers normalize shared calculation inputs', () => {
  const modes = resolveEstimatorV2RoomModeById({
    rooms: [{ room_id: 'r001', mode: 'SEG' }, { room_id: 'r002' }],
    wallScopes: [{ room_id: 'r002', mode: 'SEG' }],
    ceilingScopes: [],
    useRoomMode: true,
  })
  const trimPaint = buildTrimPaintInput({
    jobsettings: { trim_paint_qty: 3, trim_paint_uom: 'quart' },
    productId: 'trim-paint',
    product: { label: 'Trim Paint', price_per_gal: 80 },
  })
  const [accessDraft] = buildAccessFeeDrafts([
    { id: 'access-1', room_id: 'r001', access_fee_id: 'ladder', qty: 2, actual_cost_override: null, notes: null, position: 0 },
  ])

  assert.equal(modes.get('R001'), 'SEG')
  assert.equal(modes.get('R002'), 'SEG')
  assert.deepEqual(trimPaint, {
    paint_product_id: 'trim-paint',
    paint_product_label: 'Trim Paint',
    gallons: 0,
    quarts: 3,
    normalized_gallons: 0.75,
    paint_cost: 60,
  })
  assert.deepEqual(accessDraft, {
    id: 'access-1',
    roomId: 'R001',
    accessFeeId: 'ladder',
    qty: '2',
    actualCostOverride: '',
    notes: '',
    position: 0,
  })
})
