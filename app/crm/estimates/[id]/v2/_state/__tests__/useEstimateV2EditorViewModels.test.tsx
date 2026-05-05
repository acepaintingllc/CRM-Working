import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { useEstimateV2EditorViewModels } from '../useEstimateV2EditorViewModels'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import type { EstimateV2PaintProductOption } from '@/types/estimator/v2'

function createViewModelParams() {
  const fixture = createMixedEstimateV2Fixture()
  const selectedRoom = fixture.rooms[0]
  const paintProducts = fixture.catalogs.paint_products as EstimateV2PaintProductOption[]
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
      catalogsError: null,
      error: null,
      validationIssues: ['R001: Needs paint selection'],
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

  const derived = {
    catalog: {
      roomTypeOptions: fixture.catalogs.room_types,
      wallPaintOptions: paintProducts.filter((product) => product.type !== 'primer'),
      wallPrimerOptions: paintProducts.filter((product) => product.type === 'primer'),
      wallProductionRates: fixture.catalogs.production_rates,
      colorCodeOptions: fixture.catalogs.color_codes,
      ceilingPaintOptions: paintProducts.filter((product) => product.type !== 'primer'),
      ceilingPrimerOptions: paintProducts.filter((product) => product.type === 'primer'),
      trimPaintOptions: paintProducts.filter((product) => product.type !== 'primer'),
      trimPrimerOptions: paintProducts.filter((product) => product.type === 'primer'),
      trimTypeOptions: fixture.catalogs.trim_items,
      doorTypeOptions: [],
    },
    room: {
      selectedRoom,
      selectedRoomResolvedMode: 'RECT' as const,
      selectedRoomGeometryMode: 'RECT' as const,
      roomScopeByRoomId: new Map([
        ['R001', fixture.scopes.filter((scope) => scope.roomId === 'R001')],
        ['R002', fixture.scopes.filter((scope) => scope.roomId === 'R002')],
      ]),
      roomCeilingScopeByRoomId: new Map([
        ['R001', fixture.ceilingScopes.filter((scope) => scope.roomId === 'R001')],
        ['R002', fixture.ceilingScopes.filter((scope) => scope.roomId === 'R002')],
      ]),
      roomTrimScopeByRoomId: new Map([
        ['R001', fixture.trimScopes.filter((scope) => scope.roomId === 'R001')],
        ['R002', fixture.trimScopes.filter((scope) => scope.roomId === 'R002')],
      ]),
      roomDoorScopeByRoomId: new Map(),
      activeRoomFlagCount: 0,
      selectedRoomIssueCount: 1,
      selectedRoomScopes: fixture.scopes.filter((scope) => scope.roomId === 'R001'),
      firstScope: fixture.scopes[0],
      wallsIncluded: true,
      selectedRoomCeilingScopes: fixture.ceilingScopes.filter((scope) => scope.roomId === 'R001'),
      firstCeilingScope: fixture.ceilingScopes[0],
      ceilingsIncluded: true,
      selectedRoomTrimScopes: fixture.trimScopes.filter((scope) => scope.roomId === 'R001'),
      firstTrimScope: fixture.trimScopes[0],
      trimsIncluded: true,
      jobTrimsIncluded: true,
      selectedRoomDoorScopes: [],
      firstDoorScope: null,
      doorsIncluded: false,
      jobDoorsIncluded: false,
    },
    calculation: {
      displayedRoomEffectiveAreaByRoomId: new Map([
        ['R001', 396],
        ['R002', 80],
      ]),
      selectedRoomEffectiveSqFt: 396,
      displayedSegmentEffectiveAreaById: new Map([
        ['wall-seg-r002-1', 64],
        ['wall-seg-r002-2', 16],
      ]),
      displayedScopeEffectiveAreaById: new Map([
        ['wall-r001-main', 396],
        ['wall-r002-main', 80],
      ]),
      wallScopeEffectiveTotalById: new Map([['wall-r001-main', 300]]),
      selectedWallSubtotal: 300,
      selectedCeilingEffectiveSqFt: 120,
      ceilingScopePreviewMetricsById: new Map([
        [
          'ceiling-r001-main',
          {
            baseAreaSqFt: 120,
            helperExtraAreaSqFt: 0,
            areaFactor: 1,
            finalAreaSqFt: 120,
            effectiveAreaSqFt: 120,
          },
        ],
      ]),
      ceilingScopeEffectiveTotalById: new Map([['ceiling-r001-main', 125]]),
      selectedCeilingSubtotal: 125,
      trimScopeEffectiveMeasurementById: new Map([['trim-r001-main', 44]]),
      trimScopeEffectiveTotalById: new Map([['trim-r001-main', 210]]),
      selectedTrimSubtotal: 210,
      selectedTrimMeasurement: 44,
      doorScopeEffectiveUnitsById: new Map(),
      doorScopeEffectiveTotalById: new Map(),
      selectedDoorSubtotal: null,
      selectedDoorUnits: null,
      selectedWallDrywallSubtotal: null,
      selectedCeilingDrywallSubtotal: null,
      dirty: false,
      calculationsStale: false,
      useLocalPreviewCalculations: false,
      totalEffectiveAreaSqFt: 476,
      activeScopeTotals: {
        wallsSqFt: 476,
        ceilingsSqFt: 180,
        trimMeasurement: 44,
        trimUnit: 'LF',
        trimMeasurementByUnit: new Map([['LF', 44]]),
        doorSides: 0,
        doorCount: 0,
        doorsActive: false,
      },
    },
    productLabels: {
      wallPaintLabel: 'Wall Satin',
      wallPrimerLabel: 'Wall Primer',
      effectiveWallPaintLabel: 'Wall Satin',
      effectiveWallPrimerLabel: 'Wall Primer',
      ceilingPaintLabel: 'Ceiling Flat',
      ceilingPrimerLabel: 'Ceiling Primer',
      effectiveCeilingPaintLabel: 'Ceiling Flat',
      effectiveCeilingPrimerLabel: 'Ceiling Primer',
      trimPaintLabel: 'Trim Enamel',
      trimPrimerLabel: 'Trim Primer',
      doorPaintLabel: 'Trim Enamel',
      doorPrimerLabel: 'Trim Primer',
      effectiveTrimPaintLabel: 'Trim Enamel',
      effectiveTrimPrimerLabel: 'Trim Primer',
      orgWallPaintLabel: 'Wall Satin',
      orgWallPrimerLabel: 'Wall Primer',
      orgCeilingPaintLabel: 'Ceiling Flat',
      orgCeilingPrimerLabel: 'Ceiling Primer',
      orgTrimPaintLabel: 'Trim Enamel',
      orgTrimPrimerLabel: 'Trim Primer',
    },
    save: {
      canManualSave: true,
      blockedReason: null as string | null,
      blockingIssues: [] as string[],
      visibleValidationIssues: ['R001: Needs paint selection'],
      saveStatusText: 'Saved Apr 21, 2:00 PM',
      saveStatusColor: 'var(--v2-ink-3)',
    },
  }

  return {
    estimateId: fixture.estimate.id,
    store,
    derived,
    roomActions: {
      addRoom: vi.fn(),
      deleteRoom: vi.fn(),
      updateRoom: vi.fn(),
      updateRoomComplexity: vi.fn(),
      toggleFlag: vi.fn(),
      handleRoomDimChange: vi.fn(),
      switchRoomGeometryMode: vi.fn(),
    },
    wallActions: {
      addScope: vi.fn(),
      moveScope: vi.fn(),
      deleteScope: vi.fn(),
      updateScope: vi.fn(),
      addSegment: vi.fn(),
      moveSegment: vi.fn(),
      deleteSegment: vi.fn(),
      updateSegment: vi.fn(),
      toggleRoomInclude: vi.fn(),
    },
    ceilingActions: {
      updateScope: vi.fn(),
      addScope: vi.fn(),
      deleteScope: vi.fn(),
      moveScope: vi.fn(),
      addSegment: vi.fn(),
      deleteSegment: vi.fn(),
      moveSegment: vi.fn(),
      updateSegment: vi.fn(),
      toggleRoomInclude: vi.fn(),
    },
    trimActions: {
      updateScope: vi.fn(),
      addScope: vi.fn(),
      moveScope: vi.fn(),
      deleteScope: vi.fn(),
      toggleRoomInclude: vi.fn(),
      updateTrimType: vi.fn(),
    },
    doorActions: {
      updateScope: vi.fn(),
      addScope: vi.fn(),
      moveScope: vi.fn(),
      deleteScope: vi.fn(),
      toggleRoomInclude: vi.fn(),
      updateDoorType: vi.fn(),
    },
    settingsActions: {
      updateJobSettings: vi.fn(),
      updateCustomer: vi.fn(),
      flushCustomerSave: vi.fn(),
    },
    save: vi.fn(async () => true),
    saveDraft: vi.fn(),
    saveAndContinue: vi.fn(),
  }
}

