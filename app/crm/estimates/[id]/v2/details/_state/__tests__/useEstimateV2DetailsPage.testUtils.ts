import { vi } from 'vitest'
import { createMixedEstimateV2Fixture } from '../../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import { buildEstimateV2DirtySnapshot } from '../../../_state/estimateV2DirtySnapshot'

type MixedEstimateV2Fixture = ReturnType<typeof createMixedEstimateV2Fixture>

type DetailsValidationVm = {
  validationIssues: Array<{ message: string }>
}

export function createResponse(
  payload: unknown,
  init?: { ok?: boolean; status?: number; statusText?: string }
) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    text: vi.fn(async () => JSON.stringify({ data: payload })),
  }
}

export function createErrorResponse(message: string, status = 500) {
  return {
    ok: false,
    status,
    statusText: 'Server Error',
    text: vi.fn(async () => JSON.stringify({ error: message })),
  }
}

export function createRollerRatesPayload() {
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

export function validationMessages(vm: DetailsValidationVm) {
  return vm.validationIssues.map((issue) => issue.message)
}

export function dispatchBeforeUnload() {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
  window.dispatchEvent(event)
  return event
}

export function mockLoadedEstimate(
  fixture: MixedEstimateV2Fixture,
  useEstimateV2EditorLoader: {
    mockImplementation: (
      implementation: (args: { store: EstimateV2EditorStoreApi }) => void
    ) => unknown
  },
  initializedStores: WeakSet<object>
) {
  useEstimateV2EditorLoader.mockImplementation(({ store }: { store: EstimateV2EditorStoreApi }) => {
    if (initializedStores.has(store)) return
    initializedStores.add(store)
    const state = store.getState()
    state.setCollections({
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      accessFees: fixture.accessFees,
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
      jobSettingsDraft: fixture.jobSettingsDraft,
      lastSavedSnapshot: fixture.currentSnapshot,
    }))
  })
}

export function resetFixtureSavedSnapshot(fixture: MixedEstimateV2Fixture) {
  fixture.currentSnapshot = buildEstimateV2DirtySnapshot({
    jobSettingsDraft: fixture.jobSettingsDraft,
    rooms: fixture.rooms,
    scopes: fixture.scopes,
    segments: fixture.segments,
    roomFlags: fixture.roomFlags,
    rollers: fixture.rollers,
    accessFees: fixture.accessFees,
    ceilingScopes: fixture.ceilingScopes,
    ceilingSegments: fixture.ceilingSegments,
    trimScopes: fixture.trimScopes,
  })
}
