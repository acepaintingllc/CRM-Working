import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMixedEstimateV2Fixture } from '../../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { estimateRouteFamily } from '../../../../estimateRouteFamily'
import { useEstimateV2DetailsPage } from '../useEstimateV2DetailsPage'
import {
  createErrorResponse,
  createResponse,
  createRollerRatesPayload,
  dispatchBeforeUnload,
  mockLoadedEstimate,
  resetFixtureSavedSnapshot,
  validationMessages,
} from './useEstimateV2DetailsPage.testUtils'
import {
  initialRollerOptionsState,
  reduceRollerOptionsLoadState,
} from '../useEstimateV2DetailsRollerOptions'
import {
  buildRoomAlertsByRoom,
  buildRoomFlagCountMap,
  buildRoomScopeRows,
  buildSummaryAlerts,
  normalizeSummaryScopeRows,
} from '../../../summary/_lib/estimateV2SummaryDerived'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  authedFetch: vi.fn(),
  useEstimateV2EditorLoader: vi.fn(),
  initializedStores: new WeakSet<object>(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => mocks.authedFetch(...args),
}))

vi.mock('../../../_state/useEstimateV2EditorLoader', () => ({
  useEstimateV2EditorLoader: mocks.useEstimateV2EditorLoader,
}))

function hasSaveRequest(estimateId: string) {
  return mocks.authedFetch.mock.calls.some(
    ([url, init]) =>
      url === estimateRouteFamily.estimateApiHref(estimateId) &&
      typeof init === 'object' &&
      init != null &&
      (init as { method?: string }).method === 'PUT'
  )
}

function findSaveRequest(estimateId: string) {
  return mocks.authedFetch.mock.calls.find(
    ([url, init]) =>
      url === estimateRouteFamily.estimateApiHref(estimateId) &&
      typeof init === 'object' &&
      init != null &&
      (init as { method?: string }).method === 'PUT'
  )
}

type SavedDetailsContractPayload = {
  room_wall_scopes: Array<{
    id: string
    room_id: string
    include: string | null
    override_paint_gallons: number | null
  }>
  room_ceiling_scopes: Array<{
    id: string
    room_id: string
    include: string | null
    override_paint_gallons: number | null
  }>
  room_trim_scopes: Array<{
    id: string
    room_id: string
    include: string | null
    override_gallons: number | null
  }>
  rollers: Array<{
    scope: string
    wall_color_id: string | null
    selected_option_id: string | null
    roller_size_in: number | null
    covers_qty: number | null
    notes: string | null
  }>
}

