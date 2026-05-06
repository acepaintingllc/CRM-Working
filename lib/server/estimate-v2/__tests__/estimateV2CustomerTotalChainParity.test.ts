import { describe, expect, it, vi } from 'vitest'
import {
  buildEstimateChainParityArtifacts,
  buildEstimateChainParityDbRows,
  ESTIMATE_CHAIN_PARITY_SCENARIOS,
  expectSameCustomerTotal,
  recordCanonicalScopeTotalAssertions,
  type EstimateChainParityDbRows,
} from './estimateChainParityHelpers'
import { buildPricingKpis } from '@/app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived'
import type { EstimateV2GetResponse } from '@/types/estimator/v2'

const mocks = vi.hoisted(() => ({
  getEstimate: vi.fn(),
  loadEstimateTemplateSettings: vi.fn(),
  loadEstimateV2CalculationCatalogs: vi.fn(),
  loadEstimateV2RoomModesForTrimFromDb: vi.fn(),
  supabaseFrom: vi.fn(),
}))

vi.mock('../../org.ts', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

vi.mock('../../estimateTemplateSettings.ts', () => ({
  loadEstimateTemplateSettings: mocks.loadEstimateTemplateSettings,
}))

vi.mock('../../estimateV2Catalogs.ts', async () => {
  const actual = await vi.importActual<typeof import('../../estimateV2Catalogs.ts')>(
    '../../estimateV2Catalogs.ts'
  )
  return {
    ...actual,
    loadEstimateV2CalculationCatalogs: mocks.loadEstimateV2CalculationCatalogs,
    loadEstimateV2RoomModesForTrimFromDb: mocks.loadEstimateV2RoomModesForTrimFromDb,
  }
})

vi.mock('../shared.ts', async () => {
  const actual = await vi.importActual<typeof import('../shared.ts')>('../shared.ts')
  return {
    ...actual,
    getEstimate: mocks.getEstimate,
  }
})

import { loadEstimateV2Response } from '../loadEstimateAssembly'

type DbLikeRow = Record<string, unknown>
type QueryError = { message: string }
type QueryResult<T> = { data: T | null; error: QueryError | null }
type LoadTable =
  | 'estimate_jobsettings'
  | 'estimate_rooms'
  | 'estimate_room_wall_scopes'
  | 'estimate_segments'
  | 'estimate_ceiling_segments'
  | 'estimate_room_ceiling_scopes'
  | 'estimate_room_ceiling_scope_segments'
  | 'estimate_room_trim_scopes'
  | 'estimate_room_door_scopes'
  | 'estimate_drywall_repairs'
  | 'estimate_rollers'
  | 'estimate_prejob'
  | 'estimate_trim_items'
  | 'estimate_job_colors'
  | 'estimate_room_flags'
  | 'estimate_access_fees'
  | 'estimate_other'

type QueryChain = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: Promise<QueryResult<DbLikeRow | DbLikeRow[]>>['then']
  catch: Promise<QueryResult<DbLikeRow | DbLikeRow[]>>['catch']
  finally: Promise<QueryResult<DbLikeRow | DbLikeRow[]>>['finally']
}

function queryResult<T extends DbLikeRow | DbLikeRow[]>(data: T): QueryResult<T> {
  return { data, error: null }
}

function createQueryChain(result: QueryResult<DbLikeRow | DbLikeRow[]>): QueryChain {
  const promise = Promise.resolve(result)
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  } satisfies QueryChain

  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.is.mockReturnValue(chain)
  chain.not.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue(result)

  return chain
}

