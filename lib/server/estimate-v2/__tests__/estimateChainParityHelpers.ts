import { expect, vi } from 'vitest'
import { buildEstimateV2DirtySnapshot } from '@/app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot'
import {
  allMajorPolicyFlagsFixture,
  allScopeTypesFixture,
  simpleNoOverridesFixture,
  type EstimateV2CanonicalFixture,
} from '@/lib/estimator/__fixtures__/canonical/index.ts'
import {
  toCeilingCalculationCatalogs,
  toDoorCalculationCatalogs,
  toDrywallCalculationCatalogs,
  toTrimCalculationCatalogs,
  toWallCalculationCatalogs,
} from '@/lib/server/estimateV2RoutePayload'
import {
  calculateEstimateV2ArtifactsFromPayload,
  type EstimateV2CalculationCatalogBundle,
} from '../calculationOrchestration'
import type { EstimateTemplateSettingsRow } from '../../estimateTemplateSettings'
import type { EstimateV2Catalogs, EstimateV2PricingSummary, EstimateV2SavePayload } from '@/types/estimator/v2'

export const ESTIMATE_CHAIN_PARITY_SCENARIOS = {
  'simple-interior-repaint': simpleNoOverridesFixture,
  'full-room-quote': allScopeTypesFixture,
  'policy-heavy-quote': allMajorPolicyFlagsFixture,
} as const satisfies Record<string, EstimateV2CanonicalFixture>

export type EstimateChainParityScenario = keyof typeof ESTIMATE_CHAIN_PARITY_SCENARIOS
export type EstimateChainParityHop = 'editor-save' | 'server-load' | 'send-context' | 'public-version' | (string & {})
export type EstimateChainParityScopeFamily =
  | 'walls'
  | 'ceilings'
  | 'trim'
  | 'doors'
  | 'drywall'
  | 'accessFees'

type DbLikeRow = Record<string, unknown>
type QueryError = { message: string }
type QueryResult<T> = { data: T | null; error: QueryError | null }
type EstimateV2CalculationArtifacts = ReturnType<typeof calculateEstimateV2ArtifactsFromPayload>

export type EstimateChainParityFixtureArtifacts = {
  scenario: EstimateChainParityScenario
  fixture: EstimateV2CanonicalFixture
  payload: EstimateV2SavePayload
  calculationArtifacts: EstimateV2CalculationArtifacts
}

export type EstimateChainParityDbRows = {
  estimates: DbLikeRow
  jobs: DbLikeRow
  customers: DbLikeRow
  estimate_jobsettings: DbLikeRow
  estimate_rooms: DbLikeRow[]
  estimate_room_wall_scopes: DbLikeRow[]
  estimate_segments: {
    wallSegments: DbLikeRow[]
  }
  estimate_room_ceiling_scopes: DbLikeRow[]
  estimate_room_ceiling_scope_segments: DbLikeRow[]
  estimate_room_trim_scopes: DbLikeRow[]
  estimate_room_door_scopes: DbLikeRow[]
  estimate_drywall_repairs: DbLikeRow[]
  estimate_access_fees: DbLikeRow[]
  estimate_trim_items: DbLikeRow[]
  estimate_other: DbLikeRow[]
  estimate_public_versions: DbLikeRow[]
  estimate_version_rollups: DbLikeRow
}

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

export type EstimateChainParitySupabaseStub = {
  from: ReturnType<typeof vi.fn>
  assertAllExpectedTablesUsed: () => void
}

function isDbLikeRow(value: unknown): value is DbLikeRow {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function asDbLikeRows(value: unknown): DbLikeRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => (isDbLikeRow(row) ? row : { value: row }))
}

function withRowMeta(row: DbLikeRow, meta: DbLikeRow): DbLikeRow {
  return {
    ...row,
    ...meta,
  }
}

function withRowsMeta(rows: unknown, meta: DbLikeRow): DbLikeRow[] {
  return asDbLikeRows(rows).map((row) => withRowMeta(row, meta))
}

function toServerCatalogBundle(catalogs: EstimateV2Catalogs): EstimateV2CalculationCatalogBundle {
  const source = catalogs as unknown as DbLikeRow
  return {
    source,
    wall: toWallCalculationCatalogs(source),
    ceiling: toCeilingCalculationCatalogs(source),
    trim: toTrimCalculationCatalogs(source),
    door: toDoorCalculationCatalogs(source),
    drywall: toDrywallCalculationCatalogs(source),
  }
}