describe('useEstimateV2EditorViewModels', () => {
  it('uses scope-neutral empty selection copy for the room inputs workspace', () => {
    const params = createViewModelParams()

    const { result } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: params } }
    )

    expect(result.current.pageVm.emptySelectionMessage).toBe(
      'Add a room or select one from the roster to start editing room inputs.'
    )
    expect(result.current.ceilingsVm.ceilingScopePreviewMetricsById.get('ceiling-r001-main')).toMatchObject({
      baseAreaSqFt: 120,
      effectiveAreaSqFt: 120,
    })
  })

  it('opens the shared editor settings drawer state from the header Settings action', () => {
    const params = createViewModelParams()

    const { result } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: params } }
    )

    expect(result.current.headerVm.settingsOpen).toBe(false)
    expect(result.current.jobSettingsVm.settingsOpen).toBe(false)

    act(() => {
      result.current.headerVm.toggleSettings()
    })

    expect(result.current.headerVm.settingsOpen).toBe(true)
    expect(result.current.jobSettingsVm.settingsOpen).toBe(true)
  })

  it('keeps save enabled for valid dirty drafts and disables it for invalid dirty drafts', () => {
    const baseParams = createViewModelParams()

    const { result, rerender } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: baseParams } }
    )

    expect(result.current.saveVm.dirty).toBe(false)

    rerender({
      nextParams: {
        ...baseParams,
        derived: {
          ...baseParams.derived,
          calculation: {
            ...baseParams.derived.calculation,
            dirty: true,
          },
          save: {
            ...baseParams.derived.save,
            canManualSave: true,
            blockedReason: null,
            blockingIssues: [],
            visibleValidationIssues: [],
            saveStatusText: 'Unsaved changes - ready to save',
            saveStatusColor: '#f9e2b7',
          },
        },
      },
    })

    expect(result.current.saveVm.dirty).toBe(true)
    expect(result.current.saveVm.canManualSave).toBe(true)
    expect(result.current.pageVm.validationIssues).toEqual([])

    rerender({
      nextParams: {
        ...baseParams,
        derived: {
          ...baseParams.derived,
          calculation: {
            ...baseParams.derived.calculation,
            dirty: true,
          },
          save: {
            ...baseParams.derived.save,
            canManualSave: false,
            blockedReason: 'R001: height is required for RECT wall mode',
            blockingIssues: ['R001: height is required for RECT wall mode'],
            visibleValidationIssues: ['R001: height is required for RECT wall mode'],
            saveStatusText:
              'Unsaved changes - save blocked: R001: height is required for RECT wall mode',
            saveStatusColor: '#f9e2b7',
          },
        },
      },
    })

    expect(result.current.saveVm.canManualSave).toBe(false)
    expect(result.current.saveVm.blockedReason).toBe(
      'R001: height is required for RECT wall mode'
    )
    expect(result.current.pageVm.validationIssues).toEqual([
      'R001: height is required for RECT wall mode',
    ])
    expect(result.current.headerVm.dirtyStateText).toBe(
      'Unsaved changes - save blocked: R001: height is required for RECT wall mode'
    )
  })

  it('keeps unrelated section view models stable when trim-only derived inputs change', () => {
    const params = createViewModelParams()

    const { result, rerender } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: params } }
    )

    const initialWallsVm = result.current.wallsVm
    const initialCeilingsVm = result.current.ceilingsVm
    const initialTrimVm = result.current.trimVm
    const initialWallSummary = result.current.summaryVm.walls
    const initialTrimSummary = result.current.summaryVm.trim

    rerender({
      nextParams: {
        ...params,
        derived: {
          ...params.derived,
          calculation: {
            ...params.derived.calculation,
            selectedTrimMeasurement: 52,
            selectedTrimSubtotal: 245,
            trimScopeEffectiveMeasurementById: new Map([['trim-r001-main', 52]]),
            trimScopeEffectiveTotalById: new Map([['trim-r001-main', 245]]),
          },
          room: {
            ...params.derived.room,
            selectedRoomTrimScopes: [
              ...params.derived.room.selectedRoomTrimScopes,
              { ...params.derived.room.selectedRoomTrimScopes[0], id: 'trim-r001-added', position: 1 },
            ],
          },
        },
      },
    })

    expect(result.current.wallsVm).toBe(initialWallsVm)
    expect(result.current.ceilingsVm).toBe(initialCeilingsVm)
    expect(result.current.trimVm).not.toBe(initialTrimVm)
    expect(result.current.summaryVm.walls).toBe(initialWallSummary)
    expect(result.current.summaryVm.trim).not.toBe(initialTrimSummary)
    expect(result.current.summaryVm.trim.secondaryValue).toBe('$245.00')
    expect(result.current.summaryVm.trim.secondaryLabel).toBe('Effective Total')
  })

  it('updates wall and ceiling financial totals in the summary rail from derived scope totals', () => {
    const baseParams = createViewModelParams()

    const { result, rerender } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: baseParams } }
    )

    expect(result.current.summaryVm.walls.financialRows).toContainEqual({
      label: 'Effective Total',
      value: '$300.00',
    })
    expect(result.current.summaryVm.ceilings.financialRows).toContainEqual({
      label: 'Effective Total',
      value: '$125.00',
    })

    rerender({
      nextParams: {
        ...baseParams,
        derived: {
          ...baseParams.derived,
          calculation: {
            ...baseParams.derived.calculation,
            wallScopeEffectiveTotalById: new Map([['wall-r001-main', 640]]),
            ceilingScopeEffectiveTotalById: new Map([['ceiling-r001-main', 275]]),
            selectedWallSubtotal: 640,
            selectedCeilingSubtotal: 275,
          },
        },
      },
    })

    expect(result.current.summaryVm.walls.financialRows).toContainEqual({
      label: 'Effective Total',
      value: '$640.00',
    })
    expect(result.current.summaryVm.ceilings.financialRows).toContainEqual({
      label: 'Effective Total',
      value: '$275.00',
    })
  })

  it('exposes trim, door, and drywall effective totals in summary rail financial rows', () => {
    const baseParams = createViewModelParams()
    const params = {
      ...baseParams,
      derived: {
        ...baseParams.derived,
        room: {
          ...baseParams.derived.room,
          selectedRoomDoorScopes: [
            {
              id: 'door-r001-main',
              roomId: 'R001',
              position: 0,
              include: 'Y' as const,
              scopeName: 'Door',
              doorTypeId: 'DOOR',
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
              overrideTotal: '155',
              notes: '',
            },
          ],
          firstDoorScope: null,
          doorsIncluded: true,
          selectedRoomWallDrywallRepairs: [
            {
              id: 'drywall-r001-wall',
              roomId: 'R001',
              position: 0,
              surface: 'wall' as const,
              repairType: 'flat_wall_crack',
              unit: 'LF' as const,
              quantity: '4',
              overrideTotal: '64',
            },
          ],
          selectedRoomCeilingDrywallRepairs: [
            {
              id: 'drywall-r001-ceiling',
              roomId: 'R001',
              position: 1,
              surface: 'ceiling' as const,
              repairType: 'ceiling_crack',
              unit: 'LF' as const,
              quantity: '3',
              overrideTotal: '90',
            },
          ],
        },
        calculation: {
          ...baseParams.derived.calculation,
          selectedTrimSubtotal: 245,
          selectedDoorSubtotal: 155,
          selectedDoorUnits: 2,
          selectedWallDrywallSubtotal: 64,
          selectedCeilingDrywallSubtotal: 90,
        },
      },
    }

    const { result } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: params } }
    )

    expect(result.current.summaryVm.trim.financialRows).toEqual([
      { label: 'Effective Total', value: '$245.00' },
    ])
    expect(result.current.summaryVm.doors?.financialRows).toEqual([
      { label: 'Effective Total', value: '$155.00' },
    ])
    expect(result.current.summaryVm.walls.financialRows).toContainEqual({
      label: 'Drywall Effective Total',
      value: '$64.00',
    })
    expect(result.current.summaryVm.ceilings.financialRows).toContainEqual({
      label: 'Drywall Effective Total',
      value: '$90.00',
    })
  })

  it('builds separated active scope totals for the summary rail', () => {
    const params = createViewModelParams()

    const { result } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: params } }
    )

    expect(result.current.summaryVm.runningTotalLabel).toBe('Active scope totals - 2 rooms')
    expect(result.current.summaryVm.activeScopeTotals).toEqual([
      { key: 'walls', label: 'Walls', value: '476 sf' },
      { key: 'ceilings', label: 'Ceilings', value: '180 sf' },
      { key: 'trim', label: 'Trim', value: '44 LF' },
    ])
  })

  it('shows four-decimal ROOM_PERIMETER trim totals in the summary rail', () => {
    const baseParams = createViewModelParams()
    const params = {
      ...baseParams,
      derived: {
        ...baseParams.derived,
        calculation: {
          ...baseParams.derived.calculation,
          selectedTrimMeasurement: 54.6667,
          trimScopeEffectiveMeasurementById: new Map([['trim-r001-main', 54.6667]]),
          activeScopeTotals: {
            ...baseParams.derived.calculation.activeScopeTotals,
            trimMeasurement: 54.6667,
            trimMeasurementByUnit: new Map([['LF', 54.6667]]),
          },
        },
      },
    }

    const { result } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: params } }
    )

    expect(result.current.summaryVm.activeScopeTotals).toContainEqual({
      key: 'trim',
      label: 'Trim',
      value: '54.6667 LF',
    })
  })

  it('hides wall and trim primer summary chips unless an included scope uses primer', () => {
    const baseParams = createViewModelParams()
    const params = {
      ...baseParams,
      derived: {
        ...baseParams.derived,
        room: {
          ...baseParams.derived.room,
          selectedRoomScopes: baseParams.derived.room.selectedRoomScopes.map((scope) => ({
            ...scope,
            primeMode: 'NONE' as (typeof scope)['primeMode'],
          })),
          selectedRoomTrimScopes: baseParams.derived.room.selectedRoomTrimScopes.map((scope) => ({
            ...scope,
            primeMode: 'NONE' as (typeof scope)['primeMode'],
          })),
        },
      },
    }

    const { result, rerender } = renderHook(
      ({ nextParams }) => useEstimateV2EditorViewModels(nextParams as never),
      { initialProps: { nextParams: params } }
    )

    expect(result.current.summaryVm.walls.showPrimer).toBe(false)
    expect(result.current.summaryVm.walls.chips.some((chip) => chip.label.startsWith('Primer:'))).toBe(false)
    expect(result.current.summaryVm.trim.showPrimer).toBe(false)
    expect(result.current.summaryVm.trim.chips.some((chip) => chip.label.startsWith('Primer:'))).toBe(false)

    rerender({
      nextParams: {
        ...params,
        derived: {
          ...params.derived,
          room: {
            ...params.derived.room,
            selectedRoomScopes: [
              { ...params.derived.room.selectedRoomScopes[0], primeMode: 'SPOT' },
            ],
            selectedRoomTrimScopes: [
              { ...params.derived.room.selectedRoomTrimScopes[0], primeMode: 'FULL' },
            ],
          },
        },
      },
    })

    expect(result.current.summaryVm.walls.showPrimer).toBe(true)
    expect(result.current.summaryVm.walls.chips.some((chip) => chip.label === 'Primer: Wall Primer')).toBe(true)
    expect(result.current.summaryVm.trim.showPrimer).toBe(true)
    expect(result.current.summaryVm.trim.chips.some((chip) => chip.label === 'Primer: Trim Primer')).toBe(true)
  })
})
