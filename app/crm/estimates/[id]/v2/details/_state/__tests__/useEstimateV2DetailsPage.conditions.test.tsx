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

describe('useEstimateV2DetailsPage conditions', () => {
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

  it('setRoomCondition updates the conditions VM and marks the estimate dirty', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
        condition_modifier_catalog: [
          {
            id: 'COND-OIL',
            label: 'Oil-based trim',
            scope: 'wall',
            modifier_type: 'binary',
            factor_field: 'wall_factor',
            levels: { active: 1.15 },
            notes: null,
            active: 'Y',
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
      expect(result.current.vm.conditions.conditions).toHaveLength(1)
    })

    expect(result.current.vm.conditions.wallActiveCount).toBe(0)
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.actions.setRoomCondition('wall', 'COND-OIL', 'active')
    })

    expect(result.current.vm.conditions.wallActiveCount).toBe(1)
    expect(result.current.dirty).toBe(true)
  })

  it('saves condition_selections in the PUT payload', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
        condition_modifier_catalog: [
          {
            id: 'COND-OIL',
            label: 'Oil-based trim',
            scope: 'wall',
            modifier_type: 'binary',
            factor_field: 'wall_factor',
            levels: { active: 1.15 },
            notes: null,
            active: 'Y',
          },
        ],
      })
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.conditions.conditions).toHaveLength(1)
    })

    act(() => {
      result.current.actions.setRoomCondition('wall', 'COND-OIL', 'active')
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = findSaveRequest(fixture.estimate.id)
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      jobsettings: { condition_selections: unknown }
    }
    expect(body.jobsettings.condition_selections).toMatchObject({
      wall: { 'COND-OIL': 'active' },
    })
  })

  it('writes condition_factor to wall scope rows when a wall condition is active', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
        condition_modifier_catalog: [
          {
            id: 'COND-CAULK',
            label: 'Heavy caulking',
            scope: 'wall',
            modifier_type: 'severity',
            factor_field: 'wall_factor',
            levels: { minor: 1.1, moderate: 1.2, major: 1.35 },
            notes: null,
            active: 'Y',
          },
        ],
      })
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.conditions.conditions).toHaveLength(1)
    })

    act(() => {
      result.current.actions.setRoomCondition('wall', 'COND-CAULK', 'moderate')
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = findSaveRequest(fixture.estimate.id)
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      room_wall_scopes: Array<{ id: string; condition_factor: number | null }>
    }
    expect(body.room_wall_scopes.every((scope) => scope.condition_factor === 1.2)).toBe(true)
  })

  it('compounds room factor into wall condition_factor on save', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
        condition_modifier_catalog: [
          {
            id: 'ROOM_FURNISHED',
            label: 'Furnished room',
            scope: 'room',
            modifier_type: 'binary',
            factor_field: null,
            levels: { active: 1.15 },
            notes: null,
            active: 'Y',
          },
          {
            id: 'WALL_OIL',
            label: 'Oil-based paint',
            scope: 'wall',
            modifier_type: 'binary',
            factor_field: 'wall_factor',
            levels: { active: 1.2 },
            notes: null,
            active: 'Y',
          },
        ],
      })
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.conditions.conditions).toHaveLength(2)
    })

    act(() => {
      result.current.actions.setRoomCondition('room', 'ROOM_FURNISHED', 'active')
      result.current.actions.setRoomCondition('wall', 'WALL_OIL', 'active')
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = findSaveRequest(fixture.estimate.id)
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      room_wall_scopes: Array<{ condition_factor: number | null }>
    }
    const expected = 1.15 * 1.2
    expect(body.room_wall_scopes.every((s) => Math.abs((s.condition_factor ?? 0) - expected) < 0.0001)).toBe(true)
  })

  it('writes ceiling condition_factor when a ceiling condition is active', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
        condition_modifier_catalog: [
          {
            id: 'CEIL_TEXTURE',
            label: 'Textured ceiling',
            scope: 'ceiling',
            modifier_type: 'binary',
            factor_field: 'ceiling_factor',
            levels: { active: 1.25 },
            notes: null,
            active: 'Y',
          },
        ],
      })
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.conditions.conditions).toHaveLength(1)
    })

    act(() => {
      result.current.actions.setRoomCondition('ceiling', 'CEIL_TEXTURE', 'active')
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = findSaveRequest(fixture.estimate.id)
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      room_ceiling_scopes: Array<{ condition_factor: number | null }>
    }
    expect(body.room_ceiling_scopes.every((s) => s.condition_factor === 1.25)).toBe(true)
    expect(body.room_ceiling_scopes.length).toBeGreaterThan(0)
  })

  it('writes trim condition_factor when a trim condition is active', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
        condition_modifier_catalog: [
          {
            id: 'TRIM_CAULK',
            label: 'Heavy caulking',
            scope: 'trim',
            modifier_type: 'severity',
            factor_field: 'caulk_fill_factor',
            levels: { minor: 1.1, moderate: 1.25, major: 1.5 },
            notes: null,
            active: 'Y',
          },
        ],
      })
    })
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.conditions.conditions).toHaveLength(1)
    })

    act(() => {
      result.current.actions.setRoomCondition('trim', 'TRIM_CAULK', 'major')
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = findSaveRequest(fixture.estimate.id)
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      room_trim_scopes: Array<{ condition_factor: number | null }>
    }
    expect(body.room_trim_scopes.every((s) => s.condition_factor === 1.5)).toBe(true)
    expect(body.room_trim_scopes.length).toBeGreaterThan(0)
  })

  it('emits a template-unavailable warning when saved condition selections exist but no catalog is configured', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.jobSettingsDraft = {
      ...fixture.jobSettingsDraft,
      conditionSelections: {
        room: {},
        wall: { 'COND-OIL': 'active' },
        ceiling: {},
        trim: {},
      },
    }
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))
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

    expect(validationMessages(result.current.vm)).toContain(
      'Condition modifiers are not configured in your template. Saved selections will not apply factors until the template is seeded.'
    )
  })

  it('condition toggle no-op stays clean when re-applying an already-saved selection', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.jobSettingsDraft = {
      ...fixture.jobSettingsDraft,
      conditionSelections: { room: {}, wall: { WALL_OIL: 'active' }, ceiling: {}, trim: {} },
      resolvedConditionFactors: { room: 1, wall: 1.2, ceiling: 1, trim: 1 },
    }
    resetFixtureSavedSnapshot(fixture)
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
        condition_modifier_catalog: [
          {
            id: 'WALL_OIL',
            label: 'Oil-based paint',
            scope: 'wall',
            modifier_type: 'binary',
            factor_field: 'wall_factor',
            levels: { active: 1.2 },
            notes: null,
            active: 'Y',
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
      expect(result.current.vm.conditions.conditions).toHaveLength(1)
    })

    expect(result.current.dirty).toBe(false)
    mocks.authedFetch.mockClear()
    vi.useFakeTimers()

    act(() => {
      result.current.actions.setRoomCondition('wall', 'WALL_OIL', 'active')
    })

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(result.current.dirty).toBe(false)
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('sets crew size through the details VM and marks the estimate dirty', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.vm.crewSize).toBe(1)
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.actions.setCrewSize(3)
    })

    expect(result.current.vm.crewSize).toBe(3)
    expect(result.current.dirty).toBe(true)
  })

})