export function buildEstimateChainParityPayload(fixture: EstimateV2CanonicalFixture): EstimateV2SavePayload {
  const { collections, meta } = fixture.editorState
  return buildEstimateV2DirtySnapshot({
    jobSettingsDraft: meta.jobSettingsDraft,
    rooms: collections.rooms,
    scopes: collections.scopes,
    segments: collections.segments,
    roomFlags: collections.roomFlags,
    ceilingScopes: collections.ceilingScopes,
    ceilingSegments: collections.ceilingSegments,
    trimScopes: collections.trimScopes,
    doorScopes: collections.doorScopes,
    drywallRepairs: collections.drywallRepairs,
    rollers: collections.rollers,
    accessFees: collections.accessFees,
    otherItems: collections.otherItems,
  }).payload
}

export function buildEstimateChainParityArtifacts(
  scenario: EstimateChainParityScenario,
  overrides: {
    payload?: EstimateV2SavePayload
    catalogs?: EstimateV2Catalogs
    orgDefaults?: EstimateTemplateSettingsRow | null
  } = {}
): EstimateChainParityFixtureArtifacts {
  const fixture = ESTIMATE_CHAIN_PARITY_SCENARIOS[scenario]
  const payload = overrides.payload ?? buildEstimateChainParityPayload(fixture)
  const calculationArtifacts = calculateEstimateV2ArtifactsFromPayload({
    payload,
    calculationCatalogs: toServerCatalogBundle(overrides.catalogs ?? fixture.editorState.meta.catalogs),
    orgDefaults: overrides.orgDefaults ?? null,
  })

  return {
    scenario,
    fixture,
    payload,
    calculationArtifacts,
  }
}

