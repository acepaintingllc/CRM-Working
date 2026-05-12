import { describe, expect, it, vi } from 'vitest'
import { buildPricingKpis } from '@/app/crm/estimates/[id]/v2/summary/_lib/estimateV2SummaryDerived'
import {
  estimateV2FunctionalCompletenessSmokeFixture,
  estimateV2FunctionalCompletenessSmokeIds as ids,
} from '@/lib/estimator/__fixtures__/canonical/index.ts'
import type { EstimateCustomerSendRawResources } from '@/lib/server/customer-send/contextTypes'
import type { EstimateV2GetResponse } from '@/types/estimator/v2'
import type { EstimateChainParityDbRows } from './estimateChainParityHelpers'
import type { EstimateV2CalculationCatalogBundle } from '../calculationOrchestration'

const mocks = vi.hoisted(() => ({
  getEstimate: vi.fn(),
  loadEstimateTemplateSettings: vi.fn(),
  loadEstimateV2CalculationCatalogs: vi.fn(),
  loadEstimateV2RoomModesForTrimFromDb: vi.fn(),
  supabaseFrom: vi.fn(),
  writeEstimatePublicEvent: vi.fn(),
  sendPublicEstimateAcceptanceNotifications: vi.fn(),
  sendPublicEstimateDeclineNotification: vi.fn(),
}))

