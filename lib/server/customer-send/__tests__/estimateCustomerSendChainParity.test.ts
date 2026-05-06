import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildEstimateChainParityArtifacts,
  buildEstimateChainParityDbRows,
  createEstimateChainParitySupabaseStub,
  ESTIMATE_CHAIN_PARITY_SCENARIOS,
  expectSameCustomerTotal,
  type EstimateChainParityDbRows,
} from '../../estimate-v2/__tests__/estimateChainParityHelpers'
import type { ServiceResult } from '@/lib/server/serviceResult'

const mocks = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  loadCompanyProfileSettings: vi.fn(),
  loadQuoteSendDefaults: vi.fn(),
  getEstimateCatalogs: vi.fn(),
  loadEstimateTemplateSettings: vi.fn(),
  loadCalculatedEstimateV2Artifacts: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

vi.mock('@/lib/server/settings/companyProfileStore', () => ({
  loadCompanyProfileSettings: mocks.loadCompanyProfileSettings,
}))

vi.mock('@/lib/server/settings/quoteSendDefaultsStore', () => ({
  loadQuoteSendDefaults: mocks.loadQuoteSendDefaults,
}))

vi.mock('@/lib/server/estimateCatalogs', () => ({
  getEstimateCatalogs: mocks.getEstimateCatalogs,
}))

vi.mock('@/lib/server/estimateTemplateSettings', () => ({
  loadEstimateTemplateSettings: mocks.loadEstimateTemplateSettings,
}))

vi.mock('@/lib/server/estimate-v2/calculationOrchestration', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/estimate-v2/calculationOrchestration')>()
  return {
    ...actual,
    loadCalculatedEstimateV2Artifacts: mocks.loadCalculatedEstimateV2Artifacts,
  }
})

import { buildEstimatePublicSnapshotFromVersion } from '@/lib/customer-estimates/publicSnapshot'
import { buildCustomerSendPageData } from '../service'
import { deriveEstimateCustomerSendCalculatedData } from '../contextCalculations'
import { buildEstimateCustomerSendContext } from '../contextMapper'
import { loadEstimateCustomerSendResources } from '../contextLoader'
import type {
  CustomerSendPageData,
  EstimateCustomerSendRawResources,
} from '../types'

function assertOk<T>(
  result: ServiceResult<T>,
  label: string
): asserts result is { ok: true; data: T } {
  if (!result.ok) {
    throw new Error(`${label}: ${result.message}`)
  }
}

function assertResources(
  resources: EstimateCustomerSendRawResources | { error: string }
): asserts resources is EstimateCustomerSendRawResources {
  if ('error' in resources) {
    throw new Error(resources.error)
  }
}

function roundedCustomerTotal(value: number | null | undefined) {
  return Math.round(value ?? 0)
}

function savedLoadTotal(rows: EstimateChainParityDbRows) {
  const total = rows.estimate_version_rollups.final_total
  return typeof total === 'number' && Number.isFinite(total) ? total : null
}

function setupSendResourceMocks(rows: EstimateChainParityDbRows) {
  const supabase = createEstimateChainParitySupabaseStub(rows)
  const from = supabase.from as unknown as (table: string) => unknown
  mocks.supabaseFrom.mockImplementation((table: string) => from(table))
  mocks.loadCompanyProfileSettings.mockResolvedValue({
    business_name: 'ACE Painting',
    timezone: 'America/Chicago',
    main_phone: '555-0100',
    business_email: 'office@example.test',
    address: '10 Paint Way',
    website: '',
    sender_signature: '',
    logo_url: '',
  })
  mocks.loadQuoteSendDefaults.mockResolvedValue({
    default_template_key: 'default',
    quote_validity_days: 30,
    terms_text: 'Standard quote terms.',
  })
  mocks.getEstimateCatalogs.mockResolvedValue({
    catalogs: rows.estimate_public_versions[0]?.snapshot ?? null,
  })
  mocks.loadEstimateTemplateSettings.mockResolvedValue({
    updated_at: '2026-05-05T12:00:00.000Z',
  })
  return supabase
}

async function buildSendPageFromSavedRows(params: {
  scenario: keyof typeof ESTIMATE_CHAIN_PARITY_SCENARIOS
}) {
  const artifacts = buildEstimateChainParityArtifacts(params.scenario)
  const rows = buildEstimateChainParityDbRows(artifacts)
  const supabase = setupSendResourceMocks(rows)
  mocks.loadCalculatedEstimateV2Artifacts.mockResolvedValue({
    quoteWallScopes: artifacts.calculationArtifacts.quoteWallScopes,
    quoteCeilingScopes: artifacts.calculationArtifacts.quoteCeilingScopes,
    quoteTrimScopes: artifacts.calculationArtifacts.quoteTrimScopes,
    quoteDoorScopes: artifacts.calculationArtifacts.quoteDoorScopes,
    drywallCalculations: artifacts.calculationArtifacts.drywallCalculations,
    accessFeeCalculation: artifacts.calculationArtifacts.accessFeeCalculation,
    otherCalculations: artifacts.calculationArtifacts.otherCalculations,
    pricingSummary: artifacts.calculationArtifacts.pricingSummary,
  })

  const resources = await loadEstimateCustomerSendResources({
    origin: 'https://example.test',
    orgId: String(rows.estimates.org_id),
    userId: 'user-send-chain',
    estimateId: String(rows.estimates.id),
  })
  assertResources(resources)

  const calculated = await deriveEstimateCustomerSendCalculatedData(resources, {
    requestOrigin: 'https://example.test',
    orgId: String(rows.estimates.org_id),
    userId: 'user-send-chain',
    estimateId: String(rows.estimates.id),
  })
  const context = buildEstimateCustomerSendContext({
    origin: 'https://example.test',
    resources,
    calculated,
  })
  const pageResult = buildCustomerSendPageData({
    origin: 'https://example.test',
    context,
  })
  assertOk<CustomerSendPageData>(pageResult, 'send page data')

  return {
    artifacts,
    rows,
    supabase,
    resources,
    calculated,
    context,
    pageData: pageResult.data,
  }
}