function pricingSummaryTotal(summary: EstimateV2PricingSummary): number {
  return summary.finalTotal
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function calculatedScopeTotalsByFamily(
  artifacts: EstimateV2CalculationArtifacts
): Record<EstimateChainParityScopeFamily, Map<string, number | null>> {
  const buildEngineMap = (rows: Array<Record<string, unknown>>) =>
    new Map(
      rows.map((row) => [
        asText(row.id),
        asNumber(row.effective_total),
      ] as const)
    )

  return {
    walls: buildEngineMap(artifacts.wallCalculations.scopes as unknown as Array<Record<string, unknown>>),
    ceilings: buildEngineMap(artifacts.ceilingCalculations.scopes as unknown as Array<Record<string, unknown>>),
    trim: buildEngineMap(artifacts.trimCalculations.scopes as unknown as Array<Record<string, unknown>>),
    doors: buildEngineMap(artifacts.doorCalculations.scopes as unknown as Array<Record<string, unknown>>),
    drywall: buildEngineMap(artifacts.drywallCalculations.scopes as unknown as Array<Record<string, unknown>>),
    accessFees: new Map(
      artifacts.accessFeeCalculation.rows.map((row) => [row.id, row.total] as const)
    ),
  }
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

export function recordCanonicalScopeTotalAssertions(
  errors: Error[],
  artifacts: EstimateChainParityFixtureArtifacts
) {
  const actualByFamily = calculatedScopeTotalsByFamily(artifacts.calculationArtifacts)
  const expectedByFamily = artifacts.fixture.expectedTotals.scopeTotals
  const families = Object.keys(expectedByFamily) as EstimateChainParityScopeFamily[]

  for (const family of families) {
    const expectedRows = expectedByFamily[family]
    const actualRows = actualByFamily[family]

    if (actualRows.size !== expectedRows.length) {
      errors.push(
        new Error(
          `scenario=${artifacts.scenario} hop=save:scope-count:${family} expected=${expectedRows.length} actual=${actualRows.size} actualScopeIds=${[
            ...actualRows.keys(),
          ].join(',')}`
        )
      )
    }

    for (const expected of expectedRows) {
      const actual = actualRows.get(expected.scopeId)
      if (!actualRows.has(expected.scopeId)) {
        errors.push(
          new Error(
            `scenario=${artifacts.scenario} hop=save:scope:${family}:${expected.scopeId} expected=${expected.total} actual=missing actualScopeIds=${[
              ...actualRows.keys(),
            ].join(',')}`
          )
        )
        continue
      }

      recordCustomerTotalAssertion(errors, {
        scenario: artifacts.scenario,
        hop: `save:scope:${family}:${expected.scopeId}`,
        expected: expected.total,
        actual,
      })
    }
  }
}

function requireFixtureMeta<T>(value: T | null, label: string): T {
  if (value == null) {
    throw new Error(`Canonical chain parity fixture is missing ${label}`)
  }
  return value
}

function buildAccessFeeRows(params: {
  rows: EstimateV2CalculationArtifacts['accessFeeCalculation']['rows']
  meta: DbLikeRow
}): DbLikeRow[] {
  return params.rows.map((row) =>
    withRowMeta(
      {
        id: row.id,
        room_id: row.roomId || null,
        access_fee_id: row.accessFeeId,
        qty: row.quantity,
        actual_cost_override: row.overridden ? row.total : null,
        label: row.label,
        access_group: row.group,
        catalog_amount: row.catalogAmount,
        calculated_total: row.calculatedTotal,
        effective_total: row.total,
        notes: row.notes || null,
        position: row.position,
        active: 'Y',
      },
      params.meta
    )
  )
}

export function buildEstimateChainParityDbRows(
  artifacts: EstimateChainParityFixtureArtifacts
): EstimateChainParityDbRows {
  const estimate = requireFixtureMeta(artifacts.fixture.editorState.meta.estimate, 'estimate metadata')
  const job = requireFixtureMeta(artifacts.fixture.editorState.meta.job, 'job metadata')
  const customer = artifacts.fixture.editorState.meta.customerDraft
  const meta = {
    org_id: estimate.org_id ?? 'org-canonical',
    estimate_id: estimate.id,
    job_id: estimate.job_id,
  } satisfies DbLikeRow

  return {
    estimates: {
      id: estimate.id,
      org_id: estimate.org_id ?? 'org-canonical',
      job_id: estimate.job_id,
      customer_id: job.customer_id ?? customer.customerId,
      status: 'draft',
      version_name: estimate.version_name,
      version_state: estimate.version_state,
      version_kind: estimate.version_kind ?? 'quote',
      version_sort_order: 1,
      created_at: estimate.updated_at ?? '2026-05-05T12:00:00.000Z',
      updated_at: estimate.updated_at ?? '2026-05-05T12:00:00.000Z',
    },
    jobs: {
      id: job.id,
      org_id: estimate.org_id ?? 'org-canonical',
      title: job.title,
      status: job.status,
      customer_id: job.customer_id ?? customer.customerId,
      customer_name: job.customer_name ?? customer.name,
      customer_address: job.customer_address ?? customer.address,
      customer_email: job.customer_email ?? customer.email,
      customer_phone: job.customer_phone ?? customer.phone,
      estimate_date: '2026-05-05',
    },
    customers: {
      id: customer.customerId,
      org_id: estimate.org_id ?? 'org-canonical',
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      street: customer.address,
      city: null,
      state: null,
      zip: null,
    },
    estimate_jobsettings: withRowMeta(artifacts.payload.jobsettings, meta),
    estimate_rooms: withRowsMeta(artifacts.payload.rooms, meta),
    estimate_room_wall_scopes: withRowsMeta(artifacts.calculationArtifacts.quoteWallScopes, meta),
    estimate_segments: {
      wallSegments: withRowsMeta(artifacts.calculationArtifacts.wallCalculations.segments, meta),
    },
    estimate_room_ceiling_scopes: withRowsMeta(artifacts.calculationArtifacts.quoteCeilingScopes, meta),
    estimate_room_ceiling_scope_segments: withRowsMeta(
      artifacts.calculationArtifacts.ceilingCalculations.segments,
      meta
    ),
    estimate_room_trim_scopes: withRowsMeta(artifacts.calculationArtifacts.quoteTrimScopes, meta),
    estimate_room_door_scopes: withRowsMeta(artifacts.calculationArtifacts.quoteDoorScopes, meta),
    estimate_drywall_repairs: withRowsMeta(artifacts.calculationArtifacts.drywallCalculations.scopes, meta),
    estimate_access_fees: buildAccessFeeRows({
      rows: artifacts.calculationArtifacts.accessFeeCalculation.rows,
      meta,
    }),
    estimate_trim_items: [],
    estimate_other: withRowsMeta(artifacts.calculationArtifacts.otherCalculations.scopes, meta),
    estimate_public_versions: [
      withRowMeta(
        {
          id: `${estimate.id}-public-v1`,
          version_number: 1,
          status: 'draft',
          snapshot: {
            estimate_id: estimate.id,
            final_total: pricingSummaryTotal(artifacts.calculationArtifacts.pricingSummary),
          },
          created_at: estimate.updated_at ?? '2026-05-05T12:00:00.000Z',
        },
        meta
      ),
    ],
    estimate_version_rollups: withRowMeta(
      {
        final_total: pricingSummaryTotal(artifacts.calculationArtifacts.pricingSummary),
        pricing_summary: artifacts.calculationArtifacts.pricingSummary,
        updated_at: estimate.updated_at ?? '2026-05-05T12:00:00.000Z',
      },
      meta
    ),
  }
}

function queryResult<T>(data: T): QueryResult<T> {
  return {
    data,
    error: null,
  }
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

type TablePlan = Partial<Record<keyof EstimateChainParityDbRows, QueryResult<DbLikeRow | DbLikeRow[]>[]>>

function pushTablePlan(
  plan: TablePlan,
  table: keyof EstimateChainParityDbRows,
  result: QueryResult<DbLikeRow | DbLikeRow[]>
) {
  plan[table] = [...(plan[table] ?? []), result]
}

export function buildEstimateChainParityTablePlan(rows: EstimateChainParityDbRows): TablePlan {
  const plan: TablePlan = {}
  pushTablePlan(plan, 'estimates', queryResult(rows.estimates))
  pushTablePlan(plan, 'jobs', queryResult(rows.jobs))
  pushTablePlan(plan, 'customers', queryResult(rows.customers))
  pushTablePlan(plan, 'estimate_jobsettings', queryResult(rows.estimate_jobsettings))
  pushTablePlan(plan, 'estimate_version_rollups', queryResult(rows.estimate_version_rollups))
  pushTablePlan(plan, 'estimate_rooms', queryResult(rows.estimate_rooms))
  pushTablePlan(plan, 'estimate_room_wall_scopes', queryResult(rows.estimate_room_wall_scopes))
  pushTablePlan(plan, 'estimate_segments', queryResult(rows.estimate_segments.wallSegments))
  pushTablePlan(plan, 'estimate_room_ceiling_scopes', queryResult(rows.estimate_room_ceiling_scopes))
  pushTablePlan(
    plan,
    'estimate_room_ceiling_scope_segments',
    queryResult(rows.estimate_room_ceiling_scope_segments)
  )
  pushTablePlan(plan, 'estimate_room_trim_scopes', queryResult(rows.estimate_room_trim_scopes))
  pushTablePlan(plan, 'estimate_room_door_scopes', queryResult(rows.estimate_room_door_scopes))
  pushTablePlan(plan, 'estimate_drywall_repairs', queryResult(rows.estimate_drywall_repairs))
  pushTablePlan(plan, 'estimate_access_fees', queryResult(rows.estimate_access_fees))
  pushTablePlan(plan, 'estimate_trim_items', queryResult(rows.estimate_trim_items))
  pushTablePlan(plan, 'estimate_other', queryResult(rows.estimate_other))
  pushTablePlan(plan, 'estimate_public_versions', queryResult(rows.estimate_public_versions))
  return plan
}

export function createEstimateChainParitySupabaseStub(rows: EstimateChainParityDbRows): EstimateChainParitySupabaseStub {
  const tablePlan = buildEstimateChainParityTablePlan(rows)
  const remaining = new Map<string, QueryResult<DbLikeRow | DbLikeRow[]>[]>(
    Object.entries(tablePlan).map(([table, entries]) => [table, [...(entries ?? [])]])
  )

  const from = vi.fn((table: string) => {
    const entries = remaining.get(table)
    if (!entries) {
      throw new Error(`Unexpected table ${table}`)
    }

    const next = entries.shift()
    if (!next) {
      throw new Error(`Unexpected duplicate call to table ${table}`)
    }

    return createQueryChain(next)
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

export function expectSameCustomerTotal(params: {
  scenario: EstimateChainParityScenario | string
  hop: EstimateChainParityHop
  expected: number | null | undefined
  actual: number | null | undefined
}) {
  const expected = params.expected ?? 0
  const actual = params.actual ?? 0
  try {
    expect(actual).toBeCloseTo(expected, 2)
  } catch (error) {
    throw new Error(
      `scenario=${params.scenario} hop=${params.hop} expected=${expected} actual=${actual}`,
      { cause: error }
    )
  }
}
