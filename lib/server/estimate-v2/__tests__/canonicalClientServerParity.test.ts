import { describe, expect, it, vi } from 'vitest'
import { buildEstimateV2DirtySnapshot } from '@/app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot'
import { CANONICAL_FIXTURES } from '@/lib/estimator/__fixtures__/canonical/index.ts'
import { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
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
} from '@/lib/server/estimate-v2/calculationOrchestration'
import type { EstimateTemplateSettingsRow } from '@/lib/server/estimateTemplateSettings'
import type { EstimateV2Catalogs, EstimateV2SavePayload } from '@/types/estimator/v2'

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

type ScopeCategory = 'walls' | 'ceilings' | 'trim' | 'doors' | 'drywall' | 'other' | 'access fees'

type ScopeRow = {
  id?: unknown
  room_id?: unknown
  effective_total?: unknown
  total?: unknown
  condition_factor?: unknown
}

type RoomTotalRow = {
  room_id: string
  effective_total?: number | null
  baseTotal?: number | null
  finalTotal?: number | null
}

function toServerCatalogBundle(catalogs: EstimateV2Catalogs): EstimateV2CalculationCatalogBundle {
  const source = catalogs as unknown as Record<string, unknown>
  return {
    source,
    wall: toWallCalculationCatalogs(source),
    ceiling: toCeilingCalculationCatalogs(source),
    trim: toTrimCalculationCatalogs(source),
    door: toDoorCalculationCatalogs(source),
    drywall: toDrywallCalculationCatalogs(source),
  }
}

function closeToMessage(params: {
  scenario: string
  category: string
  id?: string
  client: unknown
  server: unknown
}) {
  return [
    `fixture scenario: ${params.scenario}`,
    `category: ${params.category}`,
    params.id ? `id: ${params.id}` : null,
    `client value: ${String(params.client)}`,
    `server value: ${String(params.server)}`,
  ]
    .filter(Boolean)
    .join(' | ')
}

function expectClose(params: {
  scenario: string
  category: string
  id?: string
  client: number | null | undefined
  server: number | null | undefined
  precision?: number
}) {
  const client = params.client ?? 0
  const server = params.server ?? 0
  try {
    expect(client).toBeCloseTo(server, params.precision ?? 2)
  } catch (error) {
    throw new Error(
      closeToMessage({
        scenario: params.scenario,
        category: params.category,
        id: params.id,
        client,
        server,
      }),
      { cause: error }
    )
  }
}

function rowId(row: ScopeRow) {
  return String(row.id ?? '').trim()
}

