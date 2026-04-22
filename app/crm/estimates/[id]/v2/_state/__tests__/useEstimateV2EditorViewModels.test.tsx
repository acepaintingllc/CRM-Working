import { renderHook } from '@testing-library/react'
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
    selectedRoom,
    selectedRoomResolvedMode: 'RECT' as const,
    selectedRoomGeometryMode: 'RECT' as const,
    roomTypeOptions: fixture.catalogs.room_types,
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
    displayedRoomEffectiveAreaByRoomId: new Map([
      ['R001', 396],
      ['R002', 80],
    ]),
    selectedRoomEffectiveSqFt: 396,
    activeRoomFlagCount: 0,
    selectedRoomIssueCount: 1,
    selectedRoomScopes: fixture.scopes.filter((scope) => scope.roomId === 'R001'),
    firstScope: fixture.scopes[0],
    wallsIncluded: true,
    wallPaintLabel: 'Wall Satin',
    wallPrimerLabel: 'Wall Primer',
    effectiveWallPaintLabel: 'Wall Satin',
    effectiveWallPrimerLabel: 'Wall Primer',
    wallPaintOptions: paintProducts.filter((product) => product.type !== 'primer'),
    wallPrimerOptions: paintProducts.filter((product) => product.type === 'primer'),
    wallProductionRates: fixture.catalogs.production_rates,
    colorCodeOptions: fixture.catalogs.color_codes,
    displayedSegmentEffectiveAreaById: new Map([
      ['wall-seg-r002-1', 64],
      ['wall-seg-r002-2', 16],
    ]),
    displayedScopeEffectiveAreaById: new Map([
      ['wall-r001-main', 396],
      ['wall-r002-main', 80],
    ]),
    selectedRoomCeilingScopes: fixture.ceilingScopes.filter((scope) => scope.roomId === 'R001'),
    firstCeilingScope: fixture.ceilingScopes[0],
    ceilingsIncluded: true,
    ceilingPaintLabel: 'Ceiling Flat',
    ceilingPrimerLabel: 'Ceiling Primer',
    effectiveCeilingPaintLabel: 'Ceiling Flat',
    effectiveCeilingPrimerLabel: 'Ceiling Primer',
    ceilingPaintOptions: paintProducts.filter((product) => product.type !== 'primer'),
    ceilingPrimerOptions: paintProducts.filter((product) => product.type === 'primer'),
    selectedCeilingEffectiveSqFt: 120,
    selectedRoomTrimScopes: fixture.trimScopes.filter((scope) => scope.roomId === 'R001'),
    firstTrimScope: fixture.trimScopes[0],
    trimsIncluded: true,
    jobTrimsIncluded: true,
    trimPaintLabel: 'Trim Enamel',
    trimPrimerLabel: 'Trim Primer',
    effectiveTrimPaintLabel: 'Trim Enamel',
    effectiveTrimPrimerLabel: 'Trim Primer',
    trimPaintOptions: paintProducts.filter((product) => product.type !== 'primer'),
    trimPrimerOptions: paintProducts.filter((product) => product.type === 'primer'),
    trimTypeOptions: fixture.catalogs.trim_items,
    trimScopeEffectiveMeasurementById: new Map([['trim-r001-main', 44]]),
    trimScopeEffectiveTotalById: new Map([['trim-r001-main', 210]]),
    selectedTrimSubtotal: 210,
    selectedTrimMeasurement: 44,
    orgWallPaintLabel: 'Wall Satin',
    orgWallPrimerLabel: 'Wall Primer',
    orgCeilingPaintLabel: 'Ceiling Flat',
    orgCeilingPrimerLabel: 'Ceiling Primer',
    orgTrimPaintLabel: 'Trim Enamel',
    orgTrimPrimerLabel: 'Trim Primer',
    dirty: false,
    saveStatusText: 'Saved Apr 21, 2:00 PM',
    saveStatusColor: 'var(--v2-ink-3)',
    calculationsStale: false,
    useLocalPreviewCalculations: false,
    totalEffectiveAreaSqFt: 476,
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
    settingsActions: {
      updateJobSettings: vi.fn(),
      updateCustomer: vi.fn(),
      flushCustomerSave: vi.fn(),
    },
    save: vi.fn(async () => true),
  }
}

describe('useEstimateV2EditorViewModels', () => {
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
          selectedTrimMeasurement: 52,
          selectedTrimSubtotal: 245,
          trimScopeEffectiveMeasurementById: new Map([['trim-r001-main', 52]]),
          trimScopeEffectiveTotalById: new Map([['trim-r001-main', 245]]),
          selectedRoomTrimScopes: [
            ...params.derived.selectedRoomTrimScopes,
            { ...params.derived.selectedRoomTrimScopes[0], id: 'trim-r001-added', position: 1 },
          ],
        },
      },
    })

    expect(result.current.wallsVm).toBe(initialWallsVm)
    expect(result.current.ceilingsVm).toBe(initialCeilingsVm)
    expect(result.current.trimVm).not.toBe(initialTrimVm)
    expect(result.current.summaryVm.walls).toBe(initialWallSummary)
    expect(result.current.summaryVm.trim).not.toBe(initialTrimSummary)
    expect(result.current.summaryVm.trim.secondaryValue).toBe('$245.00')
  })
})
