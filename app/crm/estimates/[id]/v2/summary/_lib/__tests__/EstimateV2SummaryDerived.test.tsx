import { describe, expect, it } from 'vitest'
import {
  buildPaintSupplyRows,
  buildPriceBreakdownRows,
  buildRoomAlertsByRoom,
  buildRoomBlocks,
  buildRoomFlagCountMap,
  buildRoomScopeRows,
  buildSummaryAlerts,
  calculatePaintSuppliesTotal,
  createDisplayScopePaintCostCalculator,
  hasActiveLaborRateOverride,
  normalizeSummaryScopeRows,
} from '../estimateV2SummaryDerived'
import { SCOPE_KIND_LABELS, SCOPE_KIND_ORDER } from '@/lib/estimator/scopeKinds'
import type { EstimateV2PricingSummary, EstimateV2RoomInputRow } from '@/types/estimator/v2'

const rooms: EstimateV2RoomInputRow[] = [
  { id: 'room-1', room_id: 'room-1', room_name: 'Living Room' },
]

const pricingSummary: EstimateV2PricingSummary = {
  rawLaborHours: 10,
  rawLaborDays: 1.25,
  effectiveLaborDays: 1.25,
  effectiveLaborHours: 10,
  laborCost: 800,
  wallPaintMaterialCost: 120,
  ceilingPaintMaterialCost: 80,
  trimPaintMaterialCost: 40,
  paintMaterialCost: 240,
  primerMaterialCost: 30,
  supplyCost: 50,
  prePolicyTotal: 980,
  postLaborPolicyTotal: 1000,
  minimumAdjustmentAmount: 31,
  finalTotal: 1031,
  rooms: [{ room_id: 'room-1', baseTotal: 980, allocatedMinimumAdjustment: 31, finalTotal: 1031 }],
  trimPaint: null,
}

