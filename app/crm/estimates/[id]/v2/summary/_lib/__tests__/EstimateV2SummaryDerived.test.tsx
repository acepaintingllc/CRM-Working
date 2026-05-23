import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  buildPaintSupplyRows,
  buildPaintSupplyProductLabels,
  buildPriceBreakdownRows,
  buildRoomAlertsByRoom,
  buildRoomBlocks,
  buildRoomFlagCountMap,
  buildRoomScopeRows,
  buildSummaryAlerts,
  calculatePaintSuppliesTotal,
  createDisplayScopePaintCostCalculator,
  createPaintProductLabelResolver,
  normalizeSummaryScopeRows,
} from '../estimateV2SummaryDerived'
import { useEstimateV2SummaryDerived } from '../useEstimateV2SummaryDerived'
import {
  manualOverridesDisabledScopesFixture,
  multiRoomGeometryVariationFixture,
  simpleNoOverridesFixture,
  type EstimateV2CanonicalFixture,
} from '@/lib/estimator/__fixtures__/canonical/index.ts'
import { buildEstimateV2DirtySnapshot } from '@/app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot'
import { SCOPE_KIND_LABELS, SCOPE_KIND_ORDER } from '@/lib/estimator/scopeKinds'
import type { EstimateV2RoomInputRow } from '@/types/estimator/v2Rooms'
import type { EstimateV2PricingSummary, EstimateV2TrimPaint } from '@/types/estimator/v2Summary'
import {
  buildLocalCeilingScopeEffectiveAreaById,
  buildLocalDoorScopeEffectiveUnitsById,
  buildLocalDrywallRepairEffectiveQuantityById,
  buildLocalRoomEffectiveAreaByRoomId,
  buildLocalScopeEffectiveAreaById,
  buildLocalTrimScopeMetricById,
} from '@/app/crm/estimates/[id]/v2/_lib/estimateV2EditorDerived'
import { resolveRoomModeById } from '@/app/crm/estimates/[id]/v2/_lib/estimateV2EditorNormalize'
import { accessFee, CANONICAL_IDS } from '@/lib/estimator/__fixtures__/estimateV2CanonicalFixtureTypes'
import { reconcileWholeDollarRows } from '@/lib/estimator/pricingPolicies'

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

function dollars(rowValue: string) {
  if (rowValue === '-') return 0
  return Number(rowValue.replace(/[$,]/g, ''))
}

function scopeTotalMap(rows: EstimateV2CanonicalFixture['expectedTotals']['scopeTotals'][keyof EstimateV2CanonicalFixture['expectedTotals']['scopeTotals']]) {
  return new Map(rows.map((row) => [row.scopeId, row.total] as const))
}

