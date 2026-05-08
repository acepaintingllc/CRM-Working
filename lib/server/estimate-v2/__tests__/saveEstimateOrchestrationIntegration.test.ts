import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildEstimateChainParityArtifacts,
  buildEstimateChainParityPayload,
  ESTIMATE_CHAIN_PARITY_SCENARIOS,
} from './estimateChainParityHelpers'
import type { EstimateFullPersistencePayload } from '../scopeRowPersistence'

const mocks = vi.hoisted(() => ({
  getEstimate: vi.fn(),
  loadEstimateTemplateSettings: vi.fn(),
  loadEstimateV2CalculationCatalogs: vi.fn(),
  loadEstimateV2Response: vi.fn(),
  saveEstimateFullPersistenceTransactional: vi.fn(),
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
  }
})

vi.mock('../loadEstimateAssembly.ts', () => ({
  loadEstimateV2Response: mocks.loadEstimateV2Response,
}))

vi.mock('../scopeRowPersistence.ts', async () => {
  const actual = await vi.importActual<typeof import('../scopeRowPersistence.ts')>(
    '../scopeRowPersistence.ts'
  )
  return {
    ...actual,
    saveEstimateFullPersistenceTransactional: mocks.saveEstimateFullPersistenceTransactional,
  }
})

vi.mock('../shared.ts', async () => {
  const actual = await vi.importActual<typeof import('../shared.ts')>('../shared.ts')
  return {
    ...actual,
    getEstimate: mocks.getEstimate,
  }
})

import { saveEstimateV2Inputs } from '../saveEstimateOrchestration'

const estimateId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const jobId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const orgId = 'org-save-integration'
const userId = 'user-save-integration'

function createMaybeSingleChain(data: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  }
  return chain
}

function expectPersistedCalculationFields(
  actual: Record<string, unknown> | undefined,
  expected: Record<string, unknown>,
  fields: string[]
) {
  expect(actual).toBeTruthy()
  for (const field of fields) {
    expect(actual?.[field]).toEqual(expected[field])
  }
}

describe('saveEstimateV2Inputs canonical calculation integration', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: estimateId,
        org_id: orgId,
        job_id: jobId,
        setting_set_id_used: null,
      },
    })
    mocks.supabaseFrom.mockImplementation(() => createMaybeSingleChain(null))
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue({
      id: estimateId,
      org_id: orgId,
      job_id: jobId,
      customer_id: null,
      status: 'draft',
      version_name: 'Draft',
      version_state: 'draft',
      version_kind: 'quote',
      version_sort_order: 1,
      setting_set_id_used: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
    })
    mocks.loadEstimateV2Response.mockResolvedValue({
      estimate: { id: estimateId },
      inputs: {},
      pricing_summary: { finalTotal: 0 },
    })
  })

  it('persists canonical calculated rows for all submitted scope families in one save pass', async () => {
    const fixture = ESTIMATE_CHAIN_PARITY_SCENARIOS['full-room-quote']
    const payload = buildEstimateChainParityPayload(fixture)
    payload.rooms[0].condition_selections = { ROOM_OCCUPIED: 'active' }
    payload.room_wall_scopes[0].paint_product_id = null
    payload.room_wall_scopes[0].condition_selections = { WALL_DAMAGE: 'moderate' }
    payload.room_ceiling_scopes[0].paint_product_id = null
    payload.room_ceiling_scopes[0].condition_selections = { CEILING_STAIN: 'active' }
    payload.room_trim_scopes[0].paint_product_id = null
    payload.room_trim_scopes[0].condition_selections = { TRIM_DETAIL: 'major' }

    const artifacts = buildEstimateChainParityArtifacts('full-room-quote', { payload })
    mocks.loadEstimateTemplateSettings.mockResolvedValue(null)
    mocks.loadEstimateV2CalculationCatalogs.mockResolvedValue(artifacts.calculationArtifacts.calculationCatalogs)

    await saveEstimateV2Inputs({
      requestOrigin: 'http://localhost:3000',
      orgId,
      userId,
      estimateId,
      body: payload as unknown as Record<string, unknown>,
      autosaveOnly: false,
    })

    const savedPayload = mocks.saveEstimateFullPersistenceTransactional.mock.calls[0]?.[0]
      ?.payload as EstimateFullPersistencePayload
    expect(savedPayload).toBeTruthy()
    expectPersistedCalculationFields(
      savedPayload.room_wall_scopes?.[0],
      artifacts.calculationArtifacts.quoteWallScopes[0] as unknown as Record<string, unknown>,
      [
        'raw_area_sf',
        'effective_area_sf',
        'raw_paint_hours',
        'effective_paint_hours',
        'raw_paint_gallons',
        'effective_paint_gallons',
        'raw_supply_cost',
        'effective_supply_cost',
        'raw_total',
        'effective_total',
        'condition_selections',
      ]
    )
    expectPersistedCalculationFields(
      savedPayload.room_ceiling_scopes?.[0],
      artifacts.calculationArtifacts.quoteCeilingScopes[0] as unknown as Record<string, unknown>,
      [
        'raw_area_sf',
        'effective_area_sf',
        'raw_paint_hours',
        'effective_paint_hours',
        'raw_paint_gallons',
        'effective_paint_gallons',
        'raw_supply_cost',
        'effective_supply_cost',
        'raw_total',
        'effective_total',
        'condition_selections',
      ]
    )
    expectPersistedCalculationFields(
      savedPayload.room_trim_scopes?.[0],
      artifacts.calculationArtifacts.quoteTrimScopes[0] as unknown as Record<string, unknown>,
      [
        'raw_measurement',
        'effective_measurement',
        'raw_paint_hours',
        'effective_paint_hours',
        'raw_paint_gallons',
        'effective_paint_gallons',
        'raw_supply_cost',
        'effective_supply_cost',
        'raw_total',
        'effective_total',
        'condition_selections',
      ]
    )
    expectPersistedCalculationFields(
      savedPayload.room_door_scopes?.[0],
      artifacts.calculationArtifacts.quoteDoorScopes[0] as unknown as Record<string, unknown>,
      [
        'condition_factor',
        'raw_units',
        'effective_units',
        'raw_paint_hours',
        'effective_paint_hours',
        'raw_material_cost',
        'effective_material_cost',
        'raw_supply_cost',
        'effective_supply_cost',
        'raw_total',
        'effective_total',
      ]
    )
    expectPersistedCalculationFields(
      savedPayload.drywall_repairs?.[0],
      artifacts.calculationArtifacts.drywallCalculations.scopes[0] as unknown as Record<string, unknown>,
      [
        'raw_quantity',
        'effective_quantity',
        'base_unit_rate',
        'ceiling_multiplier',
        'calculated_total',
        'raw_total',
        'effective_total',
      ]
    )
    expect(savedPayload.access_fees).toHaveLength(payload.access_fees?.length ?? 0)
    expect(savedPayload.other).toHaveLength(payload.other?.length ?? 0)
    expect(mocks.loadEstimateV2CalculationCatalogs).toHaveBeenCalledTimes(1)
  })
})