function rowTotal(row: ScopeRow | undefined) {
  if (!row) return null
  const value = row.effective_total ?? row.total
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function categoryTotal(rows: ScopeRow[]) {
  return rows.reduce((sum, row) => sum + (rowTotal(row) ?? 0), 0)
}

function compareScopeCategory(params: {
  scenario: string
  category: ScopeCategory
  clientRows: ScopeRow[]
  serverRows: ScopeRow[]
}) {
  const ids = new Set([
    ...params.clientRows.map(rowId).filter(Boolean),
    ...params.serverRows.map(rowId).filter(Boolean),
  ])

  if (ids.size === 0) {
    expectClose({
      scenario: params.scenario,
      category: params.category,
      id: 'absent category total',
      client: categoryTotal(params.clientRows),
      server: 0,
    })
    expectClose({
      scenario: params.scenario,
      category: params.category,
      id: 'absent category total',
      client: categoryTotal(params.serverRows),
      server: 0,
    })
    return
  }

  for (const id of ids) {
    const clientRow = params.clientRows.find((row) => rowId(row) === id)
    const serverRow = params.serverRows.find((row) => rowId(row) === id)
    expectClose({
      scenario: params.scenario,
      category: params.category,
      id,
      client: rowTotal(clientRow),
      server: rowTotal(serverRow),
    })
  }
}

function roomTotalMap(rows: RoomTotalRow[], key: 'effective_total' | 'baseTotal' | 'finalTotal') {
  return new Map(rows.map((row) => [row.room_id, row[key] ?? 0]))
}

function compareRoomTotals(params: {
  scenario: string
  clientRooms: RoomTotalRow[]
  serverRooms: RoomTotalRow[]
}) {
  const client = roomTotalMap(params.clientRooms, 'baseTotal')
  const server = roomTotalMap(params.serverRooms, 'baseTotal')
  const roomIds = new Set([...client.keys(), ...server.keys()])
  if (roomIds.size === 0) {
    expectClose({
      scenario: params.scenario,
      category: 'room totals',
      id: 'absent room totals',
      client: 0,
      server: 0,
    })
    return
  }

  for (const roomId of roomIds) {
    expectClose({
      scenario: params.scenario,
      category: 'room totals',
      id: roomId,
      client: client.get(roomId) ?? 0,
      server: server.get(roomId) ?? 0,
    })
  }
}

function buildPayload(fixture: (typeof CANONICAL_FIXTURES)[number]) {
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

function compareParity(params: {
  scenario: string
  payload: EstimateV2SavePayload
  catalogs: EstimateV2Catalogs
  orgDefaults?: EstimateTemplateSettingsRow | null
}) {
  const client = calculateEstimateV2Preview({
    payload: params.payload,
    catalogs: params.catalogs,
    orgDefaults: params.orgDefaults,
  })
  const server = calculateEstimateV2ArtifactsFromPayload({
    payload: params.payload,
    calculationCatalogs: toServerCatalogBundle(params.catalogs),
    orgDefaults: params.orgDefaults ?? null,
  })

  compareScopeCategory({
    scenario: params.scenario,
    category: 'walls',
    clientRows: client.walls.scopes,
    serverRows: server.wallCalculations.scopes,
  })
  compareScopeCategory({
    scenario: params.scenario,
    category: 'ceilings',
    clientRows: client.ceilings.scopes,
    serverRows: server.ceilingCalculations.scopes,
  })
  compareScopeCategory({
    scenario: params.scenario,
    category: 'trim',
    clientRows: client.trim.scopes,
    serverRows: server.trimCalculations.scopes,
  })
  compareScopeCategory({
    scenario: params.scenario,
    category: 'doors',
    clientRows: client.doors.scopes,
    serverRows: server.doorCalculations.scopes,
  })
  compareScopeCategory({
    scenario: params.scenario,
    category: 'drywall',
    clientRows: client.drywall.scopes,
    serverRows: server.drywallCalculations.scopes,
  })
  compareScopeCategory({
    scenario: params.scenario,
    category: 'other',
    clientRows: client.other.scopes,
    serverRows: server.otherCalculations.scopes,
  })
  compareScopeCategory({
    scenario: params.scenario,
    category: 'access fees',
    clientRows: client.accessFees.rows.map((row) => ({
      id: row.id,
      room_id: row.roomId,
      effective_total: row.total,
    })),
    serverRows: server.accessFeeCalculation.rows.map((row) => ({
      id: row.id,
      room_id: row.roomId,
      effective_total: row.total,
    })),
  })

  for (const field of [
    'rawLaborHours',
    'rawLaborDays',
    'effectiveLaborDays',
    'effectiveLaborHours',
    'laborAdjustmentHours',
  ] as const) {
    expectClose({
      scenario: params.scenario,
      category: `labor-day policy field ${field}`,
      client: client.pricingSummary[field],
      server: server.pricingSummary[field],
      precision: 4,
    })
  }

  for (const field of ['minimumAdjustmentAmount', 'postLaborPolicyTotal'] as const) {
    expectClose({
      scenario: params.scenario,
      category: `job minimum field ${field}`,
      client: client.pricingSummary[field],
      server: server.pricingSummary[field],
    })
  }

  expect(client.trimPaint).toEqual(server.trimPaintInput)

  compareRoomTotals({
    scenario: params.scenario,
    clientRooms: client.pricingSummary.rooms,
    serverRooms: server.pricingSummary.rooms,
  })

  expectClose({
    scenario: params.scenario,
    category: 'final total',
    client: client.pricingSummary.finalTotal,
    server: server.pricingSummary.finalTotal,
  })

  return { client, server }
}

const ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS: EstimateTemplateSettingsRow = {
  default_template_key: 'canonical-org-defaults-only',
  quote_validity_days: 30,
  terms_text: '',
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

function buildOrgDefaultsOnlyPayload(fixture: (typeof CANONICAL_FIXTURES)[number]) {
  const payload = structuredClone(buildPayload(fixture)) as EstimateV2SavePayload
  const jobsettings = payload.jobsettings as unknown as Record<string, unknown>

  jobsettings.walls_paint_id = null
  jobsettings.walls_primer_id = ''
  jobsettings.ceiling_paint_id = null
  jobsettings.ceiling_primer_id = ''
  jobsettings.trim_paint_id = null
  jobsettings.trim_primer_id = ''
  jobsettings.labor_day_policy_enabled = null
  jobsettings.dayhours = null
  jobsettings.rounding_increment_hours = null
  jobsettings.override_labor_rate = null
  jobsettings.job_minimum_enabled = null
  jobsettings.job_minimum_amount = null
  jobsettings.standard_door_deduction_sf = null
  jobsettings.standard_window_deduction_sf = null
  jobsettings.baseboard_opening_deduction_lf = null
  jobsettings.trim_paint_gallons = 1

  for (const row of payload.room_wall_scopes) {
    row.paint_product_id = ''
    row.primer_product_id = null
  }
  for (const row of payload.room_ceiling_scopes) {
    row.paint_product_id = null
    row.primer_product_id = ''
  }
  for (const row of payload.room_trim_scopes) {
    row.paint_product_id = ''
    row.primer_product_id = null
  }
  for (const row of payload.room_door_scopes ?? []) {
    row.paint_product_id = null
    row.primer_product_id = ''
  }

  return payload
}

function withTrimPaintPrice(catalogs: EstimateV2Catalogs): EstimateV2Catalogs {
  return {
    ...catalogs,
    paint_products: catalogs.paint_products.map((row) =>
      row.id === ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS.trim_paint_id
        ? { ...row, price_per_gal: 80 }
        : row
    ) as EstimateV2Catalogs['paint_products'],
  }
}

describe('Estimator V2 canonical client/server parity', () => {
  for (const fixture of CANONICAL_FIXTURES) {
    it(`matches server calculations for ${fixture.scenarioName}`, () => {
      compareParity({
        scenario: fixture.scenarioName,
        payload: buildPayload(fixture),
        catalogs: fixture.editorState.meta.catalogs,
      })
    })
  }

  it('matches server and customer snapshot totals when only org defaults supply products and policies', () => {
    const fixture = CANONICAL_FIXTURES.find((item) => item.scenarioName === 'All scope types')
    if (!fixture) throw new Error('Missing all-scope-types canonical fixture')
    const payload = buildOrgDefaultsOnlyPayload(fixture)
    const catalogs = withTrimPaintPrice(fixture.editorState.meta.catalogs)

    const { client, server } = compareParity({
      scenario: `${fixture.scenarioName} with org defaults only`,
      payload,
      catalogs,
      orgDefaults: ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS,
    })

    expect(payload.jobsettings.walls_paint_id).toBeNull()
    expect(payload.jobsettings.ceiling_paint_id).toBeNull()
    expect(payload.jobsettings.trim_paint_id).toBeNull()
    expect(payload.room_wall_scopes[0].paint_product_id).toBe('')
    expect(server.wallCalculations.scopes[0].paint_product_id).toBe(
      ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS.walls_paint_id
    )
    expect(client.walls.scopes[0].paint_product_id).toBe(server.wallCalculations.scopes[0].paint_product_id)
    expect(server.ceilingCalculations.scopes[0].paint_product_id).toBe(
      ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS.ceiling_paint_id
    )
    expect(client.ceilings.scopes[0].paint_product_id).toBe(server.ceilingCalculations.scopes[0].paint_product_id)
    expect(server.trimCalculations.scopes[0].paint_product_id).toBe(
      ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS.trim_paint_id
    )
    expect(client.trim.scopes[0].paint_product_id).toBe(server.trimCalculations.scopes[0].paint_product_id)
    expect(server.doorCalculations.scopes[0]?.paint_product_id).toBe(
      ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS.trim_paint_id
    )
    expect(client.doors.scopes[0]?.paint_product_id).toBe(server.doorCalculations.scopes[0]?.paint_product_id)
    expect(server.quoteWallScopes[0].paint_product_id).toBeNull()
    expect(server.quoteWallScopes[0].primer_product_id).toBeNull()
    expect(server.quoteCeilingScopes[0].paint_product_id).toBeNull()
    expect(server.quoteCeilingScopes[0].primer_product_id).toBeNull()
    expect(server.quoteTrimScopes[0].paint_product_id).toBeNull()
    expect(server.quoteTrimScopes[0].primer_product_id).toBeNull()
    expect(server.quoteDoorScopes[0]?.paint_product_id).toBeNull()
    expect(server.quoteDoorScopes[0]?.primer_product_id).toBeNull()
    expect(client.trimPaint?.paint_product_id).toBe(ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS.trim_paint_id)
    expect(server.trimPaintInput?.paint_product_id).toBe(ORG_DEFAULTS_ONLY_FIXTURE_DEFAULTS.trim_paint_id)
    expect(client.pricingSummary.finalTotal).toBeCloseTo(server.pricingSummary.finalTotal, 2)
    expect(client.pricingSummary.finalTotal).toBeCloseTo(1500, 2)
  })

  it('matches server totals when crew size is decimal and must be normalized', () => {
    const fixture = CANONICAL_FIXTURES.find((item) => item.scenarioName === 'All scope types')
    if (!fixture) throw new Error('Missing all-scope-types canonical fixture')
    const payload = buildPayload(fixture)
    payload.jobsettings.crew_size = 3.8

    const { client, server } = compareParity({
      scenario: `${fixture.scenarioName} with decimal crew size`,
      payload,
      catalogs: fixture.editorState.meta.catalogs,
    })

    expect(client.pricingSummary.finalTotal).toBeCloseTo(server.pricingSummary.finalTotal, 2)
  })

  it('matches server artifacts for production rates, access fees, other items, doors, drywall, and pricing summary', () => {
    const fixture = CANONICAL_FIXTURES.find((item) => item.scenarioName === 'All scope types')
    if (!fixture) throw new Error('Missing all-scope-types canonical fixture')
    const payload = buildPayload(fixture)
    payload.other = [
      {
        id: 'other-preview-parity-1',
        room_id: payload.rooms[0]?.room_id ?? 'R001',
        active: 'Y',
        pricing_mode: 'fixed',
        fixed_amount: 125,
        description: 'Preview parity add-on',
      },
    ]

    const { client, server } = compareParity({
      scenario: `${fixture.scenarioName} artifact coverage`,
      payload,
      catalogs: fixture.editorState.meta.catalogs,
    })

    expect(client.walls.scopes[0]?.paint_prod_rate_sqft_per_hour).toBeCloseTo(
      server.wallCalculations.scopes[0]?.paint_prod_rate_sqft_per_hour ?? 0,
      4
    )
    expect(client.ceilings.scopes[0]?.paint_prod_rate_sqft_per_hour).toBeCloseTo(
      server.ceilingCalculations.scopes[0]?.paint_prod_rate_sqft_per_hour ?? 0,
      4
    )
    expect(client.doors.scopes.length).toBeGreaterThan(0)
    expect(client.drywall.scopes.length).toBeGreaterThan(0)
    expect(client.other.scopes.length).toBeGreaterThan(0)
    expect(client.accessFees.rows.length).toBeGreaterThan(0)
    expect(client.accessFees.total).toBeCloseTo(server.accessFeeCalculation.total, 2)
    expect(client.pricingSummary.postLaborPolicyTotal).toBeCloseTo(server.pricingSummary.postLaborPolicyTotal, 2)
    expect(client.pricingSummary.minimumAdjustmentAmount).toBeCloseTo(
      server.pricingSummary.minimumAdjustmentAmount,
      2
    )
    expect(client.pricingSummary.finalTotal).toBeCloseTo(server.pricingSummary.finalTotal, 2)
  })

  it('matches server condition-factor preparation from room and scope selections', () => {
    const fixture = CANONICAL_FIXTURES.find((item) => item.scenarioName === 'All scope types')
    if (!fixture) throw new Error('Missing all-scope-types canonical fixture')
    const payload = structuredClone(buildPayload(fixture)) as EstimateV2SavePayload
    const roomId = payload.rooms[0]?.room_id
    if (!roomId) throw new Error('Missing room for condition-factor parity fixture')

    payload.rooms[0].condition_selections = { ROOM_OCCUPIED: 'active' }
    if (payload.room_wall_scopes[0]) {
      payload.room_wall_scopes[0].condition_selections = { WALL_DAMAGE: 'moderate' }
    }
    if (payload.room_ceiling_scopes[0]) {
      payload.room_ceiling_scopes[0].condition_selections = { CEILING_STAIN: 'active' }
    }
    if (payload.room_trim_scopes[0]) {
      payload.room_trim_scopes[0].condition_selections = { TRIM_DETAIL: 'major' }
    }

    const catalogs = {
      ...fixture.editorState.meta.catalogs,
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

    const { client, server } = compareParity({
      scenario: `${fixture.scenarioName} with condition modifiers`,
      payload,
      catalogs,
    })
    const conditionFactor = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) ? value : Number(value ?? 0)

    expect(conditionFactor(client.walls.scopes[0]?.condition_factor)).toBeCloseTo(
      conditionFactor(server.wallCalculations.scopes[0]?.condition_factor),
      4
    )
    expect(conditionFactor(client.walls.scopes[0]?.condition_factor)).toBeCloseTo(1.32, 4)
    expect(conditionFactor(client.ceilings.scopes[0]?.condition_factor)).toBeCloseTo(
      conditionFactor(server.ceilingCalculations.scopes[0]?.condition_factor),
      4
    )
    expect(conditionFactor(client.ceilings.scopes[0]?.condition_factor)).toBeCloseTo(1.155, 4)
    expect(conditionFactor(client.trim.scopes[0]?.condition_factor)).toBeCloseTo(
      conditionFactor(server.trimCalculations.scopes[0]?.condition_factor),
      4
    )
    expect(conditionFactor(client.trim.scopes[0]?.condition_factor)).toBeCloseTo(1.265, 4)
    expect(conditionFactor(client.doors.scopes[0]?.condition_factor)).toBeCloseTo(
      conditionFactor(server.doorCalculations.scopes[0]?.condition_factor),
      4
    )
    expect(conditionFactor(client.doors.scopes[0]?.condition_factor)).toBeCloseTo(1.1, 4)
  })
})
