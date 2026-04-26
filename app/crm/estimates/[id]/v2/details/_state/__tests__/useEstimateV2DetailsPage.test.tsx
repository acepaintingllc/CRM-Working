import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMixedEstimateV2Fixture } from '../../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import { estimateRouteFamily } from '../../../../estimateRouteFamily'
import { useEstimateV2DetailsPage } from '../useEstimateV2DetailsPage'
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
import { buildEstimateV2DirtySnapshot } from '../../../_state/estimateV2DirtySnapshot'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  authedFetch: vi.fn(),
  useEstimateV2EditorLoader: vi.fn(),
  initializedStores: new WeakSet<object>(),
  confirm: vi.fn(),
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

function createResponse(payload: unknown, init?: { ok?: boolean; status?: number; statusText?: string }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    text: vi.fn(async () => JSON.stringify({ data: payload })),
  }
}

function createErrorResponse(message: string, status = 500) {
  return {
    ok: false,
    status,
    statusText: 'Server Error',
    text: vi.fn(async () => JSON.stringify({ error: message })),
  }
}

function createRollerRatesPayload() {
  return {
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
          {
            id: 'WALL_12',
            display_name: 'Wall',
            scope: 'Wall',
            size_in: 12,
            price_each: 8,
            active: 'Y',
          },
          {
            id: 'CEIL_14',
            display_name: 'Ceiling',
            scope: 'Ceiling',
            size_in: 14,
            price_each: 10,
            active: 'Y',
          },
          {
            id: 'TRIM_4',
            display_name: 'Trim applicator',
            scope: 'Trim',
            size_in: 4,
            price_each: 4,
            active: 'Y',
          },
        ],
      },
    ],
  }
}

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