function createLoadSupabaseStub(rows: EstimateChainParityDbRows) {
  const tablePlan: Record<LoadTable, QueryResult<DbLikeRow | DbLikeRow[]>[]> = {
    estimate_jobsettings: [queryResult(rows.estimate_jobsettings)],
    estimate_rooms: [queryResult(rows.estimate_rooms)],
    estimate_room_wall_scopes: [queryResult(rows.estimate_room_wall_scopes)],
    estimate_segments: [
      queryResult(rows.estimate_segments.legacyRoomSegments),
      queryResult(rows.estimate_segments.wallSegments),
    ],
    estimate_ceiling_segments: [queryResult(rows.estimate_ceiling_segments)],
    estimate_room_ceiling_scopes: [queryResult(rows.estimate_room_ceiling_scopes)],
    estimate_room_ceiling_scope_segments: [queryResult(rows.estimate_room_ceiling_scope_segments)],
    estimate_room_trim_scopes: [queryResult(rows.estimate_room_trim_scopes)],
    estimate_room_door_scopes: [queryResult(rows.estimate_room_door_scopes)],
    estimate_drywall_repairs: [queryResult(rows.estimate_drywall_repairs)],
    estimate_rollers: [queryResult([])],
    estimate_prejob: [queryResult([])],
    estimate_trim_items: [queryResult(rows.estimate_trim_items)],
    estimate_job_colors: [queryResult([])],
    estimate_room_flags: [queryResult([])],
    estimate_access_fees: [queryResult(rows.estimate_access_fees)],
    estimate_other: [queryResult(rows.estimate_other)],
  }
  const remaining = new Map<string, QueryResult<DbLikeRow | DbLikeRow[]>[]>(
    Object.entries(tablePlan).map(([table, entries]) => [table, [...entries]])
  )
  const from = vi.fn((table: string) => {
    const entries = remaining.get(table)
    if (!entries) {
      throw new Error(`Unexpected DB table ${table}`)
    }
    const result = entries.shift()
    if (!result) {
      throw new Error(`Unexpected duplicate DB call to ${table}`)
    }
    return createQueryChain(result)
  })

  return {
    from,
    assertAllExpectedTablesUsed: () => {
      const unused = [...remaining.entries()]
        .filter(([, entries]) => entries.length > 0)
        .map(([table, entries]) => `${table} (${entries.length})`)
      expect(unused).toEqual([])
    },
  }
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function recordCustomerTotalAssertion(
  errors: Error[],
  params: Parameters<typeof expectSameCustomerTotal>[0]
) {
  try {
    expectSameCustomerTotal(params)
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)))
  }
}

describe('Estimator V2 customer total save/load/summary chain parity', () => {
  for (const scenario of Object.keys(ESTIMATE_CHAIN_PARITY_SCENARIOS) as Array<
    keyof typeof ESTIMATE_CHAIN_PARITY_SCENARIOS
  >) {
    it(`keeps customer final total stable through save, load, and summary for ${scenario}`, async () => {
      Object.values(mocks).forEach((mock) => mock.mockReset())
      const artifacts = buildEstimateChainParityArtifacts(scenario)
      const rows = buildEstimateChainParityDbRows(artifacts)
      const fixtureExpectedTotal = artifacts.fixture.expectedTotals.finalTotal
      const assertionErrors: Error[] = []

      // saveEstimateV2Inputs does not currently pass pricing_summary forward, so the save hop
      // is asserted against the calculated artifact used to build the persisted V2 rows.
      recordCustomerTotalAssertion(assertionErrors, {
        scenario,
        hop: 'save',
        expected: fixtureExpectedTotal,
        actual: artifacts.calculationArtifacts.pricingSummary.finalTotal,
      })
      recordCanonicalScopeTotalAssertions(assertionErrors, artifacts)
      recordCustomerTotalAssertion(assertionErrors, {
        scenario,
        hop: 'save',
        expected: artifacts.calculationArtifacts.pricingSummary.finalTotal,
        actual: asNumber(rows.estimate_version_rollups.final_total),
      })

      const supabase = createLoadSupabaseStub(rows)
      mocks.supabaseFrom.mockImplementation(supabase.from)
      mocks.getEstimate.mockResolvedValue({ estimate: rows.estimates })
      mocks.loadEstimateTemplateSettings.mockResolvedValue(null)
      mocks.loadEstimateV2CalculationCatalogs.mockResolvedValue(
        artifacts.calculationArtifacts.calculationCatalogs
      )
      mocks.loadEstimateV2RoomModesForTrimFromDb.mockResolvedValue(new Map())

      const loaded = (await loadEstimateV2Response({
        requestOrigin: 'http://localhost:3000',
        orgId: String(rows.estimates.org_id),
        userId: 'user-chain-parity',
        estimateId: String(rows.estimates.id),
      })) as EstimateV2GetResponse

      recordCustomerTotalAssertion(assertionErrors, {
        scenario,
        hop: 'load',
        expected: artifacts.calculationArtifacts.pricingSummary.finalTotal,
        actual: loaded.pricing_summary?.finalTotal,
      })

      const derived = buildPricingKpis({
        pricingSummary: loaded.pricing_summary,
        dayhours: loaded.pricing_summary?.effectiveLaborHours
          ? loaded.pricing_summary.effectiveLaborHours / loaded.pricing_summary.effectiveLaborDays
          : 8,
        roomsCount: loaded.inputs.rooms.length,
        laborRateEffective: loaded.inputs.jobsettings?.override_labor_rate ?? 0,
      })

      recordCustomerTotalAssertion(assertionErrors, {
        scenario,
        hop: 'summary',
        expected: loaded.pricing_summary?.finalTotal,
        actual: derived.finalTotal,
      })
      supabase.assertAllExpectedTablesUsed()

      if (assertionErrors.length > 0) {
        throw new AggregateError(
          assertionErrors,
          `Customer total parity failed for ${scenario}`
        )
      }
    })
  }
})
