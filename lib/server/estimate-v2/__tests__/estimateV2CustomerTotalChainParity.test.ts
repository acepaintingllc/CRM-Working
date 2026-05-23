import { describe, expect, it, vi } from 'vitest'
import {
  buildEstimateChainParityArtifacts,
  buildEstimateChainParityPayload,
  buildEstimateChainParityDbRows,
  ESTIMATE_CHAIN_PARITY_SCENARIOS,
  expectSameCustomerTotal,
  recordCanonicalScopeTotalAssertions,
  type EstimateChainParityDbRows,
} from './estimateChainParityHelpers'
import { buildPricingKpis } from '@/app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived'
import { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import { buildCustomerDocumentFromSendContext } from '@/lib/server/customer-send/document'
import { deriveEstimateCustomerSendCalculatedData } from '@/lib/server/customer-send/contextCalculations'
import { mapCustomerQuoteSourceModel } from '@/lib/server/customer-send/contextMapper'
import type { EstimateCustomerSendRawResources } from '@/lib/server/customer-send/contextTypes'
import type { EstimateV2Catalogs } from '@/types/estimator/v2Catalogs'
import type { EstimateV2GetResponse, EstimateV2SavePayload } from '@/types/estimator/v2Summary'
import type { EstimateTemplateSettingsRow } from '../../estimateTemplateSettings'

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

function estimateV2CatalogsAliasMock() {
  return {
    loadEstimateV2CalculationCatalogs: mocks.loadEstimateV2CalculationCatalogs,
    loadEstimateV2RoomModesForTrimFromDb: mocks.loadEstimateV2RoomModesForTrimFromDb,
    resolveEstimateV2RoomModeById: (params: {
      rooms: Array<Record<string, unknown>>
      wallScopes: Array<Record<string, unknown>>
      ceilingScopes: Array<Record<string, unknown>>
    }) => {
      const roomMode = new Map<string, 'RECT' | 'SEG'>()
      for (const scope of params.wallScopes) {
        const roomId = String(scope.room_id ?? '').toUpperCase()
        if (!roomId || roomMode.has(roomId)) continue
        roomMode.set(roomId, String(scope.mode ?? '').toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
      }
      for (const scope of params.ceilingScopes) {
        const roomId = String(scope.room_id ?? '').toUpperCase()
        if (!roomId || roomMode.has(roomId)) continue
        roomMode.set(roomId, String(scope.mode ?? '').toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
      }
      for (const room of params.rooms) {
        const roomId = String(room.room_id ?? '').toUpperCase()
        if (!roomId || roomMode.has(roomId)) continue
        roomMode.set(roomId, String(room.mode ?? '').toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
      }
      return roomMode
    },
  }
}

vi.mock('@/lib/server/estimateV2Catalogs', () => estimateV2CatalogsAliasMock())
vi.mock('@/lib/server/estimateV2Catalogs.ts', () => estimateV2CatalogsAliasMock())

vi.mock('../shared.ts', async () => {
  const actual = await vi.importActual<typeof import('../shared.ts')>('../shared.ts')
  return {
    ...actual,
    getEstimate: mocks.getEstimate,
  }
})

import {
  calculateEstimateV2ArtifactsForSave,
  type EstimateV2CalculationCatalogBundle,
} from '../calculationOrchestration.ts'
import { loadEstimateV2Response } from '../loadEstimateAssembly.ts'

type DbLikeRow = Record<string, unknown>
type QueryError = { message: string }
type QueryResult<T> = { data: T | null; error: QueryError | null }
type LoadTable =
  | 'estimate_jobsettings'
  | 'estimate_rooms'
  | 'estimate_room_wall_scopes'
  | 'estimate_segments'
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
    estimate_segments: [queryResult(rows.estimate_segments.wallSegments)],
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

type ComparableRow = Record<string, unknown>

const DRIFT_GUARD_ORG_DEFAULTS: EstimateTemplateSettingsRow = {
  default_template_key: 'drift-guard-default',
  quote_validity_days: 30,
  terms_text: 'Standard quote terms.',
  walls_paint_id: 'prod-wall-satin',
  walls_primer_id: 'prod-wall-primer',
  ceiling_paint_id: 'prod-ceiling-flat',
  ceiling_primer_id: 'prod-ceiling-primer',
  trim_paint_id: 'prod-trim-enamel',
  trim_primer_id: 'prod-trim-primer',
  labor_day_policy_enabled: true,
  dayhours: 7,
  rounding_increment_hours: 2,
  override_labor_rate: 73,
  job_minimum_enabled: true,
  job_minimum_amount: 1500,
  standard_door_deduction_sf: 32,
  standard_window_deduction_sf: 18,
  baseboard_opening_deduction_lf: 5,
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asComparableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function rowById(rows: ComparableRow[]) {
  return new Map(rows.map((row) => [asText(row.id), row]))
}

function asComparableRows(rows: unknown): ComparableRow[] {
  return Array.isArray(rows) ? (rows as ComparableRow[]) : []
}

function expectRowsMatchFields(params: {
  label: string
  expectedRows: ComparableRow[]
  actualRows: ComparableRow[]
  fields: string[]
}) {
  const expected = rowById(params.expectedRows)
  const actual = rowById(params.actualRows)
  expect([...actual.keys()].sort(), `${params.label}: row ids`).toEqual([...expected.keys()].sort())

  for (const [id, expectedRow] of expected) {
    const actualRow = actual.get(id)
    expect(actualRow, `${params.label}:${id}: row`).toBeTruthy()
    if (!actualRow) continue

    for (const field of params.fields) {
      const expectedValue = expectedRow[field]
      const actualValue = actualRow[field]
      if (typeof expectedValue === 'number' || typeof actualValue === 'number') {
        expect(asComparableNumber(actualValue), `${params.label}:${id}:${field}`).toBeCloseTo(
          asComparableNumber(expectedValue) ?? 0,
          2
        )
      } else if (field === 'production_rate_id') {
        expect(asText(actualValue).toLowerCase(), `${params.label}:${id}:${field}`).toEqual(
          asText(expectedValue).toLowerCase()
        )
      } else {
        expect(actualValue ?? null, `${params.label}:${id}:${field}`).toEqual(expectedValue ?? null)
      }
    }
  }
}

function accessFeeComparableRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    access_group: row.access_group ?? row.group,
    catalog_amount: row.catalog_amount ?? row.catalogAmount,
    calculated_total: row.calculated_total ?? row.calculatedTotal,
    effective_total: row.effective_total ?? row.total,
    overridden: row.overridden,
  }))
}

function buildDriftGuardPayload(fixture: (typeof ESTIMATE_CHAIN_PARITY_SCENARIOS)['full-room-quote']): EstimateV2SavePayload {
  const payload = structuredClone(buildEstimateChainParityPayload(fixture)) as EstimateV2SavePayload

  payload.jobsettings = {
    ...payload.jobsettings,
    walls_paint_id: null,
    walls_primer_id: '',
    ceiling_paint_id: null,
    ceiling_primer_id: '',
    trim_paint_id: null,
    trim_primer_id: '',
    labor_day_policy_enabled: null,
    dayhours: null,
    rounding_increment_hours: null,
    override_labor_rate: null,
    job_minimum_enabled: null,
    job_minimum_amount: null,
    standard_door_deduction_sf: null,
    standard_window_deduction_sf: null,
    baseboard_opening_deduction_lf: null,
    trim_paint_gallons: 1,
  }

  if (payload.rooms[0]) {
    payload.rooms[0].condition_selections = { ROOM_OCCUPIED: 'active' }
  }
  if (payload.room_wall_scopes[0]) {
    payload.room_wall_scopes[0].paint_product_id = ''
    payload.room_wall_scopes[0].primer_product_id = null
    payload.room_wall_scopes[0].condition_selections = { WALL_DAMAGE: 'moderate' }
  }
  if (payload.room_ceiling_scopes[0]) {
    payload.room_ceiling_scopes[0].paint_product_id = null
    payload.room_ceiling_scopes[0].primer_product_id = ''
    payload.room_ceiling_scopes[0].condition_selections = { CEILING_STAIN: 'active' }
  }
  if (payload.room_trim_scopes[0]) {
    payload.room_trim_scopes[0].paint_product_id = ''
    payload.room_trim_scopes[0].primer_product_id = null
    payload.room_trim_scopes[0].condition_selections = { TRIM_DETAIL: 'major' }
  }
  if (payload.room_door_scopes?.[0]) {
    payload.room_door_scopes[0].paint_product_id = null
    payload.room_door_scopes[0].primer_product_id = ''
  }

  payload.other = [
    ...(payload.other ?? []),
    {
      id: 'other-drift-guard-1',
      room_id: payload.rooms[0]?.room_id ?? 'R001',
      active: 'Y',
      pricing_mode: 'fixed',
      fixed_amount: 125,
      description: 'Drift guard add-on',
      client_description: 'Drift guard add-on',
    },
    {
      id: 'other-drift-guard-job-level',
      room_id: null,
      active: 'Y',
      pricing_mode: 'fixed',
      fixed_amount: 80,
      description: 'Job-level drift guard add-on',
      client_description: 'Job-level drift guard add-on',
    },
  ]

  return payload
}

function buildDriftGuardCatalogs(catalogs: EstimateV2Catalogs): EstimateV2Catalogs {
  return {
    ...catalogs,
    paint_products: catalogs.paint_products.map((row) =>
      row.id === DRIFT_GUARD_ORG_DEFAULTS.trim_paint_id ? { ...row, price_per_gal: 80 } : row
    ) as EstimateV2Catalogs['paint_products'],
    condition_modifiers: [
      {
        id: 'ROOM_OCCUPIED',
        label: 'Occupied',
        scope: 'room',
        modifier_type: 'binary',
        levels: { active: 1.1 },
        active: 'Y',
      },
      {
        id: 'WALL_DAMAGE',
        label: 'Wall damage',
        scope: 'wall',
        modifier_type: 'severity',
        levels: { moderate: 1.2 },
        active: 'Y',
      },
      {
        id: 'CEILING_STAIN',
        label: 'Ceiling stain',
        scope: 'ceiling',
        modifier_type: 'binary',
        levels: { active: 1.05 },
        active: 'Y',
      },
      {
        id: 'TRIM_DETAIL',
        label: 'Trim detail',
        scope: 'trim',
        modifier_type: 'severity',
        levels: { major: 1.15 },
        active: 'Y',
      },
    ],
  } as EstimateV2Catalogs
}

function buildCustomerSendResources(params: {
  rows: EstimateChainParityDbRows
  catalogs: EstimateV2Catalogs
}): EstimateCustomerSendRawResources {
  return {
    estimate: params.rows.estimates as EstimateCustomerSendRawResources['estimate'],
    job: params.rows.jobs as EstimateCustomerSendRawResources['job'],
    customer: params.rows.customers as EstimateCustomerSendRawResources['customer'],
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '555-0100',
      business_email: 'office@example.test',
      address: '123 Paint St',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    quoteDefaults: {
      default_template_key: DRIFT_GUARD_ORG_DEFAULTS.default_template_key,
      quote_validity_days: DRIFT_GUARD_ORG_DEFAULTS.quote_validity_days,
      terms_text: DRIFT_GUARD_ORG_DEFAULTS.terms_text,
    },
    settingsRow: DRIFT_GUARD_ORG_DEFAULTS,
    jobsettings: params.rows.estimate_jobsettings,
    rollupFinalTotal: asComparableNumber(params.rows.estimate_version_rollups.final_total),
    catalogs: params.catalogs as EstimateCustomerSendRawResources['catalogs'],
    rooms: params.rows.estimate_rooms,
    wallScopes: params.rows.estimate_room_wall_scopes,
    segments: [],
    wallSegments: params.rows.estimate_segments.wallSegments,
    ceilingSegments: [],
    ceilingScopes: params.rows.estimate_room_ceiling_scopes,
    ceilingScopeSegments: params.rows.estimate_room_ceiling_scope_segments,
    trimScopes: params.rows.estimate_room_trim_scopes,
    doorScopes: params.rows.estimate_room_door_scopes,
    drywallRepairs: params.rows.estimate_drywall_repairs,
    accessFees: params.rows.estimate_access_fees,
    trimItems: params.rows.estimate_trim_items,
    other: params.rows.estimate_other,
    publicVersions: params.rows.estimate_public_versions,
  } as unknown as EstimateCustomerSendRawResources
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

      // The save hop is represented by the canonical artifact used to build persisted V2 rows.
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

  it('guards customer-visible calculation parity across save calculation, load, preview, and customer-send', async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    const fixture = ESTIMATE_CHAIN_PARITY_SCENARIOS['full-room-quote']
    const payload = buildDriftGuardPayload(fixture)
    const catalogs = buildDriftGuardCatalogs(fixture.editorState.meta.catalogs)
    const artifacts = buildEstimateChainParityArtifacts('full-room-quote', {
      payload,
      catalogs,
      orgDefaults: DRIFT_GUARD_ORG_DEFAULTS,
    })
    const rows = buildEstimateChainParityDbRows(artifacts)
    const expectedTotal = artifacts.calculationArtifacts.pricingSummary.finalTotal
    const assertionErrors: Error[] = []

    const preview = calculateEstimateV2Preview({
      payload,
      catalogs,
      orgDefaults: DRIFT_GUARD_ORG_DEFAULTS,
    })
    const saveArtifacts = await calculateEstimateV2ArtifactsForSave({
      orgId: String(rows.estimates.org_id),
      estimateId: String(rows.estimates.id),
      roomRows: payload.rooms as never,
      wallScopeRows: payload.room_wall_scopes as never,
      wallSegmentRows: payload.wall_segments as never,
      ceilingScopeRows: payload.room_ceiling_scopes as never,
      ceilingSegmentRows: payload.ceiling_scope_segments as never,
      trimScopeRows: payload.room_trim_scopes as never,
      doorScopeRows: payload.room_door_scopes as never,
      drywallRepairRows: payload.drywall_repairs as never,
      accessFeeRows: payload.access_fees as never,
      otherRows: payload.other as never,
      jobsettings: payload.jobsettings as never,
      orgDefaults: DRIFT_GUARD_ORG_DEFAULTS,
      ensureCatalogs: vi.fn(
        async () => artifacts.calculationArtifacts.calculationCatalogs as EstimateV2CalculationCatalogBundle
      ),
    })

    const supabase = createLoadSupabaseStub(rows)
    mocks.supabaseFrom.mockImplementation(supabase.from)
    mocks.getEstimate.mockResolvedValue({ estimate: rows.estimates })
    mocks.loadEstimateTemplateSettings.mockResolvedValue(DRIFT_GUARD_ORG_DEFAULTS)
    mocks.loadEstimateV2CalculationCatalogs.mockResolvedValue(
      artifacts.calculationArtifacts.calculationCatalogs
    )
    mocks.loadEstimateV2RoomModesForTrimFromDb.mockResolvedValue(new Map())
    const loaded = (await loadEstimateV2Response({
      requestOrigin: 'http://localhost:3000',
      orgId: String(rows.estimates.org_id),
      userId: 'user-drift-guard',
      estimateId: String(rows.estimates.id),
    })) as EstimateV2GetResponse

    const resources = buildCustomerSendResources({ rows, catalogs })
    const customerSendCalculated = await deriveEstimateCustomerSendCalculatedData(resources, {
      requestOrigin: 'http://localhost:3000',
      orgId: String(rows.estimates.org_id),
      userId: 'user-drift-guard',
      estimateId: String(rows.estimates.id),
    })
    if (!customerSendCalculated.ok) throw new Error(customerSendCalculated.message)
    expect(customerSendCalculated.ok).toBe(true)
    const customerContext = mapCustomerQuoteSourceModel({
      origin: 'http://localhost:3000',
      resources,
      calculated: customerSendCalculated.data,
    })
    const customerDocument = buildCustomerDocumentFromSendContext({ context: customerContext })

    for (const [hop, expected, actual] of [
      ['canonical', expectedTotal, expectedTotal],
      ['save-calculation-artifact', expectedTotal, saveArtifacts.pricingSummary.finalTotal],
      ['save-rollup', expectedTotal, asComparableNumber(rows.estimate_version_rollups.final_total)],
      ['preview', expectedTotal, preview.pricingSummary.finalTotal],
      ['load', expectedTotal, loaded.pricing_summary?.finalTotal],
      ['customer-send-context', expectedTotal, customerContext.pricing_summary?.finalTotal],
      ['customer-document', expectedTotal, customerDocument.total],
    ] as const) {
      recordCustomerTotalAssertion(assertionErrors, {
        scenario: 'full-room-quote drift guard',
        hop,
        expected,
        actual,
      })
    }

    expect(artifacts.calculationArtifacts.wallCalculations.scopes.length).toBeGreaterThan(0)
    expect(artifacts.calculationArtifacts.ceilingCalculations.scopes.length).toBeGreaterThan(0)
    expect(artifacts.calculationArtifacts.trimCalculations.scopes.length).toBeGreaterThan(0)
    expect(artifacts.calculationArtifacts.doorCalculations.scopes.length).toBeGreaterThan(0)
    expect(artifacts.calculationArtifacts.drywallCalculations.scopes.length).toBeGreaterThan(0)
    expect(artifacts.calculationArtifacts.accessFeeCalculation.rows.length).toBeGreaterThan(0)
    expect(artifacts.calculationArtifacts.otherCalculations.scopes.length).toBeGreaterThan(0)
    expect(saveArtifacts.accessFeeCalculation.total).toBeCloseTo(
      artifacts.calculationArtifacts.accessFeeCalculation.total,
      2
    )
    expect(saveArtifacts.pricingSummary.sharedAccessCost).toBeCloseTo(
      artifacts.calculationArtifacts.pricingSummary.sharedAccessCost,
      2
    )

    expectRowsMatchFields({
      label: 'wall engine canonical/preview',
      expectedRows: artifacts.calculationArtifacts.wallCalculations.scopes,
      actualRows: preview.walls.scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_id', 'paint_product_label', 'paint_prod_rate_sqft_per_hour', 'condition_factor'],
    })
    expectRowsMatchFields({
      label: 'wall engine canonical/load',
      expectedRows: artifacts.calculationArtifacts.wallCalculations.scopes,
      actualRows: asComparableRows(loaded.wall_calculations?.scopes),
      fields: ['effective_total', 'raw_total', 'paint_product_id', 'paint_product_label', 'paint_prod_rate_sqft_per_hour', 'condition_factor'],
    })
    expectRowsMatchFields({
      label: 'ceiling engine canonical/preview',
      expectedRows: artifacts.calculationArtifacts.ceilingCalculations.scopes,
      actualRows: preview.ceilings.scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_id', 'paint_product_label', 'paint_prod_rate_sqft_per_hour', 'condition_factor'],
    })
    expectRowsMatchFields({
      label: 'ceiling engine canonical/load',
      expectedRows: artifacts.calculationArtifacts.ceilingCalculations.scopes,
      actualRows: asComparableRows(loaded.ceiling_calculations?.scopes),
      fields: ['effective_total', 'raw_total', 'paint_product_id', 'paint_product_label', 'paint_prod_rate_sqft_per_hour', 'condition_factor'],
    })
    expectRowsMatchFields({
      label: 'trim engine canonical/preview',
      expectedRows: artifacts.calculationArtifacts.trimCalculations.scopes,
      actualRows: preview.trim.scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_id', 'paint_product_label', 'production_rate_id', 'condition_factor'],
    })
    expectRowsMatchFields({
      label: 'trim engine canonical/load',
      expectedRows: artifacts.calculationArtifacts.trimCalculations.scopes,
      actualRows: asComparableRows(loaded.trim_calculations?.scopes),
      fields: ['effective_total', 'raw_total', 'paint_product_id', 'paint_product_label', 'production_rate_id', 'condition_factor'],
    })
    expectRowsMatchFields({
      label: 'door engine canonical/preview',
      expectedRows: artifacts.calculationArtifacts.doorCalculations.scopes,
      actualRows: preview.doors.scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_id', 'paint_product_label', 'condition_factor'],
    })
    expectRowsMatchFields({
      label: 'door engine canonical/load',
      expectedRows: artifacts.calculationArtifacts.doorCalculations.scopes,
      actualRows: asComparableRows(loaded.door_calculations?.scopes),
      fields: ['effective_total', 'raw_total', 'paint_product_id', 'paint_product_label', 'condition_factor'],
    })
    expectRowsMatchFields({
      label: 'drywall engine canonical/preview',
      expectedRows: artifacts.calculationArtifacts.drywallCalculations.scopes,
      actualRows: preview.drywall.scopes,
      fields: ['effective_total', 'calculated_total', 'effective_quantity'],
    })
    expectRowsMatchFields({
      label: 'drywall engine canonical/load',
      expectedRows: artifacts.calculationArtifacts.drywallCalculations.scopes,
      actualRows: asComparableRows(loaded.drywall_calculations?.scopes),
      fields: ['effective_total', 'calculated_total', 'effective_quantity'],
    })
    expectRowsMatchFields({
      label: 'other canonical/preview',
      expectedRows: artifacts.calculationArtifacts.otherCalculations.scopes,
      actualRows: preview.other.scopes,
      fields: ['effective_total', 'pricing_mode'],
    })
    expectRowsMatchFields({
      label: 'other canonical/save-calculation',
      expectedRows: artifacts.calculationArtifacts.otherCalculations.scopes,
      actualRows: saveArtifacts.otherCalculations.scopes,
      fields: ['effective_total', 'pricing_mode'],
    })
    expectRowsMatchFields({
      label: 'access canonical/preview',
      expectedRows: accessFeeComparableRows(artifacts.calculationArtifacts.accessFeeCalculation.rows),
      actualRows: accessFeeComparableRows(preview.accessFees.rows),
      fields: ['label', 'access_group', 'catalog_amount', 'calculated_total', 'effective_total', 'overridden'],
    })
    expectRowsMatchFields({
      label: 'access canonical/save-calculation',
      expectedRows: accessFeeComparableRows(artifacts.calculationArtifacts.accessFeeCalculation.rows),
      actualRows: accessFeeComparableRows(saveArtifacts.accessFeeCalculation.rows),
      fields: ['label', 'access_group', 'catalog_amount', 'calculated_total', 'effective_total', 'overridden'],
    })

    expectRowsMatchFields({
      label: 'wall save/load/customer',
      expectedRows: rows.estimate_room_wall_scopes,
      actualRows: loaded.inputs.room_wall_scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_label', 'paint_product_id'],
    })
    expectRowsMatchFields({
      label: 'wall save/customer-send',
      expectedRows: loaded.inputs.room_wall_scopes,
      actualRows: customerContext.inputs.room_wall_scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_label', 'paint_product_id'],
    })
    expectRowsMatchFields({
      label: 'ceiling save/load/customer',
      expectedRows: rows.estimate_room_ceiling_scopes,
      actualRows: loaded.inputs.room_ceiling_scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_label', 'paint_product_id'],
    })
    expectRowsMatchFields({
      label: 'ceiling save/customer-send',
      expectedRows: loaded.inputs.room_ceiling_scopes,
      actualRows: customerContext.inputs.room_ceiling_scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_label', 'paint_product_id'],
    })
    expectRowsMatchFields({
      label: 'trim save/load/customer',
      expectedRows: rows.estimate_room_trim_scopes,
      actualRows: loaded.inputs.room_trim_scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_label', 'paint_product_id'],
    })
    expectRowsMatchFields({
      label: 'trim save/customer-send',
      expectedRows: loaded.inputs.room_trim_scopes,
      actualRows: customerContext.inputs.room_trim_scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_label', 'paint_product_id'],
    })
    expectRowsMatchFields({
      label: 'door save/load/customer',
      expectedRows: rows.estimate_room_door_scopes,
      actualRows: asComparableRows(loaded.inputs.room_door_scopes),
      fields: ['effective_total', 'raw_total', 'paint_product_label', 'paint_product_id'],
    })
    expectRowsMatchFields({
      label: 'door save/customer-send',
      expectedRows: asComparableRows(loaded.inputs.room_door_scopes),
      actualRows: customerContext.inputs.room_door_scopes,
      fields: ['effective_total', 'raw_total', 'paint_product_label', 'paint_product_id'],
    })
    expectRowsMatchFields({
      label: 'drywall save/load/customer',
      expectedRows: rows.estimate_drywall_repairs,
      actualRows: asComparableRows(loaded.inputs.drywall_repairs),
      fields: ['effective_total', 'calculated_total', 'effective_quantity'],
    })
    expectRowsMatchFields({
      label: 'drywall save/customer-send',
      expectedRows: asComparableRows(loaded.inputs.drywall_repairs),
      actualRows: asComparableRows(customerContext.inputs.drywall_repairs),
      fields: ['effective_total', 'calculated_total', 'effective_quantity'],
    })
    expectRowsMatchFields({
      label: 'access save/load/customer',
      expectedRows: accessFeeComparableRows(rows.estimate_access_fees),
      actualRows: accessFeeComparableRows(loaded.inputs.access_fees),
      fields: ['label', 'access_group', 'catalog_amount', 'calculated_total', 'effective_total'],
    })
    expectRowsMatchFields({
      label: 'access save/customer-send',
      expectedRows: accessFeeComparableRows(loaded.inputs.access_fees),
      actualRows: accessFeeComparableRows(customerContext.inputs.access_fees),
      fields: ['label', 'access_group', 'catalog_amount', 'calculated_total', 'effective_total', 'overridden'],
    })
    expectRowsMatchFields({
      label: 'other save/load/customer',
      expectedRows: rows.estimate_other,
      actualRows: loaded.inputs.other,
      fields: ['effective_total', 'pricing_mode'],
    })
    expectRowsMatchFields({
      label: 'other save/customer-send',
      expectedRows: loaded.inputs.other,
      actualRows: customerContext.inputs.other,
      fields: ['effective_total', 'pricing_mode'],
    })

    expect(artifacts.calculationArtifacts.wallCalculations.scopes[0]?.paint_product_id).toBe(
      DRIFT_GUARD_ORG_DEFAULTS.walls_paint_id
    )
    expect(artifacts.calculationArtifacts.ceilingCalculations.scopes[0]?.paint_product_id).toBe(
      DRIFT_GUARD_ORG_DEFAULTS.ceiling_paint_id
    )
    expect(artifacts.calculationArtifacts.trimCalculations.scopes[0]?.paint_product_id).toBe(
      DRIFT_GUARD_ORG_DEFAULTS.trim_paint_id
    )
    expect(artifacts.calculationArtifacts.wallCalculations.scopes[0]?.condition_factor).toBeCloseTo(1.32, 4)
    expect(artifacts.calculationArtifacts.ceilingCalculations.scopes[0]?.condition_factor).toBeCloseTo(1.155, 4)
    expect(artifacts.calculationArtifacts.trimCalculations.scopes[0]?.condition_factor).toBeCloseTo(1.265, 4)
    expect(artifacts.calculationArtifacts.doorCalculations.scopes[0]?.condition_factor).toBeCloseTo(1.1, 4)
    expect(artifacts.calculationArtifacts.wallCalculations.scopes[0]?.paint_prod_rate_sqft_per_hour).toBeGreaterThan(0)
    expect(artifacts.calculationArtifacts.trimCalculations.scopes[0]?.production_rate_id).toBeTruthy()
    supabase.assertAllExpectedTablesUsed()

    if (assertionErrors.length > 0) {
      throw new AggregateError(assertionErrors, 'Estimate V2 drift guard total parity failed')
    }
  })

  it('keeps all-scope customer-visible totals stable across canonical, save, load, and customer-send paths', async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    const artifacts = buildEstimateChainParityArtifacts('full-room-quote')
    const rows = buildEstimateChainParityDbRows(artifacts)
    const expectedTotal = artifacts.calculationArtifacts.pricingSummary.finalTotal
    const assertionErrors: Error[] = []

    const saveArtifacts = await calculateEstimateV2ArtifactsForSave({
      orgId: String(rows.estimates.org_id),
      estimateId: String(rows.estimates.id),
      roomRows: artifacts.payload.rooms as never,
      wallScopeRows: artifacts.payload.room_wall_scopes as never,
      wallSegmentRows: artifacts.payload.wall_segments as never,
      ceilingScopeRows: artifacts.payload.room_ceiling_scopes as never,
      ceilingSegmentRows: artifacts.payload.ceiling_scope_segments as never,
      trimScopeRows: artifacts.payload.room_trim_scopes as never,
      doorScopeRows: artifacts.payload.room_door_scopes as never,
      drywallRepairRows: artifacts.payload.drywall_repairs as never,
      accessFeeRows: artifacts.payload.access_fees as never,
      otherRows: artifacts.payload.other as never,
      jobsettings: artifacts.payload.jobsettings as never,
      orgDefaults: null,
      ensureCatalogs: vi.fn(
        async () => artifacts.calculationArtifacts.calculationCatalogs as EstimateV2CalculationCatalogBundle
      ),
    })

    const saveResponse = { pricing_summary: saveArtifacts.pricingSummary }

    const supabase = createLoadSupabaseStub(rows)
    mocks.supabaseFrom.mockImplementation(supabase.from)
    mocks.getEstimate.mockResolvedValue({ estimate: rows.estimates })
    mocks.loadEstimateTemplateSettings.mockResolvedValue(null)
    mocks.loadEstimateV2CalculationCatalogs.mockResolvedValue(
      artifacts.calculationArtifacts.calculationCatalogs
    )
    mocks.loadEstimateV2RoomModesForTrimFromDb.mockResolvedValue(new Map())

    const loadResponse = (await loadEstimateV2Response({
      requestOrigin: 'http://localhost:3000',
      orgId: String(rows.estimates.org_id),
      userId: 'user-all-scope-total-stability',
      estimateId: String(rows.estimates.id),
    })) as EstimateV2GetResponse

    const resources = buildCustomerSendResources({
      rows,
      catalogs: artifacts.fixture.editorState.meta.catalogs,
    })
    const customerSendCalculated = await deriveEstimateCustomerSendCalculatedData(resources, {
      requestOrigin: 'http://localhost:3000',
      orgId: String(rows.estimates.org_id),
      userId: 'user-all-scope-total-stability',
      estimateId: String(rows.estimates.id),
    })
    if (!customerSendCalculated.ok) throw new Error(customerSendCalculated.message)
    const customerSendContext = mapCustomerQuoteSourceModel({
      origin: 'http://localhost:3000',
      resources,
      calculated: customerSendCalculated.data,
    })

    for (const [hop, actual] of [
      ['canonical calculation', artifacts.calculationArtifacts.pricingSummary.finalTotal],
      ['save response', saveResponse.pricing_summary.finalTotal],
      ['load response', loadResponse.pricing_summary?.finalTotal],
      ['customer-send', customerSendContext.pricing_summary?.finalTotal],
    ] as const) {
      recordCustomerTotalAssertion(assertionErrors, {
        scenario: 'full-room-quote all-scope total stability',
        hop,
        expected: expectedTotal,
        actual,
      })
    }

    supabase.assertAllExpectedTablesUsed()

    if (assertionErrors.length > 0) {
      throw new AggregateError(assertionErrors, 'All-scope customer-visible total stability failed')
    }
  })
})
