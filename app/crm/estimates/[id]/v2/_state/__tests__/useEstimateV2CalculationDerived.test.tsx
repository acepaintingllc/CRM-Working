import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  manualOverridesDisabledScopesFixture,
  simpleNoOverridesFixture,
  type EstimateV2CanonicalFixture,
} from '@/lib/estimator/__fixtures__/canonical/index.ts'
import { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import {
  buildLocalCeilingScopeEffectiveAreaById,
  buildLocalDoorScopeEffectiveUnitsById,
  buildLocalDrywallRepairEffectiveQuantityById,
  buildLocalRoomEffectiveAreaByRoomId,
  buildLocalScopeEffectiveAreaById,
  buildLocalTrimScopeMetricById,
} from '../../_lib/estimateV2EditorDerived'
import { resolveRoomModeById } from '../../_lib/estimateV2EditorNormalize'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { buildEstimateV2DirtySnapshot } from '../estimateV2DirtySnapshot'
import { useEstimateV2CalculationDerived } from '../useEstimateV2CalculationDerived'

function buildHookParams() {
  const fixture = createMixedEstimateV2Fixture()
  const doorScopes = [
    {
      id: 'door-r001-main',
      roomId: 'R001',
      position: 0,
      include: 'Y' as const,
      scopeName: 'Entry Door',
      doorTypeId: 'DOOR',
      quantity: '2',
      sides: '2',
      colorId: '',
      paintProductId: '',
      primerProductId: '',
      primeMode: 'NONE' as const,
      spotPrimePercent: '',
      paintCoats: '2',
      primerCoats: '1',
      conditionFactor: '1',
      laborRate: '',
      materialRate: '',
      overridePaintHours: '',
      overridePrimerHours: '',
      overrideMaterialCost: '',
      overrideSupplyCost: '',
      overrideTotal: '',
      notes: '',
    },
  ]
  const drywallRepairs = [
    {
      id: 'drywall-r001-wall',
      roomId: 'R001',
      position: 0,
      surface: 'wall' as const,
      repairType: 'flat_wall_crack',
      unit: 'LF' as const,
      quantity: '4',
      overrideTotal: '',
    },
    {
      id: 'drywall-r001-ceiling',
      roomId: 'R001',
      position: 1,
      surface: 'ceiling' as const,
      repairType: 'ceiling_crack',
      unit: 'LF' as const,
      quantity: '3',
      overrideTotal: '95',
    },
  ]
  const collections = {
    rooms: fixture.rooms,
    scopes: fixture.scopes,
    segments: fixture.segments,
    roomFlags: fixture.roomFlags,
    ceilingScopes: fixture.ceilingScopes,
    ceilingSegments: fixture.ceilingSegments,
    trimScopes: fixture.trimScopes,
    doorScopes,
    drywallRepairs,
    rollers: fixture.rollers,
    accessFees: fixture.accessFees,
    otherItems: [],
  }

  return {
    fixture,
    params: {
      collections,
      meta: {
        loading: false,
        estimate: fixture.estimate,
        lastSavedSnapshot: fixture.currentSnapshot,
        wallCalculations: fixture.wallCalculations,
        ceilingCalculations: fixture.ceilingCalculations,
        trimCalculations: fixture.trimCalculations,
        doorCalculations: {
          scopes: [
            {
              id: 'door-r001-main',
              include: 'Y',
              effective_units: 4,
              effective_total: 125,
            },
          ],
        },
        drywallCalculations: {
          scopes: [
            {
              id: 'drywall-r001-wall',
              effective_quantity: 4,
              effective_total: 64,
            },
            {
              id: 'drywall-r001-ceiling',
              effective_quantity: 3,
              effective_total: 95,
            },
          ],
        },
        jobSettingsDraft: fixture.jobSettingsDraft,
        orgJobProductDefaults: {
          wallPaintProductId: fixture.jobSettingsDraft.wallPaintProductId,
          wallPrimerProductId: fixture.jobSettingsDraft.wallPrimerProductId,
          ceilingPaintProductId: fixture.jobSettingsDraft.ceilingPaintProductId,
          ceilingPrimerProductId: fixture.jobSettingsDraft.ceilingPrimerProductId,
          trimPaintProductId: fixture.jobSettingsDraft.trimPaintProductId,
          trimPrimerProductId: fixture.jobSettingsDraft.trimPrimerProductId,
        },
        catalogs: fixture.catalogs,
      },
      selectedRoom: fixture.rooms[0],
      firstScope: fixture.scopes[0],
      selectedRoomScopes: fixture.scopes.filter((scope) => scope.roomId === 'R001'),
      selectedRoomCeilingScopes: fixture.ceilingScopes.filter((scope) => scope.roomId === 'R001'),
      selectedRoomTrimScopes: fixture.trimScopes.filter((scope) => scope.roomId === 'R001'),
      selectedRoomDoorScopes: doorScopes,
      selectedRoomWallDrywallRepairs: drywallRepairs.filter((repair) => repair.surface === 'wall'),
      selectedRoomCeilingDrywallRepairs: drywallRepairs.filter((repair) => repair.surface === 'ceiling'),
    },
  }
}

function scopeTotalMap(rows: EstimateV2CanonicalFixture['expectedTotals']['scopeTotals'][keyof EstimateV2CanonicalFixture['expectedTotals']['scopeTotals']]) {
  return new Map(rows.map((row) => [row.scopeId, row.total] as const))
}

function roomTotalMap(rows: EstimateV2CanonicalFixture['expectedTotals']['rooms']) {
  return new Map(rows.map((row) => [row.roomId, row.total] as const))
}

function buildCanonicalSavedCalculations(fixture: EstimateV2CanonicalFixture) {
  const { collections, meta } = fixture.editorState
  const doorScopes = collections.doorScopes ?? []
  const drywallRepairs = collections.drywallRepairs ?? []
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

  return {
    wallCalculations: {
      scopes: collections.scopes.map((scope) => ({
        id: scope.id,
        effective_area_sf: wallScopeAreaById.get(scope.id) ?? null,
        effective_total: wallTotals.get(scope.id) ?? 0,
      })),
      room_totals: collections.rooms.map((room) => ({
        room_id: room.roomId,
        effective_area_sf: wallRoomAreaById.get(room.roomId) ?? 0,
        effective_total: roomTotals.get(room.roomId) ?? 0,
      })),
      scope_traces: collections.scopes.map((scope) => ({
        scope_id: scope.id,
        area: {
          effective_area_sf: wallScopeAreaById.get(scope.id) ?? null,
        },
      })),
    },
    ceilingCalculations: {
      scopes: collections.ceilingScopes.map((scope) => ({
        id: scope.id,
        effective_area_sf: ceilingAreaById.get(scope.id) ?? null,
        effective_total: ceilingTotals.get(scope.id) ?? 0,
      })),
    },
    trimCalculations: {
      scopes: collections.trimScopes.map((scope) => ({
        id: scope.id,
        effective_measurement: trimMeasurementById.get(scope.id) ?? null,
        effective_total: trimTotals.get(scope.id) ?? 0,
      })),
    },
    doorCalculations: {
      scopes: doorScopes.map((scope) => ({
        id: scope.id,
        effective_units: doorUnitsById.get(scope.id) ?? null,
        effective_total: doorTotals.get(scope.id) ?? 0,
      })),
    },
    drywallCalculations: {
      scopes: drywallRepairs.map((repair) => ({
        id: repair.id,
        effective_quantity: drywallQuantityById.get(repair.id) ?? null,
        effective_total: drywallTotals.get(repair.id) ?? 0,
      })),
    },
  }
}

function buildCanonicalHookParams(fixture: EstimateV2CanonicalFixture) {
  const { collections, meta } = fixture.editorState
  const normalizedCollections = {
    ...collections,
    doorScopes: collections.doorScopes ?? [],
    drywallRepairs: collections.drywallRepairs ?? [],
    rollers: collections.rollers ?? [],
    accessFees: collections.accessFees ?? [],
    otherItems: collections.otherItems ?? [],
  }
  const currentSnapshot = buildEstimateV2DirtySnapshot({
    jobSettingsDraft: meta.jobSettingsDraft,
    rooms: normalizedCollections.rooms,
    scopes: normalizedCollections.scopes,
    segments: normalizedCollections.segments,
    roomFlags: normalizedCollections.roomFlags,
    ceilingScopes: normalizedCollections.ceilingScopes,
    ceilingSegments: normalizedCollections.ceilingSegments,
    trimScopes: normalizedCollections.trimScopes,
    doorScopes: normalizedCollections.doorScopes,
    drywallRepairs: normalizedCollections.drywallRepairs,
    rollers: normalizedCollections.rollers,
    accessFees: normalizedCollections.accessFees,
    otherItems: normalizedCollections.otherItems,
  })
  const savedCalculations = buildCanonicalSavedCalculations(fixture)
  const selectedRoom =
    normalizedCollections.rooms.find((room) => room.roomId === meta.selectedRoomId) ?? null
  const selectedRoomId = selectedRoom?.roomId ?? ''
  const selectedRoomScopes = normalizedCollections.scopes.filter(
    (scope) => scope.roomId === selectedRoomId
  )

  return {
    fixture,
    currentSnapshot,
    savedCalculations,
    params: {
      collections: normalizedCollections,
      meta: {
        ...meta,
        lastSavedSnapshot: currentSnapshot,
        wallCalculations: savedCalculations.wallCalculations,
        ceilingCalculations: savedCalculations.ceilingCalculations,
        trimCalculations: savedCalculations.trimCalculations,
        doorCalculations: savedCalculations.doorCalculations,
        drywallCalculations: savedCalculations.drywallCalculations,
      },
      selectedRoom,
      firstScope: selectedRoomScopes[0] ?? null,
      selectedRoomScopes,
      selectedRoomCeilingScopes: normalizedCollections.ceilingScopes.filter(
        (scope) => scope.roomId === selectedRoomId
      ),
      selectedRoomTrimScopes: normalizedCollections.trimScopes.filter(
        (scope) => scope.roomId === selectedRoomId
      ),
      selectedRoomDoorScopes: normalizedCollections.doorScopes.filter(
        (scope) => scope.roomId === selectedRoomId
      ),
      selectedRoomWallDrywallRepairs: normalizedCollections.drywallRepairs.filter(
        (repair) => repair.roomId === selectedRoomId && repair.surface === 'wall'
      ),
      selectedRoomCeilingDrywallRepairs: normalizedCollections.drywallRepairs.filter(
        (repair) => repair.roomId === selectedRoomId && repair.surface === 'ceiling'
      ),
    },
  }
}

describe('useEstimateV2CalculationDerived', () => {
  it('uses the canonical simple fixture on the clean server-backed totals path', () => {
    const canonical = buildCanonicalHookParams(simpleNoOverridesFixture)
    const expectedWallTotal = canonical.fixture.expectedTotals.scopeTotals.walls[0]?.total ?? null
    const expectedRoomTotal = canonical.fixture.expectedTotals.rooms[0]?.total ?? null
    const expectedWallArea =
      canonical.savedCalculations.wallCalculations.room_totals[0]?.effective_area_sf ?? null

    const { result } = renderHook(() => useEstimateV2CalculationDerived(canonical.params))

    expect(result.current.dirty).toBe(false)
    expect(result.current.hasServerCalculations).toBe(true)
    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-simple-living')).toBe(expectedWallTotal)
    expect(result.current.selectedWallSubtotal).toBe(expectedWallTotal)
    expect(result.current.selectedCeilingSubtotal).toBeNull()
    expect(result.current.selectedTrimSubtotal).toBeNull()
    expect(result.current.selectedDoorSubtotal).toBeNull()
    expect(result.current.selectedWallDrywallSubtotal).toBeNull()
    expect(result.current.displayedRoomEffectiveAreaByRoomId.get('R001')).toBe(expectedWallArea)
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: expectedWallArea,
      ceilingsSqFt: 0,
      trimMeasurement: 0,
      doorSides: 0,
      doorCount: 0,
      doorsActive: false,
    })
    expect(result.current.selectedWallSubtotal).toBe(expectedRoomTotal)
    expect(canonical.fixture.expectedTotals.finalTotal).toBe(expectedRoomTotal)
  })

  it('propagates disabled scopes and manual overrides from the canonical override-heavy fixture', () => {
    const canonical = buildCanonicalHookParams(manualOverridesDisabledScopesFixture)
    const expected = canonical.fixture.expectedTotals
    const expectedRoomTotal = expected.rooms[0]?.total ?? null
    const expectedAccessTotal = expected.scopeTotals.accessFees.reduce((sum, row) => sum + row.total, 0)

    const { result } = renderHook(() => useEstimateV2CalculationDerived(canonical.params))

    expect(result.current.dirty).toBe(false)
    expect(result.current.hasServerCalculations).toBe(true)
    expect(result.current.useLocalPreviewCalculations).toBe(false)

    expect(result.current.wallScopeEffectiveTotalById.get('wall-override-active')).toBe(450)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-disabled')).toBe(0)
    expect(result.current.selectedWallSubtotal).toBe(450)

    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-override-active')).toBe(210)
    expect(result.current.selectedCeilingSubtotal).toBe(210)

    expect(result.current.trimScopeEffectiveTotalById.get('trim-override-active')).toBe(125)
    expect(result.current.selectedTrimSubtotal).toBe(125)

    expect(result.current.doorScopeEffectiveTotalById.get('door-disabled')).toBe(0)
    expect(result.current.selectedDoorSubtotal).toBeNull()
    expect(result.current.doorScopeEffectiveUnitsById.get('door-disabled')).toBe(0)
    expect(result.current.selectedDoorUnits).toBeNull()

    expect(result.current.drywallRepairEffectiveTotalById.get('drywall-override-active')).toBe(80)
    expect(result.current.drywallRepairEffectiveTotalById.get('drywall-disabled-zero')).toBe(0)
    expect(result.current.selectedWallDrywallSubtotal).toBe(80)
    expect(result.current.selectedCeilingDrywallSubtotal).toBeNull()

    expect(result.current.selectedWallSubtotal).toBe(expected.scopeTotals.walls[0]?.total ?? null)
    expect(result.current.selectedCeilingSubtotal).toBe(expected.scopeTotals.ceilings[0]?.total ?? null)
    expect(result.current.selectedTrimSubtotal).toBe(expected.scopeTotals.trim[0]?.total ?? null)
    expect(result.current.selectedWallDrywallSubtotal).toBe(expected.scopeTotals.drywall[0]?.total ?? null)
    expect(
      (result.current.selectedWallSubtotal ?? 0) +
        (result.current.selectedCeilingSubtotal ?? 0) +
        (result.current.selectedTrimSubtotal ?? 0) +
        (result.current.selectedDoorSubtotal ?? 0) +
        (result.current.selectedWallDrywallSubtotal ?? 0) +
        (result.current.selectedCeilingDrywallSubtotal ?? 0)
    ).toBe(expectedRoomTotal)

    expect(expected.finalTotal).toBe(expectedRoomTotal + expectedAccessTotal)
  })

  it('preserves the compatibility return shape', () => {
    const { params } = buildHookParams()

    const { result } = renderHook(() => useEstimateV2CalculationDerived(params))

    expect(Object.keys(result.current)).toEqual([
      'currentPayload',
      'currentSnapshot',
      'dirty',
      'hasServerCalculations',
      'useLocalPreviewCalculations',
      'displayedSegmentEffectiveAreaById',
      'displayedScopeEffectiveAreaById',
      'displayedRoomEffectiveAreaByRoomId',
      'wallScopeEffectiveTotalById',
      'selectedCeilingEffectiveSqFt',
      'ceilingScopePreviewMetricsById',
      'ceilingScopeEffectiveTotalById',
      'trimScopeEffectiveMeasurementById',
      'trimScopeEffectiveTotalById',
      'doorScopeEffectiveUnitsById',
      'doorScopeEffectiveTotalById',
      'drywallRepairEffectiveQuantityById',
      'drywallRepairEffectiveTotalById',
      'selectedWallSubtotal',
      'selectedCeilingSubtotal',
      'selectedTrimSubtotal',
      'selectedTrimMeasurement',
      'selectedDoorSubtotal',
      'selectedDoorUnits',
      'selectedWallDrywallSubtotal',
      'selectedCeilingDrywallSubtotal',
      'totalEffectiveAreaSqFt',
      'activeScopeTotals',
      'selectedRoomEffectiveSqFt',
      'selectedScopeEffectiveSqFt',
      'calculationsStale',
    ])
  })

  it('accepts the legacy wrapper meta shape without org job product defaults', () => {
    const { params } = buildHookParams()
    const legacyMeta = Object.fromEntries(
      Object.entries(params.meta).filter(([key]) => key !== 'orgJobProductDefaults')
    ) as typeof params.meta
    const cleanSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: params.meta.jobSettingsDraft,
      rooms: params.collections.rooms,
      scopes: params.collections.scopes,
      segments: params.collections.segments,
      roomFlags: params.collections.roomFlags,
      ceilingScopes: params.collections.ceilingScopes,
      ceilingSegments: params.collections.ceilingSegments,
      trimScopes: params.collections.trimScopes,
      doorScopes: params.collections.doorScopes,
      drywallRepairs: params.collections.drywallRepairs,
      rollers: params.collections.rollers,
      accessFees: params.collections.accessFees,
      otherItems: params.collections.otherItems,
    })

    const { result } = renderHook(() =>
      useEstimateV2CalculationDerived({
        ...params,
        meta: {
          ...legacyMeta,
          lastSavedSnapshot: cleanSnapshot,
        },
      })
    )

    expect(result.current.currentPayload.room_wall_scopes).toHaveLength(params.collections.scopes.length)
    expect(result.current.currentPayload.room_door_scopes).toHaveLength(params.collections.doorScopes.length)
    expect(result.current.currentPayload.drywall_repairs).toHaveLength(
      params.collections.drywallRepairs.length
    )
    expect(result.current.dirty).toBe(false)
    expect(result.current.useLocalPreviewCalculations).toBe(false)
  })

  it('falls back to clean local preview display totals when no server response is available yet', () => {
    const { params } = buildHookParams()
    const cleanSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: params.meta.jobSettingsDraft,
      rooms: params.collections.rooms,
      scopes: params.collections.scopes,
      segments: params.collections.segments,
      roomFlags: params.collections.roomFlags,
      ceilingScopes: params.collections.ceilingScopes,
      ceilingSegments: params.collections.ceilingSegments,
      trimScopes: params.collections.trimScopes,
      doorScopes: params.collections.doorScopes,
      drywallRepairs: params.collections.drywallRepairs,
      rollers: params.collections.rollers,
      accessFees: params.collections.accessFees,
      otherItems: params.collections.otherItems,
    })
    const preview = calculateEstimateV2Preview({
      payload: cleanSnapshot.payload,
      catalogs: params.meta.catalogs,
      orgDefaults: {
        walls_paint_id: params.meta.orgJobProductDefaults?.wallPaintProductId ?? null,
        walls_primer_id: params.meta.orgJobProductDefaults?.wallPrimerProductId ?? null,
        ceiling_paint_id: params.meta.orgJobProductDefaults?.ceilingPaintProductId ?? null,
        ceiling_primer_id: params.meta.orgJobProductDefaults?.ceilingPrimerProductId ?? null,
        trim_paint_id: params.meta.orgJobProductDefaults?.trimPaintProductId ?? null,
        trim_primer_id: params.meta.orgJobProductDefaults?.trimPrimerProductId ?? null,
      },
    })
    const previewWallScope = preview.walls.scopes.find((scope) => scope.id === 'wall-r001-main')
    const previewWallRoom = preview.walls.room_totals.find((room) => room.room_id === 'R001')
    const previewCeilingScope = preview.ceilings.scopes.find((scope) => scope.id === 'ceiling-r001-main')
    const previewTrimScope = preview.trim.scopes.find((scope) => scope.id === 'trim-r001-main')
    const previewDoorScope = preview.doors.scopes.find((scope) => scope.id === 'door-r001-main')
    const previewWallDrywall = preview.drywall.scopes.find((scope) => scope.id === 'drywall-r001-wall')
    const previewCeilingDrywall = preview.drywall.scopes.find((scope) => scope.id === 'drywall-r001-ceiling')

    const { result } = renderHook(() =>
      useEstimateV2CalculationDerived({
        ...params,
        meta: {
          ...params.meta,
          lastSavedSnapshot: cleanSnapshot,
          wallCalculations: {
            ...params.meta.wallCalculations,
            room_totals: [],
            scopes: params.meta.wallCalculations?.scopes?.map((scope) =>
              scope.id === 'wall-r001-main'
                ? { ...scope, effective_area_sf: 999, effective_total: 999 }
                : scope
            ),
          },
          ceilingCalculations: {
            scopes: [{ id: 'ceiling-r001-main', effective_area_sf: 999, effective_total: 999 }],
          },
          trimCalculations: {
            scopes: [{ id: 'trim-r001-main', effective_measurement: 999, effective_total: 999 }],
          },
          doorCalculations: {
            scopes: [{ id: 'door-r001-main', effective_units: 999, effective_total: 999 }],
          },
          drywallCalculations: {
            scopes: [
              { id: 'drywall-r001-wall', effective_quantity: 999, effective_total: 999 },
              { id: 'drywall-r001-ceiling', effective_quantity: 999, effective_total: 999 },
            ],
          },
        },
      })
    )

    expect(result.current.dirty).toBe(false)
    expect(result.current.hasServerCalculations).toBe(false)
    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.displayedScopeEffectiveAreaById.get('wall-r001-main')).toBe(
      previewWallScope?.effective_area_sf ?? null
    )
    expect(result.current.displayedRoomEffectiveAreaByRoomId.get('R001')).toBe(
      previewWallRoom?.effective_area_sf ?? null
    )
    expect(result.current.selectedRoomEffectiveSqFt).toBe(previewWallRoom?.effective_area_sf ?? null)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBeNull()
    expect(result.current.selectedWallSubtotal).toBeNull()
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(previewCeilingScope?.effective_area_sf ?? null)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBeNull()
    expect(result.current.selectedCeilingSubtotal).toBeNull()
    expect(result.current.trimScopeEffectiveMeasurementById.get('trim-r001-main')).toBe(
      previewTrimScope?.effective_measurement ?? null
    )
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBe(
      previewTrimScope?.effective_total ?? null
    )
    expect(result.current.selectedTrimSubtotal).toBe(previewTrimScope?.effective_total ?? null)
    expect(result.current.doorScopeEffectiveUnitsById.get('door-r001-main')).toBe(
      previewDoorScope?.effective_units ?? null
    )
    expect(result.current.doorScopeEffectiveTotalById.get('door-r001-main')).toBeNull()
    expect(result.current.selectedDoorSubtotal).toBeNull()
    expect(result.current.selectedDoorUnits).toBe(previewDoorScope?.effective_units ?? null)
    expect(result.current.drywallRepairEffectiveQuantityById.get('drywall-r001-wall')).toBe(
      previewWallDrywall?.effective_quantity ?? null
    )
    expect(result.current.drywallRepairEffectiveTotalById.get('drywall-r001-wall')).toBeNull()
    expect(result.current.selectedWallDrywallSubtotal).toBeNull()
    expect(result.current.drywallRepairEffectiveTotalById.get('drywall-r001-ceiling')).toBe(
      previewCeilingDrywall?.effective_total ?? null
    )
    expect(result.current.selectedCeilingDrywallSubtotal).toBe(
      previewCeilingDrywall?.effective_total ?? null
    )
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: preview.walls.room_totals.reduce(
        (sum, room) => sum + (room.effective_area_sf ?? 0),
        0
      ),
      ceilingsSqFt: preview.ceilings.room_totals.reduce(
        (sum, room) => sum + (room.effective_area_sf ?? 0),
        0
      ),
      trimMeasurement: preview.trim.room_totals.reduce(
        (sum, room) => sum + (room.effective_area_sf ?? 0),
        0
      ),
      doorSides: preview.doors.scopes.reduce(
        (sum, scope) => sum + (scope.include === 'Y' ? (scope.effective_units ?? 0) : 0),
        0
      ),
      doorCount: 2,
      doorsActive: true,
    })
  })

  it('uses dirty local preview helpers for ceiling area, trim measurement, and door billable sides', () => {
    const { fixture, params } = buildHookParams()
    const dirtyParams = {
      ...params,
      meta: {
        ...params.meta,
        lastSavedSnapshot: {
          payload: fixture.currentSnapshot.payload,
          comparisonKey: 'stale-calculation-preview',
        },
      },
    }

    const { result } = renderHook(() => useEstimateV2CalculationDerived(dirtyParams))

    expect(result.current.dirty).toBe(true)
    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.displayedScopeEffectiveAreaById.get('wall-r001-main')).toBe(396)
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(120)
    expect(result.current.ceilingScopePreviewMetricsById.get('ceiling-r001-main')).toMatchObject({
      baseAreaSqFt: 120,
      helperExtraAreaSqFt: 0,
      areaFactor: 1,
      effectiveAreaSqFt: 120,
    })
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBeNull()
    expect(result.current.trimScopeEffectiveMeasurementById.get('trim-r001-main')).toBe(44)
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBe(210)
    expect(result.current.doorScopeEffectiveUnitsById.get('door-r001-main')).toBe(4)
    expect(result.current.doorScopeEffectiveTotalById.get('door-r001-main')).toBeNull()
    expect(result.current.selectedDoorSubtotal).toBeNull()
    expect(result.current.selectedDoorUnits).toBe(4)
    expect(result.current.drywallRepairEffectiveQuantityById.get('drywall-r001-wall')).toBe(4)
    expect(result.current.drywallRepairEffectiveTotalById.get('drywall-r001-wall')).toBeNull()
    expect(result.current.drywallRepairEffectiveTotalById.get('drywall-r001-ceiling')).toBe(95)
    expect(result.current.selectedWallDrywallSubtotal).toBeNull()
    expect(result.current.selectedCeilingDrywallSubtotal).toBe(95)
    expect(result.current.activeScopeTotals).toMatchObject({
      ceilingsSqFt: 180,
      trimMeasurement: 44,
      doorSides: 4,
      doorCount: 2,
      doorsActive: true,
    })
  })

  it('builds ceiling preview VM metrics for SEG, vaulted, coffered, overrides, and missing inputs', () => {
    const { fixture, params } = buildHookParams()
    const baseScope = params.collections.ceilingScopes[0]
    const dirtyParams = {
      ...params,
      collections: {
        ...params.collections,
        ceilingScopes: [
          {
            ...baseScope,
            id: 'ceiling-seg-preview',
            mode: 'SEG' as const,
            ceilingTypeId: 'CEIL-FLAT',
            ceilingGeometryMode: 'FLAT' as const,
            overrideAreaSqFt: '',
          },
          {
            ...baseScope,
            id: 'ceiling-vaulted-preview',
            ceilingTypeId: 'CEIL-FLAT',
            ceilingGeometryMode: 'VAULTED' as const,
            areaSf: '',
            lengthIn: '120',
            widthIn: '144',
            vaultedAreaFactor: '1.2',
            overrideAreaSqFt: '',
          },
          {
            ...baseScope,
            id: 'ceiling-coffered-preview',
            ceilingTypeId: 'COFFERED',
            ceilingGeometryMode: 'COFFERED' as const,
            areaSf: '',
            cofferSectionLengthIn: '48',
            cofferSectionWidthIn: '36',
            cofferSectionCount: '2',
            cofferFaceHeightIn: '6',
            cofferBottomWidthIn: '4',
            overrideAreaSqFt: '',
          },
          {
            ...baseScope,
            id: 'ceiling-override-preview',
            ceilingTypeId: 'CEIL-FLAT',
            ceilingGeometryMode: 'FLAT' as const,
            overrideAreaSqFt: '77',
          },
          {
            ...baseScope,
            id: 'ceiling-missing-preview',
            roomId: 'R404',
            ceilingTypeId: 'CEIL-FLAT',
            ceilingGeometryMode: 'FLAT' as const,
            lengthIn: '',
            widthIn: '',
            areaSf: '',
            overrideAreaSqFt: '',
          },
        ],
        ceilingSegments: [
          {
            id: 'ceiling-seg-preview-rect',
            ceilingScopeId: 'ceiling-seg-preview',
            roomId: 'R001',
            position: 0,
            segmentName: 'Segment',
            include: 'Y' as const,
            shapeType: 'RECTANGLE' as const,
            quantity: '2',
            widthIn: '72',
            heightIn: '48',
            baseIn: '',
            manualAreaSqFt: '',
            overrideAreaSqFt: '',
            notes: '',
          },
        ],
      },
      meta: {
        ...params.meta,
        catalogs: {
          ...params.meta.catalogs,
          ceiling_types: [
            ...params.meta.catalogs.ceiling_types,
            { id: 'COFFERED', label: 'Coffered', labor_mult: 1.5, area_factor: 1.25 },
          ],
        },
        lastSavedSnapshot: {
          payload: fixture.currentSnapshot.payload,
          comparisonKey: 'dirty-ceiling-preview-metrics',
        },
      },
      selectedRoomCeilingScopes: [],
    }

    const { result } = renderHook(() => useEstimateV2CalculationDerived(dirtyParams))
    const metrics = result.current.ceilingScopePreviewMetricsById

    expect(metrics.get('ceiling-seg-preview')).toMatchObject({
      baseAreaSqFt: 48,
      helperExtraAreaSqFt: 0,
      areaFactor: 1,
      effectiveAreaSqFt: 48,
    })
    expect(metrics.get('ceiling-vaulted-preview')).toMatchObject({
      baseAreaSqFt: 120,
      helperExtraAreaSqFt: 24,
      effectiveAreaSqFt: 144,
    })
    expect(metrics.get('ceiling-coffered-preview')).toMatchObject({
      baseAreaSqFt: 120,
      helperExtraAreaSqFt: 23.3333,
      areaFactor: 1.25,
      effectiveAreaSqFt: 179.1666,
    })
    expect(metrics.get('ceiling-override-preview')).toMatchObject({
      finalAreaSqFt: 120,
      effectiveAreaSqFt: 77,
    })
    expect(metrics.get('ceiling-missing-preview')).toMatchObject({
      baseAreaSqFt: null,
      finalAreaSqFt: null,
      effectiveAreaSqFt: null,
    })
  })

  it('updates ROOM_PERIMETER trim measurement from dirty room dimensions immediately', () => {
    const { fixture, params } = buildHookParams()
    const dirtyParams = {
      ...params,
      collections: {
        ...params.collections,
        rooms: params.collections.rooms.map((room) =>
          room.roomId === 'R001' ? { ...room, lengthIn: '182', widthIn: '146' } : room
        ),
        trimScopes: params.collections.trimScopes.map((scope) =>
          scope.id === 'trim-r001-main' ? { ...scope, helperValue: '44', overrideTotal: '' } : scope
        ),
      },
      meta: {
        ...params.meta,
        lastSavedSnapshot: {
          payload: fixture.currentSnapshot.payload,
          comparisonKey: 'dirty-room-perimeter-trim',
        },
      },
    }

    const { result } = renderHook(() => useEstimateV2CalculationDerived(dirtyParams))

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.trimScopeEffectiveMeasurementById.get('trim-r001-main')).toBe(54.6667)
    expect(result.current.selectedTrimMeasurement).toBe(54.6667)
    expect(result.current.activeScopeTotals.trimMeasurement).toBe(54.6667)
    expect(result.current.activeScopeTotals.trimUnit).toBe('LF')
  })

  it('previews dirty override-driven dollar totals before save or reload', () => {
    const { fixture, params } = buildHookParams()
    const dirtyParams = {
      ...params,
      collections: {
        ...params.collections,
        scopes: params.collections.scopes.map((scope) =>
          scope.id === 'wall-r001-main'
            ? { ...scope, overridePaintHours: '3', overrideTotal: '' }
            : scope
        ),
        ceilingScopes: params.collections.ceilingScopes.map((scope) =>
          scope.id === 'ceiling-r001-main'
            ? { ...scope, overridePaintGallons: '1.25', overrideSupplyCost: '42', overrideTotal: '' }
            : scope
        ),
        trimScopes: params.collections.trimScopes.map((scope) =>
          scope.id === 'trim-r001-main'
            ? { ...scope, overrideHours: '2', overrideSupplyCost: '18', overrideTotal: '' }
            : scope
        ),
        doorScopes: params.collections.doorScopes.map((scope) =>
          scope.id === 'door-r001-main'
            ? { ...scope, overrideMaterialCost: '80', overrideTotal: '' }
            : scope
        ),
        drywallRepairs: params.collections.drywallRepairs.map((repair) =>
          repair.id === 'drywall-r001-wall' ? { ...repair, overrideTotal: '55' } : repair
        ),
      },
      meta: {
        ...params.meta,
        lastSavedSnapshot: {
          payload: fixture.currentSnapshot.payload,
          comparisonKey: 'dirty-override-driven-total-preview',
        },
      },
    }

    const { result } = renderHook(() => useEstimateV2CalculationDerived(dirtyParams))

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBeGreaterThan(0)
    expect(result.current.selectedWallSubtotal).toBe(result.current.wallScopeEffectiveTotalById.get('wall-r001-main'))
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBeGreaterThanOrEqual(42)
    expect(result.current.selectedCeilingSubtotal).toBe(
      result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')
    )
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBeGreaterThanOrEqual(18)
    expect(result.current.doorScopeEffectiveTotalById.get('door-r001-main')).toBe(80)
    expect(result.current.drywallRepairEffectiveTotalById.get('drywall-r001-wall')).toBe(55)
  })

  it('returns to canonical server calculations when the dirty snapshot matches again', () => {
    const { params } = buildHookParams()
    const cleanPayloadSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: params.meta.jobSettingsDraft,
      rooms: params.collections.rooms,
      scopes: params.collections.scopes,
      segments: params.collections.segments,
      roomFlags: params.collections.roomFlags,
      ceilingScopes: params.collections.ceilingScopes,
      ceilingSegments: params.collections.ceilingSegments,
      trimScopes: params.collections.trimScopes,
      doorScopes: params.collections.doorScopes,
      drywallRepairs: params.collections.drywallRepairs,
      rollers: params.collections.rollers,
      accessFees: params.collections.accessFees,
      otherItems: params.collections.otherItems,
    })

    const { result } = renderHook(() =>
      useEstimateV2CalculationDerived({
        ...params,
        meta: {
          ...params.meta,
          lastSavedSnapshot: cleanPayloadSnapshot,
        },
      })
    )

    expect(result.current.dirty).toBe(false)
    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(120)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBe(180)
    expect(result.current.selectedCeilingSubtotal).toBe(180)
    expect(result.current.doorScopeEffectiveUnitsById.get('door-r001-main')).toBe(4)
    expect(result.current.doorScopeEffectiveTotalById.get('door-r001-main')).toBe(125)
    expect(result.current.selectedDoorSubtotal).toBe(125)
    expect(result.current.drywallRepairEffectiveTotalById.get('drywall-r001-wall')).toBe(64)
    expect(result.current.selectedWallDrywallSubtotal).toBe(64)
  })
})
