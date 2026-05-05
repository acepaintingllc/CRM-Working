import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

describe('useEstimateV2CalculationDerived', () => {
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
            ceilingGeometryMode: 'FLAT',
            overrideAreaSqFt: '',
          },
          {
            ...baseScope,
            id: 'ceiling-vaulted-preview',
            ceilingTypeId: 'CEIL-FLAT',
            ceilingGeometryMode: 'VAULTED',
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
            ceilingGeometryMode: 'COFFERED',
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
            ceilingGeometryMode: 'FLAT',
            overrideAreaSqFt: '77',
          },
          {
            ...baseScope,
            id: 'ceiling-missing-preview',
            roomId: 'R404',
            ceilingTypeId: 'CEIL-FLAT',
            ceilingGeometryMode: 'FLAT',
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
