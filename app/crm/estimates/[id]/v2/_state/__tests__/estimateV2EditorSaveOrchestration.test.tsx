import { describe, expect, it } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import {
  buildEstimateV2SaveSnapshot,
  filterNonBlockingEstimateV2ValidationIssues,
  hasEstimateV2SaveStateChangedSincePrepared,
  prepareEstimateV2SavePayload,
  prepareEstimateV2SaveState,
  reconcileEstimateV2SaveResponse,
  collectEstimateV2CalculationMissingInputIssues,
  validateEstimateV2PreparedSave,
} from '../estimateV2EditorSaveOrchestration'

function createCurrentState() {
  const fixture = createMixedEstimateV2Fixture()
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
    },
    meta: {
      loading: false,
      saving: false,
      estimate: fixture.estimate,
      job: fixture.job,
      catalogs: fixture.catalogs,
      wallCalculations: fixture.wallCalculations,
      ceilingCalculations: fixture.ceilingCalculations,
      trimCalculations: fixture.trimCalculations,
      selectedRoomId: 'R001',
      error: null,
      validationIssues: [],
      lastSavedSnapshot: fixture.currentSnapshot,
      saveStatus: 'idle',
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

  return { fixture, store, currentState: store.getState() }
}

function makeDoorScope(patch = {}) {
  return {
    id: 'door-r001-main',
    roomId: 'R001',
    position: 0,
    include: 'Y' as const,
    scopeName: 'Living Room Door',
    doorTypeId: 'DOOR_PANEL',
    quantity: '1',
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
    ...patch,
  }
}

function makeDrywallRepair(patch = {}) {
  return {
    id: 'drywall-r001-main',
    roomId: 'R001',
    position: 0,
    surface: 'wall' as const,
    repairType: 'flat_wall_crack',
    unit: 'LF' as const,
    quantity: '2',
    overrideTotal: '',
    ...patch,
  }
}

function buildReconciliationCurrent(
  currentState: ReturnType<typeof createCurrentState>['currentState']
) {
  return {
    collections: {
      rooms: currentState.collections.rooms,
      roomFlags: currentState.collections.roomFlags,
      rollers: currentState.collections.rollers,
      accessFees: currentState.collections.accessFees,
      otherItems: currentState.collections.otherItems,
    },
    meta: {
      estimate: currentState.meta.estimate,
      jobSettingsDraft: currentState.meta.jobSettingsDraft,
    },
  }
}