function validationMessages(vm: ReturnType<typeof useEstimateV2DetailsPage>['vm']) {
  return vm.validationIssues.map((issue) => issue.message)
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

function dispatchBeforeUnload() {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
  window.dispatchEvent(event)
  return event
}

function mockLoadedEstimate(fixture: ReturnType<typeof createMixedEstimateV2Fixture>) {
  mocks.useEstimateV2EditorLoader.mockImplementation(({ store }: { store: EstimateV2EditorStoreApi }) => {
    if (mocks.initializedStores.has(store)) return
    mocks.initializedStores.add(store)
    const state = store.getState()
    state.setCollections({
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
    })
    state.setMeta((prev) => ({
      ...prev,
      loading: false,
      estimate: fixture.estimate,
      job: fixture.job,
      catalogs: fixture.catalogs,
      wallCalculations: fixture.wallCalculations,
      ceilingCalculations: fixture.ceilingCalculations,
      trimCalculations: fixture.trimCalculations,
      pricingSummary: fixture.pricingSummary,
      lastSavedSnapshot: fixture.currentSnapshot,
    }))
  })
}

function resetFixtureSavedSnapshot(fixture: ReturnType<typeof createMixedEstimateV2Fixture>) {
  fixture.currentSnapshot = buildEstimateV2DirtySnapshot({
    rooms: fixture.rooms,
    scopes: fixture.scopes,
    segments: fixture.segments,
    roomFlags: fixture.roomFlags,
    rollers: fixture.rollers,
    ceilingScopes: fixture.ceilingScopes,
    ceilingSegments: fixture.ceilingSegments,
    trimScopes: fixture.trimScopes,
  })
}

describe('useEstimateV2DetailsPage', () => {
  beforeEach(() => {
    mocks.push.mockReset()
    mocks.authedFetch.mockReset()
    mocks.useEstimateV2EditorLoader.mockReset()
    mocks.confirm.mockReset()
    vi.spyOn(window, 'confirm').mockImplementation((message?: string) => mocks.confirm(message))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reduces roller option loading outcomes into stable page states', () => {
    const validPayload = createRollerRatesPayload()

    expect(
      reduceRollerOptionsLoadState(
        {
          status: 'unavailable',
          options: [],
          message: 'Prior failure',
        },
        { type: 'loading' }
      )
    ).toEqual(initialRollerOptionsState)

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'loaded',
        result: { ok: true, payload: validPayload },
      })
    ).toMatchObject({
      status: 'loaded',
      options: expect.arrayContaining([
        expect.objectContaining({ id: 'WALL_9' }),
        expect.objectContaining({ id: 'CEIL_14' }),
        expect.objectContaining({ id: 'TRIM_4' }),
      ]),
    })

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'loaded',
        result: { ok: false, message: 'Rates unavailable' },
      })
    ).toEqual({
      status: 'unavailable',
      options: [],
      message: 'Rates unavailable',
    })

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'failed',
      })
    ).toEqual({
      status: 'unavailable',
      options: [],
      message: 'Roller and applicator options failed to load.',
    })

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'loaded',
        result: { ok: true, payload: { categories: null } },
      })
    ).toMatchObject({
      status: 'unavailable',
      options: [],
    })

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'loaded',
        result: {
          ok: true,
          payload: { categories: [{ key: 'supply_rates_roller_covers', rows: [] }] },
        },
      })
    ).toEqual({
      status: 'empty',
      options: [],
      message: 'No roller or applicator options are configured in rates and flags.',
    })
  })

  it('writes roller changes into the canonical persisted editor collection', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [
          {
            key: 'supply_rates_roller_covers',
            rows: [
              {
                id: 'WALL_12',
                display_name: 'Wall',
                scope: 'Wall',
                size_in: 12,
                price_each: 8,
                active: 'Y',
              },
              {
                id: 'CEIL_14',
                display_name: 'Ceiling',
                scope: 'Ceiling',
                size_in: 14,
                price_each: 10,
                active: 'Y',
              },
              {
                id: 'TRIM_4',
                display_name: 'Trim applicator',
                scope: 'Trim',
                size_in: 4,
                price_each: 4,
                active: 'Y',
              },
            ],
          },
        ],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.wallRollerOptions.some((option) => option.id === 'WALL_12')).toBe(
        true
      )
    })

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Changed from details page',
      })
      result.current.actions.setRollerRow('wall:COLOR2', {
        coverId: 'WALL_12',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('ceiling', {
        coverId: 'CEIL_14',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('trim', {
        coverId: 'TRIM_4',
        quantity: '2',
        notes: 'Trim applicator',
      })
    })

    expect(result.current.vm.wallRollerRows[0]).toMatchObject({
      coverId: 'WALL_12',
      quantity: '3',
      notes: 'Changed from details page',
      errors: [],
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
      rollers: Array<{
        scope: string
        wall_color_id: string | null
        selected_option_id: string | null
        roller_size_in: number | null
        covers_qty: number | null
        notes: string | null
      }>
    }
    expect(body.rollers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'Wall',
          wall_color_id: 'COLOR1',
          selected_option_id: 'WALL_12',
          roller_size_in: 12,
          covers_qty: 3,
          notes: 'Changed from details page',
        }),
        expect.objectContaining({
          scope: 'Ceiling',
          wall_color_id: null,
          selected_option_id: 'CEIL_14',
          roller_size_in: 14,
          covers_qty: 1,
        }),
        expect.objectContaining({
          scope: 'Trim',
          wall_color_id: null,
          selected_option_id: 'TRIM_4',
          roller_size_in: 4,
          covers_qty: 2,
          notes: 'Trim applicator',
        }),
      ])
    )
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
    mockLoadedEstimate(fixture)

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
    mockLoadedEstimate(fixture)

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
    mockLoadedEstimate(fixture)

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
    mockLoadedEstimate(fixture)

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
      result.current.actions.setRollerRow('trim', {
        coverId: 'TRIM_4',
        quantity: '3',
        notes: 'Contract trim applicator',
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
        expect.objectContaining({
          scope: 'Trim',
          wall_color_id: null,
          selected_option_id: 'TRIM_4',
          roller_size_in: 4,
          covers_qty: 3,
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

  it('round-trips unassigned wall scope roller identity through details draft save payloads', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes[0] = {
      ...fixture.scopes[0],
      id: 'wall-unassigned',
      scopeName: 'Unassigned walls',
      colorId: '',
    }
    const wallCalculationScopes = fixture.wallCalculations.scopes ?? []
    const wallCalculationTraces = fixture.wallCalculations.scope_traces ?? []
    fixture.wallCalculations.scopes = wallCalculationScopes
    fixture.wallCalculations.scope_traces = wallCalculationTraces
    wallCalculationScopes[0] = {
      ...wallCalculationScopes[0],
      id: 'wall-unassigned',
      color_id: null,
      scope_name: 'Unassigned walls',
    }
    wallCalculationTraces[0] = {
      ...wallCalculationTraces[0],
      scope_id: 'wall-unassigned',
    }
    fixture.rollers = [
      {
        id: 'roller-unassigned',
        scope: 'Wall',
        wallColorId: 'SCOPE:wall-unassigned',
        selectedOptionId: 'WALL_9',
        rollerSizeIn: '9',
        coversQty: '2',
        notes: 'Saved unassigned scope',
        position: 0,
      },
      {
        id: 'roller-wall-color-2',
        scope: 'Wall',
        wallColorId: 'COLOR2',
        selectedOptionId: 'WALL_12',
        rollerSizeIn: '12',
        coversQty: '1',
        notes: '',
        position: 1,
      },
    ]
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    const unassignedRow = result.current.vm.wallRollerRows.find(
      (row) => row.id === 'wall:scope:wall-unassigned'
    )
    expect(unassignedRow).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Saved unassigned scope',
    })

    act(() => {
      result.current.actions.setRollerRow('wall:scope:wall-unassigned', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Updated unassigned scope',
      })
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
      rollers: Array<{
        id: string
        scope: string
        wall_color_id: string | null
        selected_option_id: string | null
        roller_size_in: number | null
        covers_qty: number | null
        notes: string | null
      }>
    }
    expect(body.rollers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'roller-unassigned',
          scope: 'Wall',
          wall_color_id: 'scope:wall-unassigned',
          selected_option_id: 'WALL_12',
          roller_size_in: 12,
          covers_qty: 3,
          notes: 'Updated unassigned scope',
        }),
      ])
    )
  })

  it('blocks ambiguous same-size roller options instead of silently rehydrating the first match', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.rollers[0] = {
      ...fixture.rollers[0],
      rollerSizeIn: '9',
      coversQty: '2',
      notes: 'Main wall roller',
    }
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [
          {
            key: 'supply_rates_roller_covers',
            rows: [
              {
                id: 'WALL_9_STANDARD',
                display_name: 'Wall standard',
                scope: 'Wall',
                size_in: 9,
                price_each: 6,
                active: 'Y',
              },
              {
                id: 'WALL_9_PREMIUM',
                display_name: 'Wall premium',
                scope: 'Wall',
                size_in: 9,
                price_each: 8,
                active: 'Y',
              },
              {
                id: 'CEIL_14',
                display_name: 'Ceiling',
                scope: 'Ceiling',
                size_in: 14,
                price_each: 10,
                active: 'Y',
              },
              {
                id: 'TRIM_4',
                display_name: 'Trim applicator',
                scope: 'Trim',
                size_in: 4,
                price_each: 4,
                active: 'Y',
              },
            ],
          },
        ],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.wallRollerOptions).toHaveLength(2)
    })

    expect(result.current.vm.wallRollerRows[0]).toMatchObject({
      coverId: '',
      quantity: '2',
      notes: 'Main wall roller',
    })
    expect(validationMessages(result.current.vm)).toContain(
      'Warm White saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.'
    )

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(mocks.push).not.toHaveBeenCalled()
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('guards browser unload while details edits are dirty', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    expect(result.current.dirty).toBe(false)
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Dirty roller edit',
      })
    })

    expect(result.current.dirty).toBe(true)
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
  })

  it('keeps grouped material override no-ops clean without queuing an autosave', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes = fixture.scopes.map((scope) => {
      if (scope.id === 'wall-r001-main') return { ...scope, overridePaintGallons: '6' }
      if (scope.colorId === 'COLOR1') return { ...scope, overridePaintGallons: '' }
      return scope
    })
    fixture.ceilingScopes = fixture.ceilingScopes.map((scope) =>
      scope.id === 'ceiling-r001-main'
        ? { ...scope, overridePaintGallons: '3' }
        : { ...scope, overridePaintGallons: '' }
    )
    fixture.trimScopes = fixture.trimScopes.map((scope) =>
      scope.id === 'trim-r001-main'
        ? { ...scope, overrideGallons: '2' }
        : { ...scope, overrideGallons: '' }
    )
    resetFixtureSavedSnapshot(fixture)
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })
    expect(result.current.dirty).toBe(false)
    mocks.authedFetch.mockClear()
    vi.useFakeTimers()

    act(() => {
      result.current.actions.setWallOverride('COLOR1', '6')
      result.current.actions.setCeilingOverride('3')
      result.current.actions.setTrimOverride('2')
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(result.current.dirty).toBe(false)
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('keeps roller row no-ops clean without queuing an autosave', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.rollers[0] = {
      ...fixture.rollers[0],
      selectedOptionId: 'WALL_9',
      rollerSizeIn: '9',
      coversQty: '2',
      notes: 'Main wall roller',
    }
    resetFixtureSavedSnapshot(fixture)
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })
    expect(result.current.vm.wallRollerRows[0]).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Main wall roller',
    })
    expect(result.current.dirty).toBe(false)
    mocks.authedFetch.mockClear()
    vi.useFakeTimers()

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_9',
        quantity: ' 2 ',
        notes: 'Main wall roller',
      })
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(result.current.dirty).toBe(false)
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('disables the browser unload guard after a dirty details edit saves successfully', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture)

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
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Saved roller edit',
      })
    })

    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    expect(result.current.dirty).toBe(false)
    await waitFor(() => {
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    })
  })

  it('exposes failed manual save status without navigating', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createErrorResponse('Manual save failed', 500)
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture)

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
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Dirty roller edit',
      })
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(false)
    })

    expect(hasSaveRequest(fixture.estimate.id)).toBe(true)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(result.current.error?.message).toBe('Manual save failed')
    expect(result.current.saveStatus).toBe('error')
  })

  it('guards internal return-to-editor navigation while details edits are dirty', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))
    mockLoadedEstimate(fixture)

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
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Dirty roller edit',
      })
    })

    mocks.confirm.mockReturnValueOnce(false)

    act(() => {
      expect(result.current.actions.returnToEditor()).toBe(false)
    })

    expect(mocks.confirm).toHaveBeenCalledWith('You have unsaved changes. Leave this workspace?')
    expect(mocks.push).not.toHaveBeenCalled()

    mocks.confirm.mockReturnValueOnce(true)

    act(() => {
      expect(result.current.actions.returnToEditor()).toBe(true)
    })

    expect(mocks.push).toHaveBeenCalledWith(estimateRouteFamily.editorHref(fixture.estimate.id))
  })

  it('allows internal return-to-editor navigation without confirmation when details are clean', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))
    mockLoadedEstimate(fixture)

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
      expect(result.current.actions.returnToEditor()).toBe(true)
    })

    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.push).toHaveBeenCalledWith(estimateRouteFamily.editorHref(fixture.estimate.id))
  })

  it('blocks continue to summary when a stale saved roller option has no safe fallback', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.rollers[0] = {
      ...fixture.rollers[0],
      selectedOptionId: 'WALL_9_ARCHIVED',
      rollerSizeIn: '9',
      coversQty: '2',
    }
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [
          {
            key: 'supply_rates_roller_covers',
            rows: [
              {
                id: 'WALL_12',
                display_name: 'Wall',
                scope: 'Wall',
                size_in: 12,
                price_each: 8,
                active: 'Y',
              },
              {
                id: 'CEIL_14',
                display_name: 'Ceiling',
                scope: 'Ceiling',
                size_in: 14,
                price_each: 10,
                active: 'Y',
              },
              {
                id: 'TRIM_4',
                display_name: 'Trim applicator',
                scope: 'Trim',
                size_in: 4,
                price_each: 4,
                active: 'Y',
              },
            ],
          },
        ],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    expect(result.current.vm.validationIssues.map((issue) => issue.id)).toContain(
      'rollers:wall:COLOR1:coverId:stale-option'
    )

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(mocks.push).not.toHaveBeenCalled()
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('blocks continue to summary while roller options are unavailable', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createErrorResponse('Rates unavailable', 503))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('unavailable')
    })

    expect(result.current.vm.continueBlockedReason).toBe('Rates unavailable')

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(mocks.push).not.toHaveBeenCalled()
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('saves and routes to summary when continue validation passes', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture)

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
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_9',
        quantity: '2',
        notes: 'Main wall roller',
      })
      result.current.actions.setRollerRow('wall:COLOR2', {
        coverId: 'WALL_12',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('ceiling', {
        coverId: 'CEIL_14',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('trim', {
        coverId: 'TRIM_4',
        quantity: '2',
        notes: '',
      })
    })

    expect(result.current.vm.canContinueToSummary).toBe(true)

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(true)
    })

    expect(hasSaveRequest(fixture.estimate.id)).toBe(true)
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.push).toHaveBeenCalledWith(estimateRouteFamily.summaryHref(fixture.estimate.id))
  })

  it('does not route to summary when continue save fails', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createErrorResponse('Save failed during continue', 500)
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture)

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
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_9',
        quantity: '2',
        notes: '',
      })
      result.current.actions.setRollerRow('wall:COLOR2', {
        coverId: 'WALL_12',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('ceiling', {
        coverId: 'CEIL_14',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('trim', {
        coverId: 'TRIM_4',
        quantity: '2',
        notes: '',
      })
    })

    expect(result.current.vm.canContinueToSummary).toBe(true)

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(hasSaveRequest(fixture.estimate.id)).toBe(true)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(result.current.error?.message).toBe('Save failed during continue')
    expect(result.current.saveStatus).toBe('error')
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
    mockLoadedEstimate(fixture)

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

  it('marks roller options unavailable on HTTP failure without required-select validation', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createErrorResponse('Rates unavailable', 503))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('unavailable')
    })

    expect(result.current.vm.rollerOptionsState.message).toBe('Rates unavailable')
    expect(validationMessages(result.current.vm)).toContain('Rates unavailable')
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })

  it('marks roller options unavailable when the fetch throws', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockRejectedValue(new Error('network down'))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('unavailable')
    })

    expect(result.current.vm.rollerOptionsState.message).toBe(
      'Roller and applicator options failed to load.'
    )
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })

  it('marks malformed rates payloads unavailable', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createResponse({ categories: null }))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('unavailable')
    })

    expect(result.current.vm.rollerOptionsState.message).toBe(
      'Roller and applicator options could not be read from rates and flags.'
    )
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })

  it('marks an empty configured roller category explicitly', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('empty')
    })

    expect(result.current.vm.rollerOptionsState.message).toBe(
      'No roller or applicator options are configured in rates and flags.'
    )
    expect(validationMessages(result.current.vm)).toContain(
      'Wall roller cover options are not configured'
    )
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })
})