describe('estimate customer-send public snapshot total parity', () => {
  beforeEach(() => {
    for (const mock of [
      mocks.supabaseFrom,
      mocks.loadCompanyProfileSettings,
      mocks.loadQuoteSendDefaults,
      mocks.getEstimateCatalogs,
      mocks.loadEstimateTemplateSettings,
      mocks.loadCalculatedEstimateV2Artifacts,
    ]) {
      mock.mockReset()
    }
  })

  for (const scenario of Object.keys(ESTIMATE_CHAIN_PARITY_SCENARIOS) as Array<
    keyof typeof ESTIMATE_CHAIN_PARITY_SCENARIOS
  >) {
    it(`keeps send context and public snapshot totals frozen for ${scenario}`, async () => {
      const { rows, supabase, context, pageData } = await buildSendPageFromSavedRows({
        scenario,
      })
      const expected = savedLoadTotal(rows)
      const roundedExpected = roundedCustomerTotal(expected)

      expectSameCustomerTotal({
        scenario,
        hop: 'send-context',
        expected,
        actual: context.pricing_summary?.finalTotal,
      })
      expect(pageData.document.total, `scenario=${scenario} hop=send-document`).toBe(
        roundedExpected
      )

      supabase.assertAllExpectedTablesUsed()
      mocks.supabaseFrom.mockClear()
      mocks.loadCalculatedEstimateV2Artifacts.mockClear()

      const publicVersion = {
        ...rows.estimate_public_versions[0],
        id: `${rows.estimates.id}-public-snapshot`,
        estimate_id: rows.estimates.id,
        version_number: 2,
        status: 'sent',
        public_token: `${scenario}-token`,
        snapshot_json: {
          document: pageData.document,
          draft: pageData.draft,
        },
      }
      const publicSnapshot = buildEstimatePublicSnapshotFromVersion({
        version: publicVersion,
        origin: 'https://example.test',
      })

      if ('error' in publicSnapshot) throw new Error(publicSnapshot.error)
      expect(publicSnapshot.document.total).toBe(pageData.document.total)
      expect(mocks.loadCalculatedEstimateV2Artifacts).not.toHaveBeenCalled()
      expect(mocks.supabaseFrom).not.toHaveBeenCalled()
    })
  }

  it('does not let dirty unsaved editor state leak into send context', async () => {
    const scenario = 'full-room-quote'
    const artifacts = buildEstimateChainParityArtifacts(scenario)
    const rows = buildEstimateChainParityDbRows(artifacts)
    const savedTotal = savedLoadTotal(rows) ?? 0
    const dirtyTotal = roundedCustomerTotal(savedTotal) + 777
    const dirtyEditorPayload = {
      ...artifacts.payload,
      jobsettings: {
        ...artifacts.payload.jobsettings,
        job_minimum_enabled: true,
        job_minimum_amount: dirtyTotal,
      },
    }
    expect(dirtyEditorPayload.jobsettings.job_minimum_amount).toBe(dirtyTotal)

    const supabase = setupSendResourceMocks(rows)
    mocks.loadCalculatedEstimateV2Artifacts.mockResolvedValue({
      quoteWallScopes: artifacts.calculationArtifacts.quoteWallScopes,
      quoteCeilingScopes: artifacts.calculationArtifacts.quoteCeilingScopes,
      quoteTrimScopes: artifacts.calculationArtifacts.quoteTrimScopes,
      quoteDoorScopes: artifacts.calculationArtifacts.quoteDoorScopes,
      drywallCalculations: artifacts.calculationArtifacts.drywallCalculations,
      accessFeeCalculation: artifacts.calculationArtifacts.accessFeeCalculation,
      otherCalculations: artifacts.calculationArtifacts.otherCalculations,
      pricingSummary: artifacts.calculationArtifacts.pricingSummary,
    })

    const resources = await loadEstimateCustomerSendResources({
      origin: 'https://example.test',
      orgId: String(rows.estimates.org_id),
      userId: 'user-send-chain',
      estimateId: String(rows.estimates.id),
    })
    assertResources(resources)
    expect(resources.jobsettings).toEqual(rows.estimate_jobsettings)
    expect(resources.jobsettings.job_minimum_amount).not.toBe(dirtyTotal)

    const calculated = await deriveEstimateCustomerSendCalculatedData(resources, {
      requestOrigin: 'https://example.test',
      orgId: String(rows.estimates.org_id),
      userId: 'user-send-chain',
      estimateId: String(rows.estimates.id),
    })
    const context = buildEstimateCustomerSendContext({
      origin: 'https://example.test',
      resources,
      calculated,
    })
    const pageResult = buildCustomerSendPageData({
      origin: 'https://example.test',
      context,
    })
    assertOk<CustomerSendPageData>(pageResult, 'send page data')

    try {
      expect(context.pricing_summary?.finalTotal).toBeCloseTo(savedTotal, 2)
      expect(pageResult.data.document.total).toBe(roundedCustomerTotal(savedTotal))
      expect(context.pricing_summary?.finalTotal).not.toBe(dirtyTotal)
      expect(pageResult.data.document.total).not.toBe(dirtyTotal)
    } catch (error) {
      throw new Error(
        `scenario=full-room-quote hop=send-context dirty-editor-leak expected=${savedTotal} actual=${dirtyTotal}`,
        { cause: error }
      )
    }

    supabase.assertAllExpectedTablesUsed()
  })
})
