import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import type { EstimateV2DestructiveIntent } from '../estimateV2DestructiveConfirm'
import { buildEstimateV2DestructiveConfirmVm } from '../estimateV2DestructiveConfirm'
import { useEstimateV2CeilingActions } from '../useEstimateV2CeilingActions'
import { useEstimateV2DoorActions } from '../useEstimateV2DoorActions'
import { useEstimateV2DrywallActions } from '../useEstimateV2DrywallActions'
import { useEstimateV2RoomActions } from '../useEstimateV2RoomActions'
import { useEstimateV2TrimActions } from '../useEstimateV2TrimActions'
import { useEstimateV2WallActions } from '../useEstimateV2WallActions'

function createDestructiveHooksHarness() {
  const fixture = createMixedEstimateV2Fixture()
  const doorTypeOptions = [
    {
      id: 'DOOR_PANEL',
      label: 'Panel Door',
      unit_rate_type: 'per_side',
      unit: 'side',
      default_qty: 1,
      labor_rate: 45,
      material_rate: 18,
      amount: 63,
    },
  ]
  const drywallRateOptions = [
    {
      id: 'flat_wall_crack',
      label: 'Flat Wall Crack',
      unit_rate_type: 'unit',
      unit: 'LF',
      amount: 12,
      ceiling_multiplier: 1.2,
    },
    {
      id: 'ceiling_crack',
      label: 'Ceiling Crack',
      unit_rate_type: 'unit',
      unit: 'LF',
      amount: 14,
      ceiling_multiplier: 1.2,
    },
  ]
  const doorScopes = [
    {
      id: 'door-r001-main',
      roomId: 'R001',
      position: 0,
      include: 'Y' as const,
      scopeName: 'Front Door',
      doorTypeId: 'DOOR_PANEL',
      quantity: '1',
      sides: '2',
      colorId: 'COLOR3',
      paintProductId: 'P-TRIM',
      primerProductId: 'P-TRIM-PRIMER',
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
      quantity: '8',
      overrideTotal: '',
    },
  ]
  const requestDestructiveConfirm = vi.fn<(intent: EstimateV2DestructiveIntent) => void>()
  const store = createEstimateV2Store({
    collections: {
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      accessFees: fixture.accessFees,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
      doorScopes,
      drywallRepairs,
    },
    meta: {
      loading: false,
      saving: false,
      estimate: fixture.estimate,
      job: fixture.job,
      catalogs: {
        ...fixture.catalogs,
        door_types: doorTypeOptions,
        drywall_rates: drywallRateOptions,
      },
      wallCalculations: fixture.wallCalculations,
      ceilingCalculations: fixture.ceilingCalculations,
      trimCalculations: fixture.trimCalculations,
      doorCalculations: null,
      drywallCalculations: null,
      selectedRoomId: 'R001',
      error: null,
      validationIssues: [],
      lastSavedSnapshot: fixture.currentSnapshot,
      saveStatus: 'saved',
      autoSaveHint: null,
      settingsOpen: false,
      jobDefaultsOpen: false,
      jobSettingsDraft: fixture.jobSettingsDraft,
      orgJobProductDefaults: fixture.orgJobProductDefaults,
      customerDraft: {
        customerId: fixture.job.customer_id ?? '',
        name: fixture.job.customer_name ?? '',
        email: fixture.job.customer_email ?? '',
        phone: fixture.job.customer_phone ?? '',
        address: fixture.job.customer_address ?? '',
      },
      debugMeta: {
        dirtySource: null,
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      },
    },
  })

  const roomModeById = new Map<string, 'RECT' | 'SEG'>([
    ['R001', 'RECT'],
    ['R002', 'SEG'],
  ])
  const roomHeightFactorByRoomId = new Map<string, string>([
    ['R001', '1'],
    ['R002', '1'],
  ])

  return {
    fixture,
    store,
    requestDestructiveConfirm,
    roomModeById,
    roomHeightFactorByRoomId,
    doorTypeOptions,
    drywallRateOptions,
  }
}

function getRequestedIntent(
  requestDestructiveConfirm: ReturnType<typeof vi.fn<(intent: EstimateV2DestructiveIntent) => void>>
) {
  expect(requestDestructiveConfirm).toHaveBeenCalledTimes(1)
  return requestDestructiveConfirm.mock.calls[0][0]
}