describe('estimateV2SummaryDerived helpers', () => {
  it('builds ordered room scope rows and room blocks from mixed-scope input', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-1',
          room_id: 'room-1',
          scope_name: 'Accent Wall',
          effective_area_sf: 120,
          effective_paint_hours: 3,
          effective_primer_hours: 1,
          effective_supply_cost: 20,
          effective_total: 400,
          paint_product_id: 'paint-1',
        },
      ]),
      ceilingScopes: normalizeSummaryScopeRows([
        {
          id: 'ceiling-1',
          room_id: 'room-1',
          scope_name: 'Main Ceiling',
          effective_area_sf: 80,
          effective_paint_hours: 2,
          effective_supply_cost: 10,
          effective_total: 250,
          paint_product_label: 'Ceiling White',
        },
      ]),
      trimScopes: normalizeSummaryScopeRows([
        {
          id: 'trim-1',
          room_id: 'room-1',
          scope_name: 'Baseboards',
          effective_measurement: 32,
          effective_paint_hours: 1,
          effective_supply_cost: 8,
          effective_total: 381,
          override_hours: 1,
        },
      ]),
    })
    const roomFlagCountMap = buildRoomFlagCountMap([{ id: 'flag-1', room_id: 'room-1', flag_id: 'warn-1' }])
    const roomAlertsByRoom = buildRoomAlertsByRoom({ rooms, roomFlagCountMap, roomScopeRows })
    const displayScopePaintCost = createDisplayScopePaintCostCalculator(80)
    const roomBlocks = buildRoomBlocks({
      rooms,
      roomScopeRows,
      roomTotalMap: new Map([['room-1', 1031]]),
      displayRoomTotalMap: new Map([['room-1', 1031]]),
      roomAreaMap: new Map([['room-1', 200]]),
      pricingSummaryFinalTotal: 1031,
      roomAlertsByRoom,
      displayScopePaintCost,
    })

    expect(roomScopeRows.get('room-1')?.map((scope) => scope.kind)).toEqual([
      'walls',
      'ceilings',
      'trim',
    ])
    expect(roomBlocks[0]?.scopes).toEqual(['Walls', 'Ceilings', 'Trim'])
    expect(roomBlocks[0]?.roomTotal).toBe(1031)
    expect(roomBlocks[0]?.displayScopeSubtotalMap.get('trim-1')).toBeTypeOf('number')
    expect(roomBlocks[0]?.alerts).toEqual({ missingProduct: 0, overrides: 1, flags: 1 })
    expect(roomBlocks[0]?.scopeRows.find((scope) => scope.id === 'trim-1')?.overrideSummary).toBe(
      'Override: Labor hours: 1 h'
    )
  })

  it('describes active wall and ceiling override fields for summary badges', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-1',
          room_id: 'room-1',
          scope_name: 'Walls',
          effective_area_sf: 120,
          effective_total: 400,
          paint_product_id: 'paint-1',
          override_area_sf: 130,
          override_supply_cost: 25.5,
        },
      ]),
      ceilingScopes: normalizeSummaryScopeRows([
        {
          id: 'ceiling-1',
          room_id: 'room-1',
          scope_name: 'Ceilings',
          effective_area_sf: 80,
          effective_total: 250,
          paint_product_label: 'Ceiling White',
          override_total: 275,
        },
      ]),
      trimScopes: [],
    })

    expect(roomScopeRows.get('room-1')?.find((scope) => scope.id === 'wall-1')?.overrideSummary).toBe(
      'Override: Area: 130 sf, Supply cost: $25.5'
    )
    expect(roomScopeRows.get('room-1')?.find((scope) => scope.id === 'ceiling-1')?.overrideSummary).toBe(
      'Override: Total: $275'
    )
  })

  it('does not treat blank override inputs as zero-value active overrides', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-1',
          room_id: 'room-1',
          scope_name: 'Walls',
          effective_area_sf: 120,
          effective_total: 400,
          paint_product_id: 'paint-1',
          override_area_sf: '',
          override_paint_hours: '',
          override_primer_hours: '',
          override_paint_gallons: '',
          override_primer_gallons: '',
          override_supply_cost: '',
          override_total: '',
        },
      ]),
      ceilingScopes: [],
      trimScopes: [],
    })
    const wallRow = roomScopeRows.get('room-1')?.find((scope) => scope.id === 'wall-1')

    expect(wallRow).toMatchObject({
      hasOverride: false,
      overrideSummary: null,
    })
  })

  it('generates missing-product, override, and clean summary alerts', () => {
    const missingProductRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-1',
          room_id: 'room-1',
          scope_name: 'Walls',
          effective_area_sf: 100,
          effective_total: 200,
        },
      ]),
      ceilingScopes: [],
      trimScopes: [],
    })

    expect(
      buildSummaryAlerts({
        pricingSummary,
        hasJobSettings: true,
        laborRateOverrideActive: false,
        roomScopeRows: missingProductRows,
        roomFlags: [{ id: 'flag-1', room_id: 'room-1', flag_id: 'warn-1' }],
        rooms,
      }).map((alert) => alert.title)
    ).toEqual([
      'Missing product selection',
      'Warning flags active',
    ])

    const overrideRows = buildRoomScopeRows({
      wallScopes: [],
      ceilingScopes: [],
      trimScopes: normalizeSummaryScopeRows([
        {
          id: 'trim-1',
          room_id: 'room-1',
          scope_name: 'Trim',
          effective_measurement: 20,
          effective_total: 150,
          override_total: 170,
        },
      ]),
    })

    expect(
      buildSummaryAlerts({
        pricingSummary,
        hasJobSettings: true,
        laborRateOverrideActive: false,
        roomScopeRows: overrideRows,
        roomFlags: [],
        rooms,
      })[0]
    ).toMatchObject({
      kind: 'warn',
      title: 'Manual override detected',
    })

    expect(
      buildSummaryAlerts({
        pricingSummary,
        hasJobSettings: true,
        laborRateOverrideActive: false,
        roomScopeRows: new Map(),
        roomFlags: [],
        rooms,
      })
    ).toEqual([
      { kind: 'info', title: 'No active alerts', detail: 'Estimate is currently clean' },
    ])
  })

  it('treats a persisted default labor rate as clean unless it differs from org defaults', () => {
    expect(
      hasActiveLaborRateOverride(
        { override_labor_rate: 65 },
        { override_labor_rate: 65 }
      )
    ).toBe(false)

    expect(
      hasActiveLaborRateOverride(
        { override_labor_rate: 70 },
        { override_labor_rate: 65 }
      )
    ).toBe(true)

    expect(hasActiveLaborRateOverride({ override_labor_rate: null }, { override_labor_rate: 65 })).toBe(false)
  })

  it('builds pricing rows and reconciles their totals against the displayed summary totals', () => {
    const priceRows = buildPriceBreakdownRows(pricingSummary)
    const paintRows = buildPaintSupplyRows(pricingSummary)

    expect(priceRows).toEqual([
      { label: 'Base Estimate / Pre-policy total', value: '$980' },
      { label: 'Labor Adjustment', value: '$20' },
      { label: 'Job Minimum', value: '$31' },
    ])
    expect(paintRows).toEqual([
      { label: 'Wall paint', value: '$120' },
      { label: 'Ceiling paint', value: '$80' },
      { label: 'Trim paint', value: '$40' },
      { label: 'Primer', value: '$30' },
      { label: 'Supplies', value: '$50' },
    ])
    expect(calculatePaintSuppliesTotal(pricingSummary)).toBe(290)
    expect(pricingSummary.prePolicyTotal + (pricingSummary.postLaborPolicyTotal - pricingSummary.prePolicyTotal) + pricingSummary.minimumAdjustmentAmount).toBe(
      pricingSummary.finalTotal
    )
  })

  it('keeps scope kind labels and ordering aligned with the shared single source of truth', () => {
    expect(SCOPE_KIND_ORDER.walls).toBeLessThan(SCOPE_KIND_ORDER.ceilings)
    expect(SCOPE_KIND_ORDER.ceilings).toBeLessThan(SCOPE_KIND_ORDER.trim)
    expect(SCOPE_KIND_LABELS).toEqual({
      walls: 'Walls',
      ceilings: 'Ceilings',
      trim: 'Trim',
    })
  })
})