function roomTotalMap(rows: EstimateV2CanonicalFixture['expectedTotals']['rooms']) {
  return new Map(rows.map((row) => [row.roomId, row.total] as const))
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function buildCanonicalSavedSummaryData(fixture: EstimateV2CanonicalFixture) {
  const { collections, meta } = fixture.editorState
  const doorScopes = collections.doorScopes ?? []
  const drywallRepairs = collections.drywallRepairs ?? []
  const payload = currentSnapshotPayload(fixture)
  const wallScopeAreaById = buildLocalScopeEffectiveAreaById(collections.scopes, collections.segments)
  const wallRoomAreaById = buildLocalRoomEffectiveAreaByRoomId(
    collections.rooms,
    collections.scopes,
    wallScopeAreaById
  )
  const ceilingAreaById = buildLocalCeilingScopeEffectiveAreaById({
    ceilingScopes: collections.ceilingScopes,
    ceilingSegments: collections.ceilingSegments,
    rooms: collections.rooms,
    ceilingTypes: meta.catalogs.ceiling_types,
  })
  const roomModeById = resolveRoomModeById({
    rooms: collections.rooms,
    wallScopes: collections.scopes,
    ceilingScopes: collections.ceilingScopes,
  })
  const trimMeasurementById = buildLocalTrimScopeMetricById({
    trimScopes: collections.trimScopes,
    rooms: collections.rooms,
    roomModeById,
    key: 'effective_measurement',
  })
  const doorUnitsById = buildLocalDoorScopeEffectiveUnitsById(doorScopes)
  const drywallQuantityById = buildLocalDrywallRepairEffectiveQuantityById(drywallRepairs)
  const wallTotals = scopeTotalMap(fixture.expectedTotals.scopeTotals.walls)
  const ceilingTotals = scopeTotalMap(fixture.expectedTotals.scopeTotals.ceilings)
  const trimTotals = scopeTotalMap(fixture.expectedTotals.scopeTotals.trim)
  const doorTotals = scopeTotalMap(fixture.expectedTotals.scopeTotals.doors)
  const drywallTotals = scopeTotalMap(fixture.expectedTotals.scopeTotals.drywall)
  const roomTotals = roomTotalMap(fixture.expectedTotals.rooms)
  const sharedAccessCost = fixture.expectedTotals.scopeTotals.accessFees.reduce(
    (sum, row) => sum + row.total,
    0
  )
  const roomSubtotal = fixture.expectedTotals.rooms.reduce((sum, row) => sum + row.total, 0)

  return {
    wall_calculations: {
      scopes: (collections.scopes.length > 0 ? payload.room_wall_scopes : []).map((scope) => ({
        ...scope,
        effective_area_sf: wallScopeAreaById.get(String(scope.id)) ?? null,
        effective_total: wallTotals.get(String(scope.id)) ?? 0,
        raw_total:
          asNumber(scope.override_total) == null ? wallTotals.get(String(scope.id)) ?? 0 : 0,
      })),
      room_totals: collections.rooms.map((room) => ({
        room_id: room.roomId,
        effective_area_sf: wallRoomAreaById.get(room.roomId) ?? 0,
      })),
    },
    ceiling_calculations: {
      scopes: payload.room_ceiling_scopes.map((scope) => ({
        ...scope,
        effective_area_sf: ceilingAreaById.get(String(scope.id)) ?? null,
        effective_total: ceilingTotals.get(String(scope.id)) ?? 0,
        raw_total:
          asNumber(scope.override_total) == null ? ceilingTotals.get(String(scope.id)) ?? 0 : 0,
      })),
      room_totals: collections.rooms.map((room) => ({
        room_id: room.roomId,
        effective_area_sf: collections.ceilingScopes
          .filter((scope) => scope.roomId === room.roomId)
          .reduce((sum, scope) => sum + (ceilingAreaById.get(scope.id) ?? 0), 0),
      })),
    },
    trim_calculations: {
      scopes: payload.room_trim_scopes.map((scope) => ({
        ...scope,
        effective_measurement: trimMeasurementById.get(String(scope.id)) ?? null,
        effective_total: trimTotals.get(String(scope.id)) ?? 0,
        raw_total:
          asNumber(scope.override_total) == null ? trimTotals.get(String(scope.id)) ?? 0 : 0,
      })),
      room_totals: collections.rooms.map((room) => ({
        room_id: room.roomId,
        effective_area_sf: collections.trimScopes
          .filter((scope) => scope.roomId === room.roomId)
          .reduce((sum, scope) => sum + (trimMeasurementById.get(scope.id) ?? 0), 0),
      })),
    },
    door_calculations: {
      scopes: (payload.room_door_scopes ?? []).map((scope) => ({
        ...scope,
        effective_units: doorUnitsById.get(String(scope.id)) ?? null,
        effective_total: doorTotals.get(String(scope.id)) ?? 0,
        raw_total:
          asNumber(scope.override_total) == null ? doorTotals.get(String(scope.id)) ?? 0 : 0,
      })),
      room_totals: collections.rooms.map((room) => ({
        room_id: room.roomId,
        effective_area_sf: doorScopes
          .filter((scope) => scope.roomId === room.roomId)
          .reduce((sum, scope) => sum + (doorUnitsById.get(scope.id) ?? 0), 0),
      })),
    },
    drywall_calculations: {
      scopes: (payload.drywall_repairs ?? []).map((scope) => ({
        ...scope,
        effective_quantity: drywallQuantityById.get(String(scope.id)) ?? null,
        effective_total: drywallTotals.get(String(scope.id)) ?? 0,
        raw_total:
          asNumber(scope.override_total) == null ? drywallTotals.get(String(scope.id)) ?? 0 : 0,
      })),
      room_totals: collections.rooms.map((room) => ({
        room_id: room.roomId,
        effective_area_sf: drywallRepairs
          .filter((scope) => scope.roomId === room.roomId)
          .reduce((sum, scope) => sum + (drywallQuantityById.get(scope.id) ?? 0), 0),
      })),
    },
    pricing_summary: {
      rawLaborHours: 0,
      rawLaborDays: 0,
      effectiveLaborDays: 0,
      effectiveLaborHours: 0,
      laborCost: 0,
      wallPaintMaterialCost: 0,
      ceilingPaintMaterialCost: 0,
      trimPaintMaterialCost: 0,
      paintMaterialCost: 0,
      primerMaterialCost: 0,
      supplyCost: 0,
      sharedAccessCost,
      prePolicyTotal: roomSubtotal,
      postLaborPolicyTotal: roomSubtotal,
      minimumAdjustmentAmount: 0,
      finalTotal: fixture.expectedTotals.finalTotal,
      rooms: collections.rooms.map((room) => ({
        room_id: room.roomId,
        baseTotal: roomTotals.get(room.roomId) ?? 0,
        allocatedMinimumAdjustment: 0,
        finalTotal: roomTotals.get(room.roomId) ?? 0,
      })),
      trimPaint: null,
    } satisfies EstimateV2PricingSummary,
  }
}

function currentSnapshotPayload(fixture: EstimateV2CanonicalFixture) {
  const { collections, meta } = fixture.editorState
  const doorScopes = collections.doorScopes ?? []
  const drywallRepairs = collections.drywallRepairs ?? []
  const accessFees = collections.accessFees ?? []
  const otherItems = collections.otherItems ?? []
  return buildEstimateV2DirtySnapshot({
    jobSettingsDraft: meta.jobSettingsDraft,
    rooms: collections.rooms,
    scopes: collections.scopes,
    segments: collections.segments,
    roomFlags: collections.roomFlags,
    ceilingScopes: collections.ceilingScopes,
    ceilingSegments: collections.ceilingSegments,
    trimScopes: collections.trimScopes,
    doorScopes,
    drywallRepairs,
    rollers: collections.rollers ?? [],
    accessFees,
    otherItems,
  }).payload
}

function buildCanonicalSummaryHarness(fixture: EstimateV2CanonicalFixture) {
  const { meta } = fixture.editorState
  const payload = currentSnapshotPayload(fixture)
  const saved = buildCanonicalSavedSummaryData(fixture)

  return {
    fixture,
    saved,
    params: {
      data: {
        estimate: meta.estimate!,
        inputs: {
          jobsettings: payload.jobsettings,
          org_defaults: null,
          paint_products: meta.catalogs.paint_products,
          rooms: payload.rooms,
          room_flags: payload.room_flags,
          room_wall_scopes: payload.room_wall_scopes,
          room_ceiling_scopes: payload.room_ceiling_scopes,
          room_trim_scopes: payload.room_trim_scopes,
          room_door_scopes: payload.room_door_scopes ?? [],
          drywall_repairs: payload.drywall_repairs ?? [],
          access_fees: payload.access_fees ?? [],
          other: payload.other ?? [],
        },
        wall_calculations: saved.wall_calculations,
        ceiling_calculations: saved.ceiling_calculations,
        trim_calculations: saved.trim_calculations,
        door_calculations: saved.door_calculations,
        drywall_calculations: saved.drywall_calculations,
        trim_paint: null,
        pricing_summary: saved.pricing_summary,
      },
      job: meta.job,
      jobSettingsDraft: {
        dayhours: meta.jobSettingsDraft.dayhours,
        laborRate: meta.jobSettingsDraft.laborRate,
        crewSize: meta.jobSettingsDraft.crewSize,
      },
    },
  }
}

function buildFixtureWithSharedAccess(
  fixture: EstimateV2CanonicalFixture,
  accessTotal: number
): EstimateV2CanonicalFixture {
  return {
    ...fixture,
    editorState: {
      ...fixture.editorState,
      collections: {
        ...fixture.editorState.collections,
        accessFees: [
          ...(fixture.editorState.collections.accessFees ?? []),
          accessFee({
            id: 'access-shared-summary',
            roomId: CANONICAL_IDS.rooms.livingRoom,
            actualCostOverride: String(accessTotal),
          }),
        ],
      },
    },
    expectedTotals: {
      ...fixture.expectedTotals,
      finalTotal: fixture.expectedTotals.finalTotal + accessTotal,
      scopeTotals: {
        ...fixture.expectedTotals.scopeTotals,
        accessFees: [
          ...fixture.expectedTotals.scopeTotals.accessFees,
          {
            scopeId: 'access-shared-summary',
            roomId: CANONICAL_IDS.rooms.livingRoom,
            total: accessTotal,
          },
        ],
      },
    },
  }
}

describe('estimateV2SummaryDerived helpers', () => {
  it('keeps canonical simple saved room block totals equal to the displayed estimate total', () => {
    const canonical = buildCanonicalSummaryHarness(simpleNoOverridesFixture)

    const { result } = renderHook(() => useEstimateV2SummaryDerived(canonical.params))

    expect(result.current.finalTotal).toBe(simpleNoOverridesFixture.expectedTotals.finalTotal)
    expect(result.current.roomBlocks).toHaveLength(1)
    expect(result.current.roomBlocks[0]?.roomTotal).toBe(
      Math.round(simpleNoOverridesFixture.expectedTotals.finalTotal)
    )
    expect(result.current.roomBlocks.reduce((sum, block) => sum + (block.roomTotal ?? 0), 0)).toBe(
      Math.round(result.current.finalTotal ?? 0)
    )
  })

  it('excludes disabled canonical scope rows from saved room blocks and room totals', () => {
    const canonical = buildCanonicalSummaryHarness(manualOverridesDisabledScopesFixture)

    const { result } = renderHook(() => useEstimateV2SummaryDerived(canonical.params))
    const roomBlock = result.current.roomBlocks[0]

    expect(roomBlock?.scopeRows.map((scope) => scope.id)).toEqual([
      'wall-override-active',
      'ceiling-override-active',
      'trim-override-active',
      'drywall-override-active',
    ])
    expect(roomBlock?.scopeRows.map((scope) => scope.kind)).toEqual([
      'walls',
      'ceilings',
      'trim',
      'drywall',
    ])
    expect(roomBlock?.roomTotal).toBe(manualOverridesDisabledScopesFixture.expectedTotals.rooms[0]?.total)
    expect(roomBlock?.displayScopeSubtotalMap.has('wall-disabled')).toBe(false)
    expect(roomBlock?.displayScopeSubtotalMap.has('door-disabled')).toBe(false)
    expect(roomBlock?.displayScopeSubtotalMap.has('drywall-disabled-zero')).toBe(false)
    expect(result.current.priceBreakdownRows).toContainEqual({
      label: 'Access Fees',
      value: '$95',
    })
    expect(result.current.finalTotal).toBe(manualOverridesDisabledScopesFixture.expectedTotals.finalTotal)
  })

  it('shows canonical override-driven saved subtotals and override annotations for supported scope types', () => {
    const canonical = buildCanonicalSummaryHarness(manualOverridesDisabledScopesFixture)

    const { result } = renderHook(() => useEstimateV2SummaryDerived(canonical.params))
    const roomBlock = result.current.roomBlocks[0]
    const wallRow = roomBlock?.scopeRows.find((scope) => scope.id === 'wall-override-active')
    const ceilingRow = roomBlock?.scopeRows.find((scope) => scope.id === 'ceiling-override-active')
    const trimRow = roomBlock?.scopeRows.find((scope) => scope.id === 'trim-override-active')
    const drywallRow = roomBlock?.scopeRows.find((scope) => scope.id === 'drywall-override-active')

    expect(wallRow).toMatchObject({
      subtotal: manualOverridesDisabledScopesFixture.expectedTotals.scopeTotals.walls[0]?.total,
      hasOverride: true,
      overrideSummary: 'Override: Total: $450',
    })
    expect(ceilingRow).toMatchObject({
      subtotal: manualOverridesDisabledScopesFixture.expectedTotals.scopeTotals.ceilings[0]?.total,
      hasOverride: true,
      overrideSummary: 'Override: Total: $210',
    })
    expect(trimRow).toMatchObject({
      subtotal: manualOverridesDisabledScopesFixture.expectedTotals.scopeTotals.trim[0]?.total,
      hasOverride: true,
      overrideSummary: 'Override: Total: $125',
    })
    expect(drywallRow).toMatchObject({
      subtotal: manualOverridesDisabledScopesFixture.expectedTotals.scopeTotals.drywall[0]?.total,
      hasOverride: true,
      overrideSummary: 'Override: Total: $80',
    })
  })

  it('reconciles canonical override-heavy room subtotals and saved estimate totals correctly', () => {
    const canonical = buildCanonicalSummaryHarness(manualOverridesDisabledScopesFixture)

    const { result } = renderHook(() => useEstimateV2SummaryDerived(canonical.params))
    const roomBlock = result.current.roomBlocks[0]
    const displayedRoomSubtotal = Array.from(roomBlock?.displayScopeSubtotalMap.values() ?? []).reduce(
      (sum, value) => sum + value,
      0
    )

    expect(displayedRoomSubtotal).toBe(roomBlock?.roomTotal)
    expect(roomBlock?.roomTotal).toBe(manualOverridesDisabledScopesFixture.expectedTotals.rooms[0]?.total)
    expect((roomBlock?.roomTotal ?? 0) + (canonical.saved.pricing_summary.sharedAccessCost ?? 0)).toBe(
      manualOverridesDisabledScopesFixture.expectedTotals.finalTotal
    )
    expect(result.current.summaryAlerts.map((alert) => alert.detail)).toEqual([
      'Living Room Walls override active - Total: $450',
      'Living Room Ceiling override active - Total: $210',
      'Living Room Baseboards override active - Total: $125',
      'Living Room wall - patch opening repair override active - Total: $80',
    ])
  })

  it('reconciles multi-room displayed subtotals, whole-dollar room totals, and shared access consistently', () => {
    const accessTotal = 75
    const canonical = buildCanonicalSummaryHarness(
      buildFixtureWithSharedAccess(multiRoomGeometryVariationFixture, accessTotal)
    )

    const { result } = renderHook(() => useEstimateV2SummaryDerived(canonical.params))
    const roomIds = result.current.roomBlocks.map((block) => block.room.room_id)
    const displayedRoomTotal = result.current.roomBlocks.reduce(
      (sum, block) => sum + (block.roomTotal ?? 0),
      0
    )
    const displayedAccessTotal = dollars(
      result.current.priceBreakdownRows.find((row) => row.label === 'Access Fees')?.value ?? '-'
    )
    const bedroomBlock = result.current.roomBlocks.find(
      (block) => block.room.room_id === CANONICAL_IDS.rooms.bedroom
    )
    const bedroomDisplayedSubtotal = Array.from(
      bedroomBlock?.displayScopeSubtotalMap.values() ?? []
    ).reduce((sum, value) => sum + value, 0)
    const expectedDisplayedRoomTotals = reconcileWholeDollarRows(
      canonical.saved.pricing_summary.rooms.map((room) => ({
        room_id: room.room_id,
        price: room.finalTotal,
      })),
      (canonical.saved.pricing_summary.finalTotal ?? 0) -
        (canonical.saved.pricing_summary.sharedAccessCost ?? 0)
    ).map((row) => row.price)

    expect(roomIds).toEqual(
      multiRoomGeometryVariationFixture.expectedTotals.rooms.map((room) => room.roomId)
    )
    expect(result.current.roomBlocks.map((block) => block.scopes)).toEqual([
      ['Walls', 'Ceilings', 'Trim'],
      ['Walls', 'Ceilings'],
      ['Ceilings', 'Trim'],
    ])
    expect(result.current.roomBlocks.map((block) => block.roomTotal)).toEqual(
      expectedDisplayedRoomTotals
    )
    expect(displayedRoomTotal).toBe(
      Math.round(result.current.finalTotal ?? 0) - displayedAccessTotal
    )
    expect(displayedAccessTotal).toBe(accessTotal)
    expect(displayedRoomTotal + displayedAccessTotal).toBe(
      Math.round(result.current.finalTotal ?? 0)
    )
    expect(bedroomBlock?.scopeRows.map((scope) => scope.id)).toEqual([
      'ceiling-multi-bedroom',
      'trim-multi-bedroom',
    ])
    expect(bedroomBlock?.displayScopeSubtotalMap.has('wall-multi-bedroom-disabled')).toBe(false)
    expect(bedroomDisplayedSubtotal).toBe(bedroomBlock?.roomTotal)
  })

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

  it('does not treat persisted zero override fields as active when they match raw values', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-1',
          room_id: 'room-1',
          scope_name: 'Walls',
          effective_area_sf: 120,
          effective_total: 400,
          paint_product_id: 'paint-1',
          raw_primer_hours: 0,
          override_primer_hours: 0,
          raw_primer_gallons: 0,
          override_primer_gallons: 0,
          raw_supply_cost: 0,
          override_supply_cost: 0,
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

  it('keeps an override-to-zero active when it changes a nonzero raw value', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-1',
          room_id: 'room-1',
          scope_name: 'Walls',
          effective_area_sf: 120,
          effective_total: 0,
          paint_product_id: 'paint-1',
          raw_total: 400,
          override_total: 0,
        },
      ]),
      ceilingScopes: [],
      trimScopes: [],
    })
    const wallRow = roomScopeRows.get('room-1')?.find((scope) => scope.id === 'wall-1')

    expect(wallRow).toMatchObject({
      hasOverride: true,
      overrideSummary: 'Override: Total: $0',
    })
  })

  it('counts trim total overrides in summary rows and alerts', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: [],
      ceilingScopes: [],
      trimScopes: normalizeSummaryScopeRows([
        {
          id: 'trim-1',
          room_id: 'room-1',
          scope_name: 'Trim',
          effective_measurement: 20,
          effective_total: 150,
          raw_total: 100,
          override_total: 150,
        },
      ]),
    })
    const trimRow = roomScopeRows.get('room-1')?.find((scope) => scope.id === 'trim-1')
    const alerts = buildSummaryAlerts({
      pricingSummary,
      hasJobSettings: true,
      roomScopeRows,
      roomFlags: [],
      rooms,
    })

    expect(trimRow).toMatchObject({
      hasOverride: true,
      overrideSummary: 'Override: Total: $150',
    })
    expect(alerts).toContainEqual({
      kind: 'warn',
      title: 'Manual override detected',
      detail: 'Living Room Trim override active - Total: $150',
    })
  })

  it('does not count trim paint gallons as a manual override alert', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: [],
      ceilingScopes: [],
      trimScopes: normalizeSummaryScopeRows([
        {
          id: 'trim-1',
          room_id: 'room-1',
          scope_name: 'Baseboards',
          effective_measurement: 20,
          raw_paint_gallons: 0,
          override_gallons: 1,
        },
      ]),
    })
    const trimRow = roomScopeRows.get('room-1')?.find((scope) => scope.id === 'trim-1')
    const roomAlertsByRoom = buildRoomAlertsByRoom({
      rooms,
      roomFlagCountMap: new Map(),
      roomScopeRows,
    })
    const alerts = buildSummaryAlerts({
      pricingSummary,
      hasJobSettings: true,
      roomScopeRows,
      roomFlags: [],
      rooms,
    })

    expect(trimRow).toMatchObject({
      hasOverride: false,
      overrideSummary: null,
    })
    expect(roomAlertsByRoom.get('room-1')?.overrides).toBe(0)
    expect(alerts).toEqual([
      { kind: 'info', title: 'No active alerts', detail: 'Estimate is currently clean' },
    ])
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
        roomScopeRows: missingProductRows,
        roomFlags: [{ id: 'flag-1', room_id: 'room-1', flag_id: 'warn-1' }],
        rooms,
      }).map((alert) => alert.title)
    ).toEqual([
      'Missing product selection',
      'Warning flag active',
    ])

    const overrideRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-override',
          room_id: 'room-1',
          scope_name: 'Walls',
          effective_area_sf: 20,
          effective_total: 170,
          raw_total: 150,
          override_total: 170,
          paint_product_id: 'paint-1',
        },
      ]),
      ceilingScopes: [],
      trimScopes: [],
    })

    expect(
      buildSummaryAlerts({
        pricingSummary,
        hasJobSettings: true,
        roomScopeRows: overrideRows,
        roomFlags: [],
        rooms,
      })[0]
    ).toMatchObject({
      kind: 'warn',
      title: 'Manual override detected',
      detail: 'Living Room Walls override active - Total: $170',
    })

    expect(
      buildSummaryAlerts({
        pricingSummary,
        hasJobSettings: true,
        roomScopeRows: new Map(),
        roomFlags: [],
        rooms,
      })
    ).toEqual([
      { kind: 'info', title: 'No active alerts', detail: 'Estimate is currently clean' },
    ])
  })

  it('returns every active summary alert instead of collapsing to one per type', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-1',
          room_id: 'room-1',
          scope_name: 'Walls',
          effective_area_sf: 100,
          effective_total: 200,
        },
        {
          id: 'wall-2',
          room_id: 'room-1',
          scope_name: 'Accent Walls',
          effective_area_sf: 80,
          effective_total: 150,
        },
      ]),
      ceilingScopes: normalizeSummaryScopeRows([
        {
          id: 'ceiling-1',
          room_id: 'room-1',
          scope_name: 'Ceiling',
          effective_area_sf: 20,
          effective_total: 170,
          raw_total: 150,
          override_total: 170,
          paint_product_id: 'paint-1',
        },
      ]),
      trimScopes: [],
    })

    const alerts = buildSummaryAlerts({
      pricingSummary,
      hasJobSettings: true,
      roomScopeRows,
      roomFlags: [
        { id: 'flag-1', room_id: 'room-1', flag_id: 'warn-1' },
        { id: 'flag-2', room_id: 'room-1', flag_id: 'warn-2' },
      ],
      rooms,
    })

    expect(alerts.map((alert) => alert.title)).toEqual([
      'Missing product selection',
      'Missing product selection',
      'Manual override detected',
      'Warning flag active',
      'Warning flag active',
    ])
  })

  it('surfaces a top-level configuration warning when required paint defaults are missing', () => {
    const { result } = renderHook(() =>
      useEstimateV2SummaryDerived({
        data: {
          estimate: { version_name: 'Estimate A', version_state: 'Draft' },
          inputs: {
            jobsettings: {
              walls_paint_id: 'wall-paint-1',
              walls_primer_id: '',
              ceiling_paint_id: '',
              ceiling_primer_id: 'ceiling-primer-1',
              trim_paint_id: 'trim-paint-1',
              trim_primer_id: '',
            },
            org_defaults: null,
            rooms: [],
            room_flags: [],
            paint_products: [],
          },
          pricing_summary: pricingSummary,
        } as never,
        job: null,
        jobSettingsDraft: {
          dayhours: 8,
          laborRate: 80,
        },
      })
    )

    expect(result.current.configurationWarning).toEqual({
      title: 'Required paint defaults are missing',
      detail:
        'Missing walls default primer, ceilings default paint, and trim default primer. Pricing and send readiness stay blocked until every required paint and primer default is set.',
      fixHint:
        'Return to the estimate editor and open Paint Defaults in the left sidebar to set the missing defaults.',
      missingLabels: [
        'walls default primer',
        'ceilings default paint',
        'trim default primer',
      ],
    })
  })

  it('surfaces error readiness when an included painted scope has no product selection', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-missing-product',
          room_id: 'room-1',
          include: 'Y',
          scope_name: 'Walls',
          effective_area_sf: 100,
          effective_total: 200,
          raw_paint_gallons: 1,
          paint_product_id: null,
        },
      ]),
      ceilingScopes: [],
      trimScopes: [],
    })

    const alerts = buildSummaryAlerts({
      pricingSummary,
      hasJobSettings: true,
      roomScopeRows,
      roomFlags: [],
      rooms,
    })

    expect(alerts.some((alert) => alert.kind === 'error')).toBe(true)
  })

  it('excludes include=N scopes from visible summary math rows', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'included',
          room_id: 'room-1',
          include: 'Y',
          scope_name: 'Included',
          effective_area_sf: 10,
          effective_total: 100,
          paint_product_id: 'paint-1',
        },
        {
          id: 'excluded',
          room_id: 'room-1',
          include: 'N',
          scope_name: 'Excluded',
          effective_area_sf: 99,
          effective_total: 999,
          paint_product_id: 'paint-1',
        },
      ]),
      ceilingScopes: [],
      trimScopes: [],
    })
    const rowIds = roomScopeRows.get('room-1')?.map((row) => row.id) ?? []

    expect(rowIds).toContain('included')
    expect(rowIds).not.toContain('excluded')
  })

  it('adds included door rows after trim with units, labor, and door-specific override badges', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: [],
      ceilingScopes: [],
      trimScopes: normalizeSummaryScopeRows([
        {
          id: 'trim-1',
          room_id: 'room-1',
          include: 'Y',
          scope_name: 'Baseboards',
          effective_measurement: 42,
          effective_total: 180,
        },
      ]),
      doorScopes: normalizeSummaryScopeRows([
        {
          id: 'door-1',
          room_id: 'room-1',
          include: 'Y',
          scope_name: 'Panel Door',
          effective_units: 2,
          effective_paint_hours: 1.25,
          effective_primer_hours: 0.25,
          effective_supply_cost: 8,
          effective_total: 210,
          override_paint_hours: 1.25,
          override_material_cost: 35,
          override_total: 210,
        },
      ]),
    })
    const rows = roomScopeRows.get('room-1') ?? []

    expect(rows.map((row) => row.kind)).toEqual(['trim', 'doors'])
    expect(rows[1]).toMatchObject({
      id: 'door-1',
      label: 'Panel Door',
      quantity: 2,
      laborHours: 1.5,
      suppliesCost: 8,
      subtotal: 210,
      hasOverride: true,
      overrideSummary: 'Override: Paint hours: 1.25 h, Material cost: $35, Total: $210',
      missingProduct: false,
    })
  })

  it('hides excluded and empty door rows from visible summary math rows', () => {
    const roomScopeRows = buildRoomScopeRows({
      wallScopes: [],
      ceilingScopes: [],
      trimScopes: [],
      doorScopes: normalizeSummaryScopeRows([
        {
          id: 'door-included',
          room_id: 'room-1',
          include: 'Y',
          scope_name: 'Painted Door',
          effective_units: 1,
          effective_total: 120,
        },
        {
          id: 'door-excluded',
          room_id: 'room-1',
          include: 'N',
          scope_name: 'Excluded Door',
          effective_units: 4,
          effective_total: 999,
        },
        {
          id: 'door-empty',
          room_id: 'room-1',
          include: 'Y',
          scope_name: '',
          effective_units: 0,
          effective_total: 0,
        },
      ]),
    })
    const rowIds = roomScopeRows.get('room-1')?.map((row) => row.id) ?? []

    expect(rowIds).toEqual(['door-included'])
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
      { label: 'Total gallons', value: '0 gal' },
    ])
    expect(calculatePaintSuppliesTotal(pricingSummary)).toBe(320)
    expect(pricingSummary.prePolicyTotal + (pricingSummary.postLaborPolicyTotal - pricingSummary.prePolicyTotal) + pricingSummary.minimumAdjustmentAmount).toBe(
      pricingSummary.finalTotal
    )
  })

  it('keeps the paint and supplies displayed total equal to the visible dollar rows', () => {
    const paintRows = buildPaintSupplyRows(pricingSummary)
    const visibleDollarTotal = paintRows
      .filter((row) => row.label !== 'Total gallons')
      .reduce((sum, row) => sum + dollars(row.value), 0)

    expect(visibleDollarTotal).toBe(calculatePaintSuppliesTotal(pricingSummary))
  })

  it('reconciles fractional paint and supply rows to the displayed whole-dollar total', () => {
    const fractionalSummary = {
      ...pricingSummary,
      wallPaintMaterialCost: 10.49,
      ceilingPaintMaterialCost: 10.49,
      trimPaintMaterialCost: 0,
      primerMaterialCost: 0,
      supplyCost: 0,
    }
    const paintRows = buildPaintSupplyRows(fractionalSummary)
    const visibleDollarTotal = paintRows
      .filter((row) => row.label !== 'Total gallons')
      .reduce((sum, row) => sum + dollars(row.value), 0)

    expect(calculatePaintSuppliesTotal(fractionalSummary)).toBe(21)
    expect(visibleDollarTotal).toBe(21)
  })

  it('omits the primer row when no primer cost is present', () => {
    const paintRows = buildPaintSupplyRows(
      { ...pricingSummary, primerMaterialCost: 0 },
      null,
      { primerProductLabel: 'SW PrepRite' }
    )

    expect(paintRows.map((row) => row.label)).not.toContain('Primer - SW PrepRite')
  })

  it('appends selected product names to paint supply scope labels and includes total gallons', () => {
    const paintRows = buildPaintSupplyRows(pricingSummary, null, {
      wallPaintProductLabel: 'SW Cashmere',
      ceilingPaintProductLabel: 'SW ProMar Ceiling',
      trimPaintProductLabel: 'SW Emerald Urethane',
      primerProductLabel: 'SW PrepRite',
      totalGallons: 7.25,
    })

    expect(paintRows).toEqual([
      { label: 'Wall paint - SW Cashmere', value: '$120' },
      { label: 'Ceiling paint - SW ProMar Ceiling', value: '$80' },
      { label: 'Trim paint - SW Emerald Urethane', value: '$40' },
      { label: 'Primer - SW PrepRite', value: '$30' },
      { label: 'Supplies', value: '$50' },
      { label: 'Total gallons', value: '7.25 gal' },
    ])
  })

  it('keeps paint supply scope labels plain when no product is selected', () => {
    const paintRows = buildPaintSupplyRows(pricingSummary, null, {
      wallPaintProductLabel: '-',
      ceilingPaintProductLabel: '',
      trimPaintProductLabel: null,
      primerProductLabel: undefined,
      totalGallons: 0,
    })

    expect(paintRows.map((row) => row.label)).toEqual([
      'Wall paint',
      'Ceiling paint',
      'Trim paint',
      'Primer',
      'Supplies',
      'Total gallons',
    ])
  })

  it('resolves paint supply product labels from selected job products', () => {
    const labels = buildPaintSupplyProductLabels({
      jobsettings: {
        walls_paint_id: 'wall-paint-1',
        ceiling_paint_id: 'ceiling-paint-1',
        trim_paint_id: 'trim-paint-1',
        walls_primer_id: 'primer-1',
        ceiling_primer_id: 'primer-1',
        trim_primer_id: 'primer-1',
      },
      orgDefaults: null,
      wallScopes: normalizeSummaryScopeRows([
        { id: 'wall-1', room_id: 'room-1', raw_paint_gallons: 1.25, raw_primer_gallons: 0.5 },
      ]),
      ceilingScopes: normalizeSummaryScopeRows([
        { id: 'ceiling-1', room_id: 'room-1', raw_paint_gallons: 0.75 },
      ]),
      trimScopes: [],
      trimPaint: {
        paint_product_id: 'trim-paint-override',
        paint_product_label: 'Trim Paint Override',
        gallons: 1,
        quarts: 0,
        normalized_gallons: 1,
        paint_cost: 40,
      },
      resolvePaintProductLabel: createPaintProductLabelResolver([
        { id: 'wall-paint-1', name: 'SW Cashmere' },
        { id: 'ceiling-paint-1', display_name: 'SW ProMar Ceiling' },
        { id: 'trim-paint-override', name: 'SW Emerald Urethane' },
        { id: 'primer-1', name: 'SW PrepRite' },
      ]),
    })

    expect(labels).toEqual({
      wallPaintProductLabel: 'SW Cashmere',
      ceilingPaintProductLabel: 'SW ProMar Ceiling',
      trimPaintProductLabel: 'Trim Paint Override',
      primerProductLabel: 'SW PrepRite',
      totalGallons: 3.5,
    })
  })

  it('prefers active scope-level paint products over job defaults for paint supply labels', () => {
    const labels = buildPaintSupplyProductLabels({
      jobsettings: {
        walls_paint_id: 'default-wall-paint',
        ceiling_paint_id: 'default-ceiling-paint',
      },
      orgDefaults: null,
      wallScopes: normalizeSummaryScopeRows([
        {
          id: 'wall-1',
          room_id: 'room-1',
          paint_product_id: 'wall-paint-1',
          raw_paint_gallons: 1,
        },
        {
          id: 'wall-2',
          room_id: 'room-1',
          paint_product_id: 'wall-paint-2',
          raw_paint_gallons: 1,
        },
        {
          id: 'wall-excluded',
          room_id: 'room-1',
          include: 'N',
          paint_product_id: 'excluded-wall-paint',
          raw_paint_gallons: 1,
        },
      ]),
      ceilingScopes: normalizeSummaryScopeRows([
        {
          id: 'ceiling-1',
          room_id: 'room-1',
          paint_product_label: 'Ceiling Scope Paint',
          raw_paint_gallons: 1,
        },
      ]),
      trimScopes: [],
      trimPaint: null,
      resolvePaintProductLabel: createPaintProductLabelResolver([
        { id: 'default-wall-paint', name: 'Default Wall Paint' },
        { id: 'default-ceiling-paint', name: 'Default Ceiling Paint' },
        { id: 'wall-paint-1', name: 'Wall Scope Paint A' },
        { id: 'wall-paint-2', name: 'Wall Scope Paint B' },
        { id: 'excluded-wall-paint', name: 'Excluded Wall Paint' },
      ]),
    })

    expect(labels.wallPaintProductLabel).toBe('Wall Scope Paint A, Wall Scope Paint B')
    expect(labels.ceilingPaintProductLabel).toBe('Ceiling Scope Paint')
  })

  it('falls back to persisted trim paint cost when the pricing summary trim cost is stale', () => {
    const trimPaint: EstimateV2TrimPaint = {
      paint_product_id: 'trim-paint-1',
      paint_product_label: 'Trim Paint',
      gallons: 1,
      quarts: 2,
      normalized_gallons: 1.5,
      paint_cost: 45,
    }
    const stalePricingSummary = {
      ...pricingSummary,
      trimPaintMaterialCost: 0,
    }

    expect(buildPaintSupplyRows(stalePricingSummary, trimPaint)).toContainEqual({
      label: 'Trim paint',
      value: '$45',
    })
    expect(calculatePaintSuppliesTotal(stalePricingSummary, trimPaint)).toBe(325)
  })

  it('keeps scope kind labels and ordering aligned with the shared single source of truth', () => {
    expect(SCOPE_KIND_ORDER.walls).toBeLessThan(SCOPE_KIND_ORDER.ceilings)
    expect(SCOPE_KIND_ORDER.ceilings).toBeLessThan(SCOPE_KIND_ORDER.trim)
    expect(SCOPE_KIND_ORDER.trim).toBeLessThan(SCOPE_KIND_ORDER.doors)
    expect(SCOPE_KIND_ORDER.doors).toBeLessThan(SCOPE_KIND_ORDER.drywall)
    expect(SCOPE_KIND_LABELS).toEqual({
      walls: 'Walls',
      ceilings: 'Ceilings',
      trim: 'Trim',
      doors: 'Doors',
      drywall: 'Drywall',
    })
  })
})