describe('estimateV2EditorSaveOrchestration', () => {
  it('prepares the save payload from plain editor collections and job settings', () => {
    const { currentState } = createCurrentState()

    const prepared = prepareEstimateV2SavePayload({
      collections: currentState.collections,
      jobSettingsDraft: currentState.meta.jobSettingsDraft,
    })

    expect(prepared.payloadSnapshot.payload.rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          room_id: 'R001',
        }),
      ])
    )
    expect(prepared.payloadSnapshot.payload.room_wall_scopes).toHaveLength(
      currentState.collections.scopes.length
    )
    expect(prepared.payloadSnapshot.payload.room_ceiling_scopes).toHaveLength(
      currentState.collections.ceilingScopes.length
    )
    expect(prepared.payloadSnapshot.payload.room_trim_scopes).toHaveLength(
      currentState.collections.trimScopes.length
    )
    expect(prepared.payloadSnapshot.comparisonKey).toBeTruthy()
  })

  it('builds save snapshots and compares them against prepared payload snapshots', () => {
    const { currentState } = createCurrentState()
    const prepared = prepareEstimateV2SavePayload({
      collections: currentState.collections,
      jobSettingsDraft: currentState.meta.jobSettingsDraft,
    })

    const matchingSnapshot = buildEstimateV2SaveSnapshot({
      collections: currentState.collections,
      jobSettingsDraft: currentState.meta.jobSettingsDraft,
    })
    const changedSnapshot = buildEstimateV2SaveSnapshot({
      collections: {
        ...currentState.collections,
        rooms: currentState.collections.rooms.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Changed room' } : room
        ),
      },
      jobSettingsDraft: currentState.meta.jobSettingsDraft,
    })

    expect(
      hasEstimateV2SaveStateChangedSincePrepared({
        latestSnapshot: matchingSnapshot,
        prepared,
      })
    ).toBe(false)
    expect(
      hasEstimateV2SaveStateChangedSincePrepared({
        latestSnapshot: changedSnapshot,
        prepared,
      })
    ).toBe(true)
  })

  it('prepares canonical save collections with room-mode-aware validation inputs', () => {
    const { currentState } = createCurrentState()
    currentState.setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r002-excluded'
          ? {
              ...scope,
              include: 'Y',
              measurementMode: 'ROOM_HELPER',
              helperSource: 'ROOM_PERIMETER',
              helperValue: '12',
              measurementValue: '12',
            }
          : scope
      )
    )

    const prepared = prepareEstimateV2SaveState(currentState)
    const issues = validateEstimateV2PreparedSave({
      collections: currentState.collections,
      prepared,
    })

    expect(prepared.payloadSnapshot.payload.room_trim_scopes).toHaveLength(2)
    expect(issues).toEqual([])
    expect(prepared.roomModeById.get('R002')).toBe('SEG')
  })

  it('preserves trim total and supply overrides through prepared and resolved save state', () => {
    const { fixture, store } = createCurrentState()
    store.getState().setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r001-main'
          ? {
              ...scope,
              overrideMeasurement: '108',
              overrideHours: '4.5',
              overrideGallons: '0.75',
              overrideSupplyCost: '36',
              overrideTotal: '275',
              overrideDescription: 'Manual trim override',
            }
          : scope
      )
    )

    const currentState = store.getState()
    const prepared = prepareEstimateV2SaveState(currentState)
    const preparedTrimScope = prepared.collections.trimScopes.find(
      (scope) => scope.id === 'trim-r001-main'
    )
    const payloadTrimScope = prepared.payloadSnapshot.payload.room_trim_scopes.find(
      (scope) => scope.id === 'trim-r001-main'
    )

    expect(prepared.normalizedDomains).not.toContain('trim')
    expect(preparedTrimScope).toMatchObject({
      overrideMeasurement: '108',
      overrideHours: '4.5',
      overrideGallons: '0.75',
      overrideSupplyCost: '36',
      overrideTotal: '275',
      overrideDescription: 'Manual trim override',
    })
    expect(payloadTrimScope).toMatchObject({
      override_measurement: 108,
      override_hours: 4.5,
      override_gallons: 0.75,
      override_supply_cost: 36,
      override_total: 275,
      override_description: 'Manual trim override',
    })

    const result = reconcileEstimateV2SaveResponse({
      trigger: 'manual',
      payload: {
        ...fixture.summaryData,
        trim_calculations: {
          scopes: [
            {
              id: 'trim-r001-main',
              override_hours: null,
              override_supply_cost: null,
              override_total: null,
            },
          ],
        },
      },
      meta: currentState.meta,
      prepared,
      current: buildReconciliationCurrent(currentState),
      effectiveJobProductDefaults: fixture.orgJobProductDefaults,
    })
    const savedTrimScope = result.collections.trimScopes.find(
      (scope) => scope.id === 'trim-r001-main'
    )
    const savedSnapshotTrimScope =
      result.lastSavedSnapshot.payload.room_trim_scopes.find(
        (scope) => scope.id === 'trim-r001-main'
      )

    expect(savedTrimScope).toMatchObject({
      overrideHours: '4.5',
      overrideSupplyCost: '36',
      overrideTotal: '275',
    })
    expect(savedSnapshotTrimScope).toMatchObject({
      override_hours: 4.5,
      override_supply_cost: 36,
      override_total: 275,
    })
  })

  it('validates door and drywall drafts during prepared save', () => {
    const { store, currentState } = createCurrentState()
    currentState.setDoorScopes([
      makeDoorScope({
        doorTypeId: '',
        quantity: '',
        sides: '3',
      }),
    ])
    currentState.setDrywallRepairs([
      makeDrywallRepair({
        surface: 'ceiling',
        repairType: 'flat_wall_crack',
        quantity: '-1',
      }),
    ])

    const latestState = store.getState()
    const prepared = prepareEstimateV2SaveState(latestState)
    const issues = validateEstimateV2PreparedSave({
      collections: latestState.collections,
      prepared,
    })

    expect(issues).toEqual([
      'Living Room: Living Room Door: door type is required',
      'Living Room: Living Room Door: door quantity is required',
      'Living Room: Living Room Door: door sides must be 1 or 2',
      'Living Room: Ceiling drywall repair 1: repair type is not valid for the ceiling',
      'Living Room: Ceiling drywall repair 1: quantity must be nonnegative',
    ])
  })

  it('allows valid door and drywall drafts through prepared save validation', () => {
    const { store, currentState } = createCurrentState()
    currentState.setDoorScopes([makeDoorScope()])
    currentState.setDrywallRepairs([makeDrywallRepair()])

    const latestState = store.getState()
    const prepared = prepareEstimateV2SaveState(latestState)
    const issues = validateEstimateV2PreparedSave({
      collections: latestState.collections,
      prepared,
    })

    expect(issues).toEqual([])
    expect(prepared.payloadSnapshot.payload.room_door_scopes).toHaveLength(1)
    expect(prepared.payloadSnapshot.payload.drywall_repairs).toHaveLength(1)
  })

  it('normalizes SEG ceiling scope ids before save and keeps included segments linked', () => {
    const { fixture, store } = createCurrentState()
    const localCeilingScopeId = 'ceiling-r001-seg-local'
    const localCeilingSegmentId = 'ceiling-r001-seg-local-main'
    store.getState().setCeilingScopes([
      {
        ...fixture.ceilingScopes[0],
        id: localCeilingScopeId,
        roomId: 'R001',
        position: 0,
        mode: 'SEG',
        include: 'Y',
        lengthIn: '',
        widthIn: '',
      },
    ])
    store.getState().setCeilingSegments([
      {
        ...fixture.ceilingSegments[0],
        id: localCeilingSegmentId,
        ceilingScopeId: localCeilingScopeId,
        roomId: 'R001',
        position: 0,
        include: 'Y',
        shapeType: 'RECTANGLE',
        widthIn: '126',
        heightIn: '90',
        manualAreaSqFt: '',
      },
    ])

    const currentState = store.getState()
    const prepared = prepareEstimateV2SaveState(currentState)
    const savePayload = prepared.payloadSnapshot.payload
    const savedScope = prepared.collections.ceilingScopes[0]
    const savedSegment = prepared.collections.ceilingSegments[0]

    expect(savedScope.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
    expect(savedScope.id).not.toBe(localCeilingScopeId)
    expect(savedSegment.ceilingScopeId).toBe(savedScope.id)
    expect(savedSegment.id).not.toBe(localCeilingSegmentId)
    expect(savePayload.ceiling_scope_segments).toEqual([
      expect.objectContaining({
        ceiling_scope_id: savedScope.id,
        include: 'Y',
        width_in: 126,
        height_in: 90,
      }),
    ])
    expect(
      savePayload.ceiling_scope_segments.filter(
        (segment) => segment.ceiling_scope_id === savedScope.id && segment.include === 'Y'
      )
    ).toHaveLength(1)

    const result = reconcileEstimateV2SaveResponse({
      trigger: 'manual',
      payload: {
        ...fixture.summaryData,
        ceiling_calculations: {
          scopes: savePayload.room_ceiling_scopes,
          segments: savePayload.ceiling_scope_segments.map((segment) => ({
            ...segment,
            ceiling_scope_id: 'response-clobbered',
          })),
        },
      },
      meta: currentState.meta,
      prepared,
      current: buildReconciliationCurrent(currentState),
      effectiveJobProductDefaults: fixture.orgJobProductDefaults,
    })

    expect(result.collections.ceilingSegments).toEqual([
      expect.objectContaining({
        ceilingScopeId: savedScope.id,
        include: 'Y',
        widthIn: '126',
        heightIn: '90',
      }),
    ])
  })

  it('reconciles manual save responses back to canonical collections without duplicating job defaults', () => {
    const { fixture, currentState } = createCurrentState()
    const prepared = prepareEstimateV2SaveState(currentState)
    const savedAt = '2026-05-04T15:30:00.000Z'

    const result = reconcileEstimateV2SaveResponse({
      trigger: 'manual',
      payload: {
        ...fixture.summaryData,
        estimate: {
          ...fixture.summaryData.estimate,
          updated_at: savedAt,
        },
      },
      meta: currentState.meta,
      prepared,
      current: buildReconciliationCurrent(currentState),
      effectiveJobProductDefaults: fixture.orgJobProductDefaults,
    })

    expect(
      result.collections.scopes.find((scope) => scope.id === 'wall-r001-main')?.paintProductId
    ).toBe('')
    expect(
      result.collections.ceilingScopes.find((scope) => scope.id === 'ceiling-r001-main')
        ?.primerProductId
    ).toBe('')
    expect(result.calculations.wallCalculations?.scopes).toHaveLength(
      fixture.wallCalculations.scopes?.length ?? 0
    )
    expect(result.estimate?.updated_at).toBe(savedAt)
    expect(result.lastSavedSnapshot.comparisonKey).toBeTruthy()
  })

  it('preserves prepared draft collections when manual save responses include calculated rows', () => {
    const { fixture, store } = createCurrentState()

    store.getState().setRooms((prev) => [
      ...prev,
      {
        ...prev[0],
        id: 'room-3',
        roomId: 'R003',
        roomName: 'Room 3',
        lengthIn: '',
        widthIn: '',
        heightIn: '',
        position: 2,
      },
    ])
    store.getState().setScopes((prev) => [
      ...prev,
      {
        ...prev[0],
        id: 'wall-r003-excluded',
        roomId: 'R003',
        position: 0,
        mode: 'RECT',
        include: 'N',
        scopeName: 'Room 3 excluded walls',
        primeMode: 'FULL',
        heightIn: '',
        perimeterIn: '',
      },
    ])
    store.getState().setCeilingScopes((prev) => [
      ...prev,
      {
        ...prev[0],
        id: 'ceiling-r003-excluded',
        roomId: 'R003',
        position: 0,
        mode: 'RECT',
        include: 'N',
        scopeName: 'Room 3 excluded ceiling',
        primeMode: 'FULL',
        lengthIn: '',
        widthIn: '',
      },
    ])
    store.getState().setCeilingSegments((prev) => [
      ...prev,
      {
        ...prev[0],
        id: 'ceiling-seg-r003-excluded',
        ceilingScopeId: 'ceiling-r003-excluded',
        roomId: 'R003',
        position: 0,
      },
    ])
    store.getState().setTrimScopes((prev) => [
      ...prev.map((scope) =>
        scope.id === 'trim-r002-excluded'
          ? {
              ...scope,
              include: 'Y' as const,
              measurementMode: 'ROOM_HELPER' as const,
              helperSource: 'ROOM_PERIMETER' as const,
              measurementValue: '',
              helperValue: '12',
            }
          : scope
      ),
      {
        ...prev[0],
        id: 'trim-r003-excluded',
        roomId: 'R003',
        position: 0,
        include: 'N' as const,
        scopeName: 'Room 3 excluded trim',
        measurementMode: 'MANUAL' as const,
        helperSource: '' as const,
        measurementValue: '',
        helperValue: '',
        primeMode: 'FULL',
      },
    ])

    const currentState = store.getState()
    const prepared = prepareEstimateV2SaveState(currentState)
    const savePayload = prepared.payloadSnapshot.payload
    const expectedCeilingSegmentScopeIds = prepared.collections.ceilingSegments.map(
      (segment) => segment.ceilingScopeId
    )

    const result = reconcileEstimateV2SaveResponse({
      trigger: 'manual',
      payload: {
        ...fixture.summaryData,
        wall_calculations: {
          scopes: savePayload.room_wall_scopes.map((scope) => ({
            ...scope,
            include: scope.id === 'wall-r003-excluded' ? 'Y' : scope.include,
            prime_mode: scope.id === 'wall-r001-main' ? 'NONE' : scope.prime_mode,
          })),
          segments: savePayload.wall_segments,
        },
        ceiling_calculations: {
          scopes: savePayload.room_ceiling_scopes.map((scope) => ({
            ...scope,
            include: scope.id === 'ceiling-r003-excluded' ? 'Y' : scope.include,
          })),
          segments: savePayload.ceiling_scope_segments.map((segment) => ({
            ...segment,
            ceiling_scope_id: 'response-clobbered',
          })),
        },
        trim_calculations: {
          scopes: savePayload.room_trim_scopes.map((scope) => ({
            ...scope,
            include:
              scope.id === 'trim-r002-excluded'
                ? 'N'
                : scope.id === 'trim-r003-excluded'
                  ? 'Y'
                  : scope.include,
            measurement_mode:
              scope.id === 'trim-r001-main' ? 'MANUAL' : scope.measurement_mode,
            measurement_value: scope.id === 'trim-r001-main' ? null : scope.measurement_value,
            helper_source: scope.id === 'trim-r001-main' ? null : scope.helper_source,
            helper_value: scope.id === 'trim-r001-main' ? null : scope.helper_value,
          })),
        },
      },
      meta: currentState.meta,
      prepared,
      current: buildReconciliationCurrent(currentState),
      effectiveJobProductDefaults: fixture.orgJobProductDefaults,
    })

    expect(result.collections.scopes.find((scope) => scope.id === 'wall-r001-main')?.primeMode).toBe(
      'FULL'
    )
    expect(
      result.collections.scopes.find((scope) => scope.id === 'wall-r003-excluded')?.include
    ).toBe('N')
    expect(
      result.collections.ceilingScopes.find((scope) => scope.id === 'ceiling-r003-excluded')
        ?.include
    ).toBe('N')
    expect(result.collections.ceilingSegments.map((segment) => segment.ceilingScopeId)).toEqual(
      expectedCeilingSegmentScopeIds
    )
    expect(
      result.collections.trimScopes.find((scope) => scope.id === 'trim-r002-excluded')
        ?.include
    ).toBe('Y')
    expect(
      result.collections.trimScopes.find((scope) => scope.id === 'trim-r001-main')
    ).toMatchObject({
      measurementMode: 'ROOM_HELPER',
      helperSource: 'ROOM_PERIMETER',
      measurementValue: '',
      helperValue: '44',
    })
    expect(
      result.collections.trimScopes.find((scope) => scope.id === 'trim-r003-excluded')?.include
    ).toBe('N')
  })

  it('filters non-blocking paint assumption required messages without hiding real validation issues', () => {
    const issues = filterNonBlockingEstimateV2ValidationIssues([
      'Walls: Scope 1: paint_prod_rate_sqft_per_hour is required',
      'Walls: Scope 1: paint_prod_rate_sqft_per_hour is required',
      'Walls: Scope 1: paint_coverage_sqft_per_gal_per_coat is required',
      'Walls: Scope 1: paint_price_per_gal is required',
      'Ceilings: Ceiling scope 1: paint_coverage_sqft_per_gal_per_coat is required',
      'Ceilings: Ceiling scope 1: paint_price_per_gal is required',
      'Trim: Trim scope 1: paint_coverage_units_per_gal_per_coat is required',
      'Trim: Trim scope 1: paint_price_per_gal is required',
      'R001: height is required for RECT wall mode',
    ])

    expect(issues).toEqual(['R001: height is required for RECT wall mode'])
  })

  it('formats calculator missing inputs as editor validation issues', () => {
    const issues = collectEstimateV2CalculationMissingInputIssues({
      wallCalculations: {
        missing_inputs: [
          {
            level: 'scope',
            room_id: 'R001',
            scope_id: 'wall-1',
            segment_id: null,
            field: 'paint_prod_rate_sqft_per_hour',
            message: 'Scope Main: paint_prod_rate_sqft_per_hour is required',
          },
        ],
      },
      ceilingCalculations: { missing_inputs: [] },
      trimCalculations: null,
      doorCalculations: {
        missing_inputs: [
          {
            level: 'scope',
            room_id: 'R002',
            scope_id: 'door-1',
            segment_id: null,
            field: 'quantity',
            message: 'Door scope 1: quantity is required',
          },
        ],
      },
      drywallCalculations: undefined,
    })

    expect(issues).toEqual(['Doors: Door scope 1: quantity is required'])
  })

  it('ignores calculator missing inputs tied to excluded scopes', () => {
    const issues = collectEstimateV2CalculationMissingInputIssues({
      wallCalculations: {
        scopes: [{ id: 'wall-excluded', include: 'N' }],
        missing_inputs: [
          {
            level: 'scope',
            room_id: 'R001',
            scope_id: 'wall-excluded',
            segment_id: null,
            field: 'height_in',
            message: 'Scope 1: height is required',
          },
        ],
      },
      ceilingCalculations: {
        scopes: [{ scope_key: 'ceiling-excluded', include: 'N' }],
        missing_inputs: [
          {
            level: 'scope',
            room_id: 'R001',
            scope_id: 'ceiling-excluded',
            segment_id: null,
            field: 'length_in',
            message: 'Ceiling scope 1: length is required',
          },
        ],
      },
      trimCalculations: {
        scopes: [{ id: 'trim-included', include: 'Y' }],
        missing_inputs: [
          {
            level: 'scope',
            room_id: 'R001',
            scope_id: 'trim-included',
            segment_id: null,
            field: 'measurement_value',
            message: 'Trim scope 1: measurement is required',
          },
        ],
      },
      doorCalculations: { missing_inputs: [] },
      drywallCalculations: undefined,
    })

    expect(issues).toEqual(['Trim: Trim scope 1: measurement is required'])
  })
})