vi.mock('../../org.ts', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

vi.mock('@/lib/server/org.ts', () => ({
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

vi.mock('@/lib/server/estimateV2Catalogs', async () => {
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

vi.mock('@/lib/server/customer-send/repository', () => ({
  writeEstimatePublicEvent: mocks.writeEstimatePublicEvent,
}))

vi.mock('@/lib/server/publicEstimateNotifications', () => ({
  sendPublicEstimateAcceptanceNotifications: mocks.sendPublicEstimateAcceptanceNotifications,
  sendPublicEstimateDeclineNotification: mocks.sendPublicEstimateDeclineNotification,
}))

const { buildEstimatePublicPersistedSnapshot } = await import('@/lib/customer-estimates/publicSnapshot.ts')
const { buildCustomerDocumentFromSendContext } = await import('@/lib/server/customer-send/document.ts')
const { deriveEstimateCustomerSendCalculatedData } = await import('@/lib/server/customer-send/contextCalculations.ts')
const { mapCustomerQuoteSourceModel } = await import('@/lib/server/customer-send/contextMapper.ts')
const {
  buildEstimateSnapshotRows,
  selectAcceptedOperationalEstimateResponse,
} = await import('@/lib/server/estimate-feedback/snapshots.ts')
const { loadAcceptedEstimateSource } = await import('@/lib/server/accepted-estimates/service.ts')
const { loadPublicEstimateSnapshot } = await import('@/lib/server/estimatePublicPortal.ts')
const { calculateEstimateV2ArtifactsForSave } = await import('../calculationOrchestration.ts')
const { loadEstimateV2Response } = await import('../loadEstimateAssembly.ts')
const {
  buildEstimateChainParityArtifactsFromFixture,
  buildEstimateChainParityDbRows,
  expectSameCustomerTotal,
} = await import('./estimateChainParityHelpers')

type DbLikeRow = Record<string, unknown>
type QueryResult<T> = { data: T | null; error: { message: string } | null }
type QueryChain = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
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
    in: vi.fn(),
    limit: vi.fn(),
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
  chain.in.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue(result)

  return chain
}

function createLoadSupabaseStub(rows: EstimateChainParityDbRows) {
  const tablePlan: Record<string, QueryResult<DbLikeRow | DbLikeRow[]>[]> = {
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
    estimate_prejob: [queryResult(rows.estimate_prejob)],
    estimate_trim_items: [queryResult(rows.estimate_trim_items)],
    estimate_job_colors: [queryResult([])],
    estimate_room_flags: [queryResult([])],
    estimate_access_fees: [queryResult(rows.estimate_access_fees)],
    estimate_other: [queryResult(rows.estimate_other)],
  }
  const remaining = new Map<string, QueryResult<DbLikeRow | DbLikeRow[]>[]>(
    Object.entries(tablePlan).map(([table, entries]) => [table, [...entries]])
  )

  return {
    from: vi.fn((table: string) => {
      const entries = remaining.get(table)
      if (!entries) throw new Error(`Unexpected DB table ${table}`)
      const result = entries.shift()
      if (!result) throw new Error(`Unexpected duplicate DB call to ${table}`)
      return createQueryChain(result)
    }),
    assertAllExpectedTablesUsed: () => {
      const unused = [...remaining.entries()]
        .filter(([, entries]) => entries.length > 0)
        .map(([table, entries]) => `${table} (${entries.length})`)
      expect(unused).toEqual([])
    },
  }
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value)
}

function idsFrom(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => String(row.id)).sort()
}

type SmokeSourcePayload = {
  customer_artifact: {
    document: {
      quote_rows: Array<{ key: string }>
    }
  }
  internal_operational_estimate: {
    inputs: Record<string, unknown>
  }
}

type SmokeOperationalSnapshot = {
  estimate_response?: {
    inputs?: {
      prejob?: Array<Record<string, unknown>>
    }
  }
}

function buildCustomerSendResources(params: {
  rows: EstimateChainParityDbRows
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
      default_template_key: 'default',
      quote_validity_days: 30,
      terms_text: 'Standard quote terms.',
    },
    settingsRow: null,
    jobsettings: params.rows.estimate_jobsettings,
    rollupFinalTotal: asNumber(params.rows.estimate_version_rollups.final_total),
    catalogs: estimateV2FunctionalCompletenessSmokeFixture.editorState.meta.catalogs as EstimateCustomerSendRawResources['catalogs'],
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
    prejob: params.rows.estimate_prejob,
    trimItems: params.rows.estimate_trim_items,
    other: params.rows.estimate_other,
    publicVersions: params.rows.estimate_public_versions,
  } as unknown as EstimateCustomerSendRawResources
}

function createAcceptedSourceDb(params: {
  estimate: DbLikeRow
  job: DbLikeRow
  snapshot: DbLikeRow
}) {
  return {
    from(table: string) {
      const row =
        table === 'jobs'
          ? params.job
          : table === 'estimates'
            ? params.estimate
            : table === 'estimate_snapshot'
              ? params.snapshot
              : null
      if (!row) throw new Error(`Unexpected accepted source table ${table}`)
      return {
        select: vi.fn(() => createQueryChain(queryResult(row))),
      }
    },
  }
}

describe('Estimate V2 functional completeness smoke', () => {
  it('keeps a complex draft complete through save, load, send, public, and accepted source boundaries', async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.writeEstimatePublicEvent.mockResolvedValue({ ok: true, data: null })
    mocks.sendPublicEstimateAcceptanceNotifications.mockResolvedValue({})
    mocks.sendPublicEstimateDeclineNotification.mockResolvedValue({})

    const artifacts = buildEstimateChainParityArtifactsFromFixture(
      'functional-completeness-smoke',
      estimateV2FunctionalCompletenessSmokeFixture
    )
    const canonicalPrejobTotals = new Map(
      artifacts.calculationArtifacts.prejobCalculations.scopes.map((row) => [
        row.id,
        row.effective_total,
      ])
    )
    expect([...canonicalPrejobTotals.values()].every((total) => total > 0)).toBe(true)

    const rows = buildEstimateChainParityDbRows(artifacts, {
      rawPrejobRowIds: [ids.prejob.bedroomWallpaper],
    })
    rows.estimate_public_versions = []
    const rawPrejobDbRow = rows.estimate_prejob.find(
      (row) => row.id === ids.prejob.bedroomWallpaper
    )
    expect(rawPrejobDbRow).toMatchObject({
      id: ids.prejob.bedroomWallpaper,
      trip_num: 1,
      trip_rate: 125,
      manual_adjustment: 25,
    })
    expect(rawPrejobDbRow).not.toHaveProperty('effective_total')

    const saveArtifacts = await calculateEstimateV2ArtifactsForSave({
      orgId: ids.orgId,
      estimateId: ids.estimateId,
      roomRows: artifacts.payload.rooms as never,
      wallScopeRows: artifacts.payload.room_wall_scopes as never,
      wallSegmentRows: artifacts.payload.wall_segments as never,
      ceilingScopeRows: artifacts.payload.room_ceiling_scopes as never,
      ceilingSegmentRows: artifacts.payload.ceiling_scope_segments as never,
      trimScopeRows: artifacts.payload.room_trim_scopes as never,
      doorScopeRows: artifacts.payload.room_door_scopes as never,
      drywallRepairRows: artifacts.payload.drywall_repairs as never,
      accessFeeRows: artifacts.payload.access_fees as never,
      prejobRows: artifacts.payload.prejob as never,
      otherRows: artifacts.payload.other as never,
      jobsettings: artifacts.payload.jobsettings as never,
      orgDefaults: null,
      ensureCatalogs: vi.fn(
        async () => artifacts.calculationArtifacts.calculationCatalogs as EstimateV2CalculationCatalogBundle
      ),
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
      orgId: ids.orgId,
      userId: 'user-functional-smoke',
      estimateId: ids.estimateId,
    })) as EstimateV2GetResponse
    supabase.assertAllExpectedTablesUsed()

    expect(loaded.inputs.rooms.map((row) => row.room_name).sort()).toEqual([
      'Bathroom',
      'Bedroom',
      'Hallway',
    ])
    expect(idsFrom(loaded.inputs.room_wall_scopes)).toEqual([
      ids.walls.bedroom,
      ids.walls.bedroomExcluded,
    ].sort())
    expect(idsFrom(loaded.inputs.wall_segments)).toEqual([
      ids.wallSegments.bedroomManual,
      ids.wallSegments.bedroomRectangle,
    ].sort())
    expect(idsFrom(loaded.inputs.room_ceiling_scopes)).toEqual([ids.ceilings.bathroom])
    expect(idsFrom(loaded.inputs.ceiling_scope_segments)).toEqual([ids.ceilingSegments.bathroomManual])
    expect(idsFrom(loaded.inputs.room_trim_scopes)).toEqual([
      ids.trim.bedroom,
      ids.trim.hallway,
    ].sort())
    expect(idsFrom(loaded.inputs.room_door_scopes ?? [])).toEqual([ids.doors.hallway])
    expect(idsFrom(loaded.inputs.drywall_repairs ?? [])).toEqual([ids.drywall.bedroom])
    expect(idsFrom(loaded.inputs.access_fees)).toEqual([
      ids.accessFees.bedroom,
      ids.accessFees.job,
    ].sort())
    expect(idsFrom(loaded.inputs.prejob)).toEqual([
      ids.prejob.bedroomFurniture,
      ids.prejob.bedroomWallpaper,
    ].sort())

    const excludedScope = loaded.inputs.room_wall_scopes.find((row) => row.id === ids.walls.bedroomExcluded)
    expect(excludedScope).toMatchObject({ include: 'N', effective_total: 0 })
    expect(
      loaded.wall_calculations?.scopes?.find((row) => row.id === ids.walls.bedroomExcluded)
    ).toMatchObject({ include: 'N', effective_total: 0 })
    expect(loaded.inputs.room_wall_scopes.find((row) => row.id === ids.walls.bedroom)).toMatchObject({
      override_total: 880,
      effective_total: 880,
    })
    expect(loaded.inputs.room_ceiling_scopes.find((row) => row.id === ids.ceilings.bathroom)).toMatchObject({
      override_paint_gallons: 1.25,
    })
    expect(loaded.inputs.prejob).toHaveLength(2)
    expect(loaded.inputs.prejob.find((row) => row.id === ids.prejob.bedroomWallpaper)).not.toHaveProperty(
      'effective_total'
    )
    expect(loaded.inputs.access_fees).toHaveLength(2)

    expect(saveArtifacts.pricingSummary.finalTotal).toBeCloseTo(loaded.pricing_summary?.finalTotal ?? 0, 2)
    const kpis = buildPricingKpis({
      pricingSummary: loaded.pricing_summary,
      dayhours: loaded.pricing_summary?.effectiveLaborHours
        ? loaded.pricing_summary.effectiveLaborHours / loaded.pricing_summary.effectiveLaborDays
        : 7,
      roomsCount: loaded.inputs.rooms.length,
      laborRateEffective: loaded.inputs.jobsettings?.override_labor_rate ?? 0,
    })
    expect(kpis.finalTotal).toBeCloseTo(loaded.pricing_summary?.finalTotal ?? 0, 2)

    const resources = buildCustomerSendResources({ rows })
    const customerSendCalculated = await deriveEstimateCustomerSendCalculatedData(resources, {
      requestOrigin: 'http://localhost:3000',
      orgId: ids.orgId,
      userId: 'user-functional-smoke',
      estimateId: ids.estimateId,
    })
    expect(customerSendCalculated.ok).toBe(true)
    if (!customerSendCalculated.ok) throw new Error(customerSendCalculated.message)
    const customerContext = mapCustomerQuoteSourceModel({
      origin: 'http://localhost:3000',
      resources,
      calculated: customerSendCalculated.data,
    })
    const document = buildCustomerDocumentFromSendContext({ context: customerContext })
    const documentTotal = document.total ?? 0

    expectSameCustomerTotal({
      scenario: 'functional-completeness-smoke',
      hop: 'customer-send-context',
      expected: loaded.pricing_summary?.finalTotal,
      actual: customerContext.pricing_summary?.finalTotal,
    })
    expect(documentTotal).toBeCloseTo(customerContext.pricing_summary?.finalTotal ?? 0, 2)
    expect(document.pricing_block.total ?? 0).toBeCloseTo(documentTotal, 2)
    expect(document.quote_rows.reduce((sum, row) => sum + row.price, 0)).toBeCloseTo(documentTotal, 2)
    expect(document.quote_rows.map((row) => row.key).sort()).toEqual([
      'ceilings',
      'doors',
      'drywall',
      'trim',
      'walls',
    ])
    const customerVisibleText = document.quote_rows
      .map((row) => `${row.key} ${row.label} ${row.description}`)
      .join(' ')
    expect(customerVisibleText).not.toMatch(
      /access|ladder|scaffold|prejob|prep trip|labor rounding|minimum|job minimum/i
    )
    expect(customerContext.pricing_summary?.finalTotal ?? 0).toBeGreaterThan(
      document.quote_rows.reduce((sum, row) => sum + row.price, 0) - 0.01
    )
    expect(customerContext.inputs.prejob).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.prejob.bedroomWallpaper,
          effective_total: canonicalPrejobTotals.get(ids.prejob.bedroomWallpaper),
        }),
      ])
    )

    const operationalEstimateResponse = {
      ...loaded,
      estimate: loaded.estimate,
      inputs: {
        ...loaded.inputs,
        ...customerContext.inputs,
      },
      wall_calculations: { scopes: customerContext.inputs.room_wall_scopes },
      ceiling_calculations: { scopes: customerContext.inputs.room_ceiling_scopes },
      trim_calculations: { scopes: customerContext.inputs.room_trim_scopes },
      door_calculations: { scopes: customerContext.inputs.room_door_scopes },
      drywall_calculations: { scopes: customerContext.inputs.drywall_repairs },
      pricing_summary: customerContext.pricing_summary ?? loaded.pricing_summary,
    } as unknown as EstimateV2GetResponse

    const draftArtifact = buildEstimatePublicPersistedSnapshot({
      document,
      draft: {
        title: document.meta.title,
        intro_paragraph: document.intro_paragraph,
        closing_paragraph: document.closing_paragraph,
        quote_validity_days: document.quote_validity_days,
        terms_text: document.terms.join('\n'),
        scope_text_edits: {},
      },
      operationalSnapshot: {
        artifact_kind: 'customer_send_operational_snapshot',
        artifact_version: 1,
        source_estimate_updated_at: loaded.estimate.updated_at,
        estimate_response: operationalEstimateResponse,
      },
    })
    const liveArtifact = buildEstimatePublicPersistedSnapshot({
      document: {
        ...document,
        meta: {
          ...document.meta,
          status: 'sent',
          sent_at: '2026-05-05T12:10:00.000Z',
          public_token: ids.publicToken,
        },
      },
      draft: draftArtifact.draft,
      operationalSnapshot: draftArtifact.operational_snapshot,
    })
    expect(draftArtifact.operational_snapshot).toEqual(liveArtifact.operational_snapshot)
    expect(draftArtifact.document.total ?? 0).toBeCloseTo(liveArtifact.document.total ?? 0, 2)

    const sentPublicVersion = {
      id: ids.publicVersionId,
      org_id: ids.orgId,
      estimate_id: ids.estimateId,
      customer_id: ids.customerId,
      created_by: 'user-functional-smoke',
      version_number: 1,
      status: 'sent',
      public_token: ids.publicToken,
      snapshot_json: liveArtifact,
      sent_at: '2026-05-05T12:10:00.000Z',
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      locked_at: null,
      acceptance_json: null,
    }
    const sentOperationalSnapshot = sentPublicVersion.snapshot_json
      .operational_snapshot as SmokeOperationalSnapshot
    expect(sentOperationalSnapshot.estimate_response?.inputs?.prejob).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.prejob.bedroomWallpaper,
          effective_total: canonicalPrejobTotals.get(ids.prejob.bedroomWallpaper),
        }),
      ])
    )
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table !== 'estimate_public_versions') throw new Error(`Unexpected public table ${table}`)
      return {
        select: vi.fn(() => createQueryChain(queryResult(sentPublicVersion))),
        update: vi.fn(() => createQueryChain(queryResult({ ...sentPublicVersion, status: 'viewed' }))),
      }
    })
    const publicQuote = await loadPublicEstimateSnapshot(ids.publicToken, {
      origin: 'http://localhost:3000',
    })
    expect(publicQuote.ok).toBe(true)
    if (!publicQuote.ok) throw new Error(publicQuote.message)
    expect(publicQuote.data.document.total ?? 0).toBeCloseTo(documentTotal, 2)

    const acceptedPublicVersion = {
      ...sentPublicVersion,
      status: 'accepted',
      accepted_at: '2026-05-05T12:30:00.000Z',
      locked_at: '2026-05-05T12:30:00.000Z',
      acceptance_json: {
        legal_name: ids.customerName,
        signature_type: 'typed',
      },
      snapshot_json: buildEstimatePublicPersistedSnapshot({
        document: {
          ...document,
          meta: {
            ...document.meta,
            status: 'accepted',
            sent_at: '2026-05-05T12:10:00.000Z',
            accepted_at: '2026-05-05T12:30:00.000Z',
            public_token: ids.publicToken,
          },
        },
        draft: draftArtifact.draft,
        operationalSnapshot: draftArtifact.operational_snapshot,
      }),
    }
    const acceptedEstimateResponse = selectAcceptedOperationalEstimateResponse({
      acceptedArtifact: acceptedPublicVersion.snapshot_json,
      liveEstimateResponse: loaded,
    })
    const built = buildEstimateSnapshotRows({
      orgId: ids.orgId,
      estimateResponse: acceptedEstimateResponse,
      job: { ...rows.jobs, linked_estimate_id: ids.estimateId },
      publicVersion: acceptedPublicVersion,
      createdBy: 'user-functional-smoke',
    })
    expect(built.snapshot.estimated_total).toBeCloseTo(documentTotal, 2)
    expect(built.lines.map((line) => line.line_kind).sort()).toEqual([
      'access',
      'access',
      'ceilings',
      'doors',
      'drywall',
      'prejob',
      'prejob',
      'summary',
      'trim',
      'trim',
      'walls',
      'walls',
    ].sort())
    const sourcePayload = built.snapshot.source_payload_json as SmokeSourcePayload
    const sourceInputs = sourcePayload.internal_operational_estimate.inputs
    for (const key of [
      'rooms',
      'room_wall_scopes',
      'room_ceiling_scopes',
      'room_trim_scopes',
      'room_door_scopes',
      'drywall_repairs',
      'access_fees',
      'prejob',
      'other',
    ]) {
      expect(Array.isArray(sourceInputs[key]), key).toBe(true)
    }
    expect(sourceInputs.jobsettings).toBeTruthy()
    expect(sourceInputs.org_defaults).toBeNull()
    expect(
      sourcePayload.customer_artifact.document.quote_rows.some(
        (row: { key: string }) => row.key === 'access' || row.key === 'prejob'
      )
    ).toBe(false)
    const sourceAccessFees = sourceInputs.access_fees as Array<Record<string, unknown>>
    const sourcePrejob = sourceInputs.prejob as Array<Record<string, unknown>>
    const builtPrejobLines = built.lines.filter((line) => line.line_kind === 'prejob')
    expect(new Map(builtPrejobLines.map((line) => [line.source_row_id, line.estimated_total]))).toEqual(
      canonicalPrejobTotals
    )
    expect(sourceAccessFees).toEqual(
      built.lines.filter((line) => line.line_kind === 'access').map((line) => line.output_json)
    )
    expect(sourcePrejob).toEqual(
      built.lines.filter((line) => line.line_kind === 'prejob').map((line) => line.output_json)
    )
    expect(sourceAccessFees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.accessFees.job,
          room_id: null,
          label: 'Ladder Setup',
          access_group: 'ladders',
          qty: 1,
          catalog_amount: 75,
          actual_cost_override: 160,
          calculated_total: 75,
          effective_total: 160,
          final_total: 160,
        }),
        expect.objectContaining({
          id: ids.accessFees.bedroom,
          room_id: ids.rooms.bedroom,
          label: 'Ladder Setup',
          access_group: 'ladders',
          qty: 2,
          catalog_amount: 75,
          calculated_total: 150,
          effective_total: 150,
          final_total: 150,
        }),
      ])
    )
    expect(sourcePrejob).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.prejob.bedroomWallpaper,
          room_id: ids.rooms.bedroom,
          trip_name: 'Bedroom wallpaper prep',
          trip_num: 1,
          trip_rate: 125,
          manual_adjustment: 25,
          calculated_total: 125,
          effective_total: 150,
          final_total: 150,
          notes: 'Steam wallpaper seam before painting.',
        }),
        expect.objectContaining({
          id: ids.prejob.bedroomFurniture,
          room_id: ids.rooms.bedroom,
          trip_name: 'Bedroom furniture prep',
          trip_num: 1,
          trip_rate: 95,
          calculated_total: 95,
          effective_total: 95,
          final_total: 95,
        }),
      ])
    )

    const acceptedSourceDb = createAcceptedSourceDb({
      estimate: {
        ...rows.estimates,
        accepted_at: '2026-05-05T12:30:00.000Z',
        accepted_public_version_id: ids.publicVersionId,
        version_state: 'live',
      },
      job: { ...rows.jobs, linked_estimate_id: ids.estimateId },
      snapshot: { ...built.snapshot, id: 'snapshot-functional-smoke' },
    })
    const acceptedSource = await loadAcceptedEstimateSource(
      acceptedSourceDb as never,
      ids.orgId,
      ids.jobId
    )
    expect(acceptedSource.ok).toBe(true)
    if (!acceptedSource.ok) throw new Error(acceptedSource.message)
    expect(acceptedSource.data.final_total).toBeCloseTo(documentTotal, 2)
    const acceptedSourcePayload = acceptedSource.data.source_payload_json as SmokeSourcePayload
    const operationalSource = acceptedSource.data.operational_source
    expect(acceptedSourcePayload.internal_operational_estimate.inputs.rooms as unknown[]).toHaveLength(3)
    expect(idsFrom(operationalSource.rooms as unknown as Array<Record<string, unknown>>)).toEqual(
      idsFrom(sourceInputs.rooms as Array<Record<string, unknown>>)
    )
    expect(idsFrom(operationalSource.room_wall_scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.walls.bedroom,
      ids.walls.bedroomExcluded,
    ].sort())
    expect(idsFrom(operationalSource.room_ceiling_scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.ceilings.bathroom,
    ])
    expect(idsFrom(operationalSource.room_trim_scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.trim.bedroom,
      ids.trim.hallway,
    ].sort())
    expect(idsFrom(operationalSource.room_door_scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.doors.hallway,
    ])
    expect(idsFrom(operationalSource.drywall_repairs as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.drywall.bedroom,
    ])
    expect(idsFrom(operationalSource.access_fees as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.accessFees.bedroom,
      ids.accessFees.job,
    ].sort())
    expect(idsFrom(operationalSource.prejob as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.prejob.bedroomFurniture,
      ids.prejob.bedroomWallpaper,
    ].sort())
    expect(operationalSource.pricing_summary.finalTotal).toBeCloseTo(documentTotal, 2)
    expect(idsFrom(operationalSource.wall_calculations.scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.walls.bedroom,
      ids.walls.bedroomExcluded,
    ].sort())
    expect(idsFrom(operationalSource.ceiling_calculations.scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.ceilings.bathroom,
    ])
    expect(idsFrom(operationalSource.trim_calculations.scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.trim.bedroom,
      ids.trim.hallway,
    ].sort())
    expect(idsFrom(operationalSource.door_calculations.scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.doors.hallway,
    ])
    expect(idsFrom(operationalSource.drywall_calculations.scopes as unknown as Array<Record<string, unknown>>)).toEqual([
      ids.drywall.bedroom,
    ])
    expect(operationalSource.access_fees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.accessFees.job,
          room_id: null,
          label: 'Ladder Setup',
          access_group: 'ladders',
          qty: 1,
          catalog_amount: 75,
          actual_cost_override: 160,
          calculated_total: 75,
          effective_total: 160,
          final_total: 160,
          override_total: 160,
          overridden: true,
        }),
        expect.objectContaining({
          id: ids.accessFees.bedroom,
          room_id: ids.rooms.bedroom,
          label: 'Ladder Setup',
          access_group: 'ladders',
          qty: 2,
          catalog_amount: 75,
          calculated_total: 150,
          effective_total: 150,
          final_total: 150,
          override_total: null,
          overridden: false,
        }),
      ])
    )
    expect(operationalSource.prejob).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.prejob.bedroomWallpaper,
          trip_name: 'Bedroom wallpaper prep',
          effective_total: canonicalPrejobTotals.get(ids.prejob.bedroomWallpaper),
          final_total: canonicalPrejobTotals.get(ids.prejob.bedroomWallpaper),
        }),
        expect.objectContaining({
          id: ids.prejob.bedroomFurniture,
          trip_name: 'Bedroom furniture prep',
          effective_total: canonicalPrejobTotals.get(ids.prejob.bedroomFurniture),
          final_total: canonicalPrejobTotals.get(ids.prejob.bedroomFurniture),
        }),
      ])
    )
    expect(
      (operationalSource.prejob as unknown as Array<Record<string, unknown>>).every(
        (row) => asNumber(row.effective_total) > 0
      )
    ).toBe(true)
    expect(acceptedSourcePayload.internal_operational_estimate.inputs.prejob).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.prejob.bedroomWallpaper,
          effective_total: canonicalPrejobTotals.get(ids.prejob.bedroomWallpaper),
        }),
        expect.objectContaining({
          id: ids.prejob.bedroomFurniture,
          effective_total: canonicalPrejobTotals.get(ids.prejob.bedroomFurniture),
        }),
      ])
    )

    ;(loaded.pricing_summary as Record<string, unknown>).finalTotal = 99_999
    ;(loaded.inputs.access_fees[0] as Record<string, unknown>).effective_total = 99_999
    ;(loaded.inputs.prejob[0] as Record<string, unknown>).trip_name = 'Mutated live prejob'
    expect(built.snapshot.estimated_total).toBeCloseTo(documentTotal, 2)
    const immutableBedroomPrejob = sourcePrejob.find(
      (row) => row.id === ids.prejob.bedroomWallpaper
    )
    expect(immutableBedroomPrejob?.trip_name).toBe('Bedroom wallpaper prep')
    expect(acceptedSource.data.final_total).toBeCloseTo(documentTotal, 2)
    const acceptedSourceAfterLiveMutation = await loadAcceptedEstimateSource(
      acceptedSourceDb as never,
      ids.orgId,
      ids.jobId
    )
    expect(acceptedSourceAfterLiveMutation.ok).toBe(true)
    if (!acceptedSourceAfterLiveMutation.ok) throw new Error(acceptedSourceAfterLiveMutation.message)
    expect(acceptedSourceAfterLiveMutation.data.final_total).toBeCloseTo(documentTotal, 2)
    expect(acceptedSourceAfterLiveMutation.data.operational_source.prejob).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.prejob.bedroomWallpaper,
          trip_name: 'Bedroom wallpaper prep',
        }),
      ])
    )
  })
})