describe('useEstimateV2DetailsPage materialOverrides', () => {
  beforeEach(() => {
    mocks.push.mockReset()
    mocks.authedFetch.mockReset()
    mocks.useEstimateV2EditorLoader.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('persists grouped material overrides onto the stable owner scope and clears active and inactive duplicates', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes = fixture.scopes.map((scope) => {
      if (scope.id === 'wall-r002-main') {
        return { ...scope, colorId: 'COLOR1', overridePaintGallons: '2' }
      }
      if (scope.id === 'wall-r002-excluded') {
        return { ...scope, colorId: 'COLOR1', overridePaintGallons: '9' }
      }
      return { ...scope, overridePaintGallons: '1' }
    })
    fixture.ceilingScopes = fixture.ceilingScopes.map((scope, index) => ({
      ...scope,
      overridePaintGallons: String(index + 1),
    }))
    fixture.trimScopes = fixture.trimScopes.map((scope) => ({
      ...scope,
      overrideGallons: scope.include === 'Y' ? '1' : '8',
    }))
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    act(() => {
      result.current.actions.setWallOverride('COLOR1', '6')
      result.current.actions.setCeilingOverride('3')
      result.current.actions.setTrimOverride('2')
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = mocks.authedFetch.mock.calls.find(
      ([url, init]) =>
        url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) &&
        typeof init === 'object' &&
        init != null &&
        (init as { method?: string }).method === 'PUT'
    )
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      room_wall_scopes: Array<{ id: string; override_paint_gallons: number | null }>
      room_ceiling_scopes: Array<{ id: string; override_paint_gallons: number | null }>
      room_trim_scopes: Array<{ id: string; override_gallons: number | null }>
    }

    expect(body.room_wall_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wall-r001-main', override_paint_gallons: 6 }),
        expect.objectContaining({ id: 'wall-r002-main', override_paint_gallons: null }),
        expect.objectContaining({ id: 'wall-r002-excluded', override_paint_gallons: null }),
      ])
    )
    expect(body.room_ceiling_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ceiling-r001-main', override_paint_gallons: 3 }),
        expect.objectContaining({ id: 'ceiling-r002-main', override_paint_gallons: null }),
      ])
    )
    expect(body.room_trim_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'trim-r001-main', override_gallons: 2 }),
        expect.objectContaining({ id: 'trim-r002-excluded', override_gallons: null }),
      ])
    )
  })

  it('clears stale inactive wall, ceiling, and trim overrides when clearing grouped overrides', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes = fixture.scopes.map((scope) => {
      if (scope.id === 'wall-r001-main') {
        return { ...scope, colorId: 'COLOR1', overridePaintGallons: '4' }
      }
      if (scope.id === 'wall-r002-main') {
        return { ...scope, colorId: 'COLOR1', overridePaintGallons: '5' }
      }
      if (scope.id === 'wall-r002-excluded') {
        return { ...scope, colorId: 'COLOR1', overridePaintGallons: '9' }
      }
      return scope
    })
    fixture.ceilingScopes = fixture.ceilingScopes.map((scope) => {
      if (scope.id === 'ceiling-r002-main') {
        return { ...scope, include: 'N' as const, overridePaintGallons: '8' }
      }
      return { ...scope, overridePaintGallons: '3' }
    })
    fixture.trimScopes = fixture.trimScopes.map((scope) => ({
      ...scope,
      overrideGallons: scope.include === 'Y' ? '2' : '7',
    }))
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    act(() => {
      result.current.actions.setWallOverride('COLOR1', '')
      result.current.actions.setCeilingOverride('')
      result.current.actions.setTrimOverride('')
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = findSaveRequest(fixture.estimate.id)
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      room_wall_scopes: Array<{ id: string; override_paint_gallons: number | null }>
      room_ceiling_scopes: Array<{ id: string; override_paint_gallons: number | null }>
      room_trim_scopes: Array<{ id: string; override_gallons: number | null }>
    }

    expect(body.room_wall_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wall-r001-main', override_paint_gallons: null }),
        expect.objectContaining({ id: 'wall-r002-main', override_paint_gallons: null }),
        expect.objectContaining({ id: 'wall-r002-excluded', override_paint_gallons: null }),
      ])
    )
    expect(body.room_ceiling_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ceiling-r001-main', override_paint_gallons: null }),
        expect.objectContaining({ id: 'ceiling-r002-main', override_paint_gallons: null }),
      ])
    )
    expect(body.room_trim_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'trim-r001-main', override_gallons: null }),
        expect.objectContaining({ id: 'trim-r002-excluded', override_gallons: null }),
      ])
    )
  })

  it('keeps grouped material override owners stable when persisted scope order changes', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes = fixture.scopes
      .map((scope) => {
        if (scope.id === 'wall-r001-main') return { ...scope, colorId: 'COLOR1', overridePaintGallons: '1' }
        if (scope.id === 'wall-r002-main') return { ...scope, colorId: 'COLOR1', overridePaintGallons: '' }
        return scope
      })
      .reverse()
    fixture.ceilingScopes = fixture.ceilingScopes
      .map((scope) => {
        if (scope.id === 'ceiling-r001-main') return { ...scope, overridePaintGallons: '1' }
        if (scope.id === 'ceiling-r002-main') return { ...scope, overridePaintGallons: '' }
        return scope
      })
      .reverse()
    fixture.trimScopes = fixture.trimScopes
      .map((scope) => {
        if (scope.id === 'trim-r001-main') return { ...scope, overrideGallons: '1' }
        if (scope.id === 'trim-r002-excluded') {
          return { ...scope, include: 'Y' as const, overrideGallons: '' }
        }
        return scope
      })
      .reverse()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    expect(result.current.vm.wallRows[0].overrideOwnerScopeId).toBe('wall-r001-main')
    expect(result.current.vm.ceilingRow?.overrideOwnerScopeId).toBe('ceiling-r001-main')
    expect(result.current.vm.trimRow?.overrideOwnerScopeId).toBe('trim-r001-main')

    act(() => {
      result.current.actions.setWallOverride('COLOR1', '6')
      result.current.actions.setCeilingOverride('3')
      result.current.actions.setTrimOverride('2')
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = findSaveRequest(fixture.estimate.id)
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      room_wall_scopes: Array<{ id: string; override_paint_gallons: number | null }>
      room_ceiling_scopes: Array<{ id: string; override_paint_gallons: number | null }>
      room_trim_scopes: Array<{ id: string; override_gallons: number | null }>
    }

    expect(body.room_wall_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wall-r001-main', override_paint_gallons: 6 }),
        expect.objectContaining({ id: 'wall-r002-main', override_paint_gallons: null }),
      ])
    )
    expect(body.room_ceiling_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ceiling-r001-main', override_paint_gallons: 3 }),
        expect.objectContaining({ id: 'ceiling-r002-main', override_paint_gallons: null }),
      ])
    )
    expect(body.room_trim_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'trim-r001-main', override_gallons: 2 }),
        expect.objectContaining({ id: 'trim-r002-excluded', override_gallons: null }),
      ])
    )
  })

  it('contracts details edits through the canonical save payload into summary-facing override metadata', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.rollers = [
      ...fixture.rollers,
      {
        id: 'applicator-trim',
        scope: 'Trim',
        wallColorId: '',
        selectedOptionId: 'TRIM_4',
        rollerSizeIn: '4',
        coversQty: '1',
        notes: 'Contract trim applicator',
        position: fixture.rollers.length,
      },
    ]
    const savedBodyRef: { current: SavedDetailsContractPayload | null } = { current: null }

    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        const saved = JSON.parse((init as { body: string }).body) as SavedDetailsContractPayload
        savedBodyRef.current = saved
        return createResponse({
          ...fixture.summaryData,
          wall_calculations: {
            ...fixture.summaryData.wall_calculations,
            scopes: saved.room_wall_scopes.map((scope) => ({
              ...scope,
              effective_area_sf: scope.id === 'wall-r001-main' ? 396 : 80,
              effective_paint_hours: scope.id === 'wall-r001-main' ? 5 : 2,
              effective_primer_hours: scope.id === 'wall-r001-main' ? 2 : 0,
              effective_supply_cost: scope.id === 'wall-r001-main' ? 50 : 20,
              effective_total: scope.id === 'wall-r001-main' ? 700 : 220,
              paint_product_id: scope.id === 'wall-r001-main' ? 'P-WALL' : null,
              paint_product_label: scope.id === 'wall-r001-main' ? 'Wall Satin' : null,
              raw_paint_gallons: 1.2,
            })),
          },
          ceiling_calculations: {
            ...fixture.summaryData.ceiling_calculations,
            scopes: saved.room_ceiling_scopes.map((scope) => ({
              ...scope,
              effective_area_sf: scope.id === 'ceiling-r001-main' ? 120 : 60,
              effective_paint_hours: scope.id === 'ceiling-r001-main' ? 1.5 : 1,
              effective_primer_hours: scope.id === 'ceiling-r001-main' ? 0.5 : 0,
              effective_supply_cost: scope.id === 'ceiling-r001-main' ? 20 : 10,
              effective_total: scope.id === 'ceiling-r001-main' ? 180 : 90,
              paint_product_id: scope.id === 'ceiling-r001-main' ? 'P-CEIL' : null,
              paint_product_label: scope.id === 'ceiling-r001-main' ? 'Ceiling Flat' : null,
              raw_paint_gallons: 0.8,
            })),
          },
          trim_calculations: {
            ...fixture.summaryData.trim_calculations,
            scopes: saved.room_trim_scopes.map((scope) => ({
              ...scope,
              effective_measurement: scope.id === 'trim-r001-main' ? 44 : 12,
              effective_paint_hours: scope.id === 'trim-r001-main' ? 2 : 0.5,
              effective_primer_hours: scope.id === 'trim-r001-main' ? 0.5 : 0,
              effective_supply_cost: scope.id === 'trim-r001-main' ? 20 : 6,
              effective_total: scope.id === 'trim-r001-main' ? 210 : 60,
              raw_paint_gallons: 0.4,
            })),
          },
        })
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    act(() => {
      result.current.actions.setWallOverride('COLOR1', '6')
      result.current.actions.setCeilingOverride('3')
      result.current.actions.setRollerRow('trim', {
        coverId: 'TRIM_4',
        quantity: '1',
        notes: 'Contract trim applicator',
      })
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_9',
        quantity: '4',
        notes: 'Contract wall roller',
      })
      result.current.actions.setRollerRow('wall:COLOR2', {
        coverId: 'WALL_12',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('ceiling', {
        coverId: 'CEIL_14',
        quantity: '2',
        notes: 'Contract ceiling roller',
      })
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    expect(findSaveRequest(fixture.estimate.id)).toBeTruthy()
    const saved = savedBodyRef.current
    if (!saved) throw new Error('Expected details save to send a canonical payload')
    expect(saved.room_wall_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wall-r001-main', override_paint_gallons: 6 }),
      ])
    )
    expect(saved.room_ceiling_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ceiling-r001-main', override_paint_gallons: 3 }),
      ])
    )
    expect(saved.rollers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'Wall',
          wall_color_id: 'COLOR1',
          selected_option_id: 'WALL_9',
          roller_size_in: 9,
          covers_qty: 4,
          notes: 'Contract wall roller',
        }),
        expect.objectContaining({
          scope: 'Ceiling',
          wall_color_id: null,
          selected_option_id: 'CEIL_14',
          roller_size_in: 14,
          covers_qty: 2,
        }),
      ])
    )
    expect(saved.rollers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'Trim',
          wall_color_id: null,
          selected_option_id: 'TRIM_4',
          roller_size_in: 4,
          covers_qty: 1,
        }),
      ])
    )

    const wallScopes = normalizeSummaryScopeRows(
      saved.room_wall_scopes.map((scope) => ({
        ...scope,
        effective_area_sf: 100,
        effective_total: 700,
        raw_paint_gallons: 1.2,
        paint_product_id: 'P-WALL',
      }))
    )
    const ceilingScopes = normalizeSummaryScopeRows(
      saved.room_ceiling_scopes.map((scope) => ({
        ...scope,
        effective_area_sf: 50,
        effective_total: 180,
        raw_paint_gallons: 0.8,
        paint_product_id: 'P-CEIL',
      }))
    )
    const trimScopes = normalizeSummaryScopeRows(
      saved.room_trim_scopes.map((scope) => ({
        ...scope,
        effective_measurement: 44,
        effective_total: 210,
        raw_paint_gallons: 0.4,
      }))
    )
    const roomScopeRows = buildRoomScopeRows({ wallScopes, ceilingScopes, trimScopes })
    const roomFlagCountMap = buildRoomFlagCountMap(fixture.summaryData.inputs.room_flags ?? [])
    const roomAlertsByRoom = buildRoomAlertsByRoom({
      rooms: fixture.summaryData.inputs.rooms ?? [],
      roomFlagCountMap,
      roomScopeRows,
    })
    const summaryAlerts = buildSummaryAlerts({
      pricingSummary: fixture.pricingSummary,
      hasJobSettings: true,
      laborRateOverrideActive: false,
      roomScopeRows,
      roomFlags: fixture.summaryData.inputs.room_flags ?? [],
      rooms: fixture.summaryData.inputs.rooms ?? [],
    })

    expect(roomScopeRows.get('R001')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wall-r001-main', kind: 'walls', hasOverride: true }),
        expect.objectContaining({ id: 'ceiling-r001-main', kind: 'ceilings', hasOverride: true }),
      ])
    )
    expect(roomAlertsByRoom.get('R001')?.overrides).toBeGreaterThanOrEqual(2)
    expect(summaryAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Manual override detected',
          detail: 'Scope override active',
        }),
      ])
    )
  })

  it('blocks continue to summary when grouped wall overrides conflict', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes = [
      {
        ...fixture.scopes[0],
        id: 'wall-conflict-a',
        colorId: 'COLOR1',
        overridePaintGallons: '4',
      },
      {
        ...fixture.scopes[1],
        id: 'wall-conflict-b',
        colorId: 'COLOR1',
        overridePaintGallons: '5',
      },
    ]
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [
          {
            key: 'supply_rates_roller_covers',
            rows: [
              {
                id: 'WALL_9',
                display_name: 'Wall',
                scope: 'Wall',
                size_in: 9,
                price_each: 6,
                active: 'Y',
              },
            ],
          },
        ],
      })
    )
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    expect(result.current.vm.wallRows).toHaveLength(1)
    expect(result.current.vm.wallRows[0]).toMatchObject({
      overrideGallons: '4',
      finalGallons: 4,
      overrideOwnerScopeId: 'wall-conflict-a',
    })
    expect(validationMessages(result.current.vm)).toContain(
      'Warm White has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
    )

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(mocks.push).not.toHaveBeenCalled()
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

})