describe('Estimator V2 destructive action hooks', () => {
  it('gates room delete behind a destructive intent, preserves state on cancel, and deletes on confirm', () => {
    const harness = createDestructiveHooksHarness()
    const roomHook = renderHook(() =>
      useEstimateV2RoomActions({
        store: harness.store,
        roomModeById: harness.roomModeById,
        trimTypeOptions: harness.fixture.catalogs.trim_items,
        requestDestructiveConfirm: harness.requestDestructiveConfirm,
      })
    )

    const roomsBefore = harness.store.getState().collections.rooms
    const scopesBefore = harness.store.getState().collections.scopes

    act(() => {
      roomHook.result.current.deleteRoom('R001')
    })

    const intent = getRequestedIntent(harness.requestDestructiveConfirm)
    const vm = buildEstimateV2DestructiveConfirmVm(intent)

    expect(intent.kind).toBe('room-delete')
    expect(harness.store.getState().collections.rooms).toEqual(roomsBefore)
    expect(harness.store.getState().collections.scopes).toEqual(scopesBefore)
    expect(vm.title).toBe('Delete Living Room (R001)?')
    expect(vm.warning).toContain('all wall, ceiling, trim, door, and drywall rows')

    act(() => {
      intent.run()
    })

    expect(harness.store.getState().collections.rooms.some((room) => room.roomId === 'R001')).toBe(
      false
    )
  })

  it('gates SEG to RECT reset behind a destructive intent and only resets segments on confirm', () => {
    const harness = createDestructiveHooksHarness()
    const roomHook = renderHook(() =>
      useEstimateV2RoomActions({
        store: harness.store,
        roomModeById: harness.roomModeById,
        trimTypeOptions: harness.fixture.catalogs.trim_items,
        requestDestructiveConfirm: harness.requestDestructiveConfirm,
      })
    )

    const segmentsBefore = harness.store.getState().collections.segments.filter(
      (segment) => segment.roomId === 'R002'
    )
    const ceilingSegmentsBefore = harness.store.getState().collections.ceilingSegments.filter(
      (segment) => segment.roomId === 'R002'
    )

    act(() => {
      roomHook.result.current.switchRoomGeometryMode('R002', 'RECT')
    })

    const intent = getRequestedIntent(harness.requestDestructiveConfirm)
    const vm = buildEstimateV2DestructiveConfirmVm(intent)

    expect(intent.kind).toBe('room-geometry-reset')
    expect(harness.store.getState().collections.segments.filter((segment) => segment.roomId === 'R002')).toEqual(segmentsBefore)
    expect(
      harness.store.getState().collections.ceilingSegments.filter((segment) => segment.roomId === 'R002')
    ).toEqual(ceilingSegmentsBefore)
    expect(vm.title).toBe('Reset Kitchen (R002) geometry?')
    expect(vm.warning).toContain('SEG wall and ceiling scopes and segments')

    act(() => {
      intent.run()
    })

    expect(
      harness.store.getState().collections.segments.filter((segment) => segment.roomId === 'R002')
    ).toEqual([])
    expect(
      harness.store.getState().collections.ceilingSegments.filter((segment) => segment.roomId === 'R002')
    ).toEqual([])
  })

  it('gates wall scope deletion and names the scope and nested segments in the dialog copy', () => {
    const harness = createDestructiveHooksHarness()
    const wallHook = renderHook(() =>
      useEstimateV2WallActions({
        store: harness.store,
        roomModeById: harness.roomModeById,
        requestDestructiveConfirm: harness.requestDestructiveConfirm,
      })
    )

    const scopesBefore = harness.store.getState().collections.scopes
    const segmentsBefore = harness.store.getState().collections.segments

    act(() => {
      wallHook.result.current.deleteScope('R002', 'wall-r002-main')
    })

    const intent = getRequestedIntent(harness.requestDestructiveConfirm)
    const vm = buildEstimateV2DestructiveConfirmVm(intent)

    expect(intent.kind).toBe('wall-scope-delete')
    expect(harness.store.getState().collections.scopes).toEqual(scopesBefore)
    expect(harness.store.getState().collections.segments).toEqual(segmentsBefore)
    expect(vm.title).toBe('Delete Kitchen Angles?')
    expect(vm.warning).toContain('2 wall segments')

    act(() => {
      intent.run()
    })

    expect(
      harness.store.getState().collections.scopes.some((scope) => scope.id === 'wall-r002-main')
    ).toBe(false)
    expect(
      harness.store.getState().collections.segments.some(
        (segment) => segment.wallScopeId === 'wall-r002-main'
      )
    ).toBe(false)
  })

  it('gates ceiling scope deletion and names the scope and nested segments in the dialog copy', () => {
    const harness = createDestructiveHooksHarness()
    const ceilingHook = renderHook(() =>
      useEstimateV2CeilingActions({
        store: harness.store,
        roomModeById: harness.roomModeById,
        requestDestructiveConfirm: harness.requestDestructiveConfirm,
      })
    )

    const scopesBefore = harness.store.getState().collections.ceilingScopes
    const segmentsBefore = harness.store.getState().collections.ceilingSegments

    act(() => {
      ceilingHook.result.current.deleteScope('R002', 'ceiling-r002-main')
    })

    const intent = getRequestedIntent(harness.requestDestructiveConfirm)
    const vm = buildEstimateV2DestructiveConfirmVm(intent)

    expect(intent.kind).toBe('ceiling-scope-delete')
    expect(harness.store.getState().collections.ceilingScopes).toEqual(scopesBefore)
    expect(harness.store.getState().collections.ceilingSegments).toEqual(segmentsBefore)
    expect(vm.title).toBe('Delete Kitchen Tray?')
    expect(vm.warning).toContain('1 ceiling segment')

    act(() => {
      intent.run()
    })

    expect(
      harness.store.getState().collections.ceilingScopes.some(
        (scope) => scope.id === 'ceiling-r002-main'
      )
    ).toBe(false)
    expect(
      harness.store.getState().collections.ceilingSegments.some(
        (segment) => segment.ceilingScopeId === 'ceiling-r002-main'
      )
    ).toBe(false)
  })

  it('gates trim scope deletion and uses the trim scope name in dialog copy', () => {
    const harness = createDestructiveHooksHarness()
    const trimHook = renderHook(() =>
      useEstimateV2TrimActions({
        store: harness.store,
        trimTypeOptions: harness.fixture.catalogs.trim_items,
        roomModeById: harness.roomModeById,
        roomHeightFactorByRoomId: harness.roomHeightFactorByRoomId,
        requestDestructiveConfirm: harness.requestDestructiveConfirm,
      })
    )

    const trimBefore = harness.store.getState().collections.trimScopes

    act(() => {
      trimHook.result.current.deleteScope('R001', 'trim-r001-main')
    })

    const intent = getRequestedIntent(harness.requestDestructiveConfirm)
    const vm = buildEstimateV2DestructiveConfirmVm(intent)

    expect(intent.kind).toBe('trim-delete')
    expect(harness.store.getState().collections.trimScopes).toEqual(trimBefore)
    expect(vm.title).toBe('Delete Baseboards?')
    expect(vm.warning).toBe('Delete trim item Baseboards.')

    act(() => {
      intent.run()
    })

    expect(
      harness.store.getState().collections.trimScopes.some((scope) => scope.id === 'trim-r001-main')
    ).toBe(false)
  })

  it('gates door scope deletion and uses the door item name in dialog copy', () => {
    const harness = createDestructiveHooksHarness()
    const doorHook = renderHook(() =>
      useEstimateV2DoorActions({
        store: harness.store,
        doorTypeOptions: harness.doorTypeOptions,
        requestDestructiveConfirm: harness.requestDestructiveConfirm,
      })
    )

    const doorsBefore = harness.store.getState().collections.doorScopes

    act(() => {
      doorHook.result.current.deleteScope('R001', 'door-r001-main')
    })

    const intent = getRequestedIntent(harness.requestDestructiveConfirm)
    const vm = buildEstimateV2DestructiveConfirmVm(intent)

    expect(intent.kind).toBe('door-delete')
    expect(harness.store.getState().collections.doorScopes).toEqual(doorsBefore)
    expect(vm.title).toBe('Delete Front Door?')
    expect(vm.warning).toBe('Delete door item Front Door.')

    act(() => {
      intent.run()
    })

    const doorsAfter = harness.store.getState().collections.doorScopes ?? []
    expect(doorsAfter.some((scope) => scope.id === 'door-r001-main')).toBe(false)
  })

  it('gates drywall repair deletion and uses the repair name in dialog copy', () => {
    const harness = createDestructiveHooksHarness()
    const drywallHook = renderHook(() =>
      useEstimateV2DrywallActions({
        store: harness.store,
        drywallRateOptions: harness.drywallRateOptions,
        requestDestructiveConfirm: harness.requestDestructiveConfirm,
      })
    )

    const repairsBefore = harness.store.getState().collections.drywallRepairs

    act(() => {
      drywallHook.result.current.deleteRepair('R001', 'drywall-r001-wall')
    })

    const intent = getRequestedIntent(harness.requestDestructiveConfirm)
    const vm = buildEstimateV2DestructiveConfirmVm(intent)

    expect(intent.kind).toBe('drywall-delete')
    expect(harness.store.getState().collections.drywallRepairs).toEqual(repairsBefore)
    expect(vm.title).toBe('Delete Flat Wall Crack?')
    expect(vm.warning).toBe('Delete Flat Wall Crack on Living Room (R001).')

    act(() => {
      intent.run()
    })

    const repairsAfter = harness.store.getState().collections.drywallRepairs ?? []
    expect(repairsAfter.some((repair) => repair.id === 'drywall-r001-wall')).toBe(false)
  })
})
