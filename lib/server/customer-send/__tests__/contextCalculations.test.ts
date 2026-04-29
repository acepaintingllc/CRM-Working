import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveEstimateCustomerSendCalculatedData } from '../contextCalculations'
import type { EstimateCustomerSendRawResources } from '../contextTypes'

const {
  mockCalculateWalls,
  mockCalculateCeilings,
  mockCalculateTrim,
  mockCalculateDrywallRepairs,
  mockBuildEstimatePricingSummaryFromEngines,
  mockBuildTrimPaintInput,
  mockProductMap,
} = vi.hoisted(() => ({
  mockCalculateWalls: vi.fn(),
  mockCalculateCeilings: vi.fn(),
  mockCalculateTrim: vi.fn(),
  mockCalculateDrywallRepairs: vi.fn(),
  mockBuildEstimatePricingSummaryFromEngines: vi.fn(),
  mockBuildTrimPaintInput: vi.fn(),
  mockProductMap: vi.fn(),
}))

vi.mock('@/lib/estimator/walls', () => ({
  calculateWalls: mockCalculateWalls,
}))

vi.mock('@/lib/estimator/ceilings', () => ({
  calculateCeilings: mockCalculateCeilings,
}))

vi.mock('@/lib/estimator/trim', () => ({
  calculateTrim: mockCalculateTrim,
}))

vi.mock('@/lib/estimator/drywall', () => ({
  calculateDrywallRepairs: mockCalculateDrywallRepairs,
}))

vi.mock('@/lib/estimator/pricingPolicies', () => ({
  buildEstimatePricingSummaryFromEngines: mockBuildEstimatePricingSummaryFromEngines,
}))

vi.mock('@/lib/server/trimPaint', () => ({
  buildTrimPaintInput: mockBuildTrimPaintInput,
}))

vi.mock('@/lib/estimator/wallsHelpers', () => ({
  productMap: mockProductMap,
}))

const baseResources: EstimateCustomerSendRawResources = {
  settingsRow: {
    override_labor_rate: 55,
    labor_day_policy_enabled: true,
    dayhours: 8,
    rounding_increment_hours: 4,
    job_minimum_enabled: false,
    job_minimum_amount: 0,
    updated_at: null,
  },
  jobsettings: {
    override_labor_rate: 75,
    labor_day_policy_enabled: false,
    dayhours: 6,
    rounding_increment_hours: 2,
    job_minimum_enabled: true,
    job_minimum_amount: 1500,
  },
  catalogs: { products: [] },
  rooms: [{ room_id: 'room-1', length_in: 120, width_in: 144, mode: 'RECT' }],
  wallScopes: [{ room_id: 'room-1', mode: 'RECT' }],
  wallSegments: [{ id: 'wall-segment-1' }],
  ceilingScopes: [{ room_id: 'room-1', mode: 'SEG' }],
  ceilingScopeSegments: [{ id: 'ceiling-scope-segment-1' }],
  trimScopes: [{ room_id: 'room-1' }],
  estimate: {
    id: 'estimate-1',
    job_id: 'job-1',
    customer_id: 'customer-1',
    status: 'draft',
    version_name: 'Kitchen Quote',
    version_state: 'draft',
    version_kind: 'standard',
    version_sort_order: 1,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-02T00:00:00.000Z',
  },
  job: {
    id: 'job-1',
    title: 'Kitchen',
    estimate_date: '2026-04-22',
  },
  customer: {
    id: 'customer-1',
    name: 'Taylor',
    email: 'taylor@example.com',
    phone: '555-1212',
    address: '123 Main',
    street: '123 Main',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
  },
  company: {
    business_name: 'ACE Painting',
    timezone: 'America/Chicago',
    main_phone: '',
    business_email: '',
    address: '',
    website: '',
    sender_signature: '',
    logo_url: '',
  },
  quoteDefaults: {
    default_template_key: 'default',
    quote_validity_days: 90,
    terms_text: 'Standard terms',
  },
  segments: [],
  ceilingSegments: [],
  trimItems: [],
  other: [],
  publicVersions: [],
}

describe('customer send context calculations', () => {
  beforeEach(() => {
    mockCalculateWalls.mockReset()
    mockCalculateCeilings.mockReset()
    mockCalculateTrim.mockReset()
    mockCalculateDrywallRepairs.mockReset()
    mockBuildEstimatePricingSummaryFromEngines.mockReset()
    mockBuildTrimPaintInput.mockReset()
    mockProductMap.mockReset()

    mockCalculateWalls.mockReturnValue({ scopes: [{ id: 'wall-output' }] })
    mockCalculateCeilings.mockReturnValue({ scopes: [{ id: 'ceiling-output' }] })
    mockCalculateTrim.mockReturnValue({ scopes: [{ id: 'trim-output' }] })
    mockCalculateDrywallRepairs.mockReturnValue({ scopes: [{ id: 'drywall-output' }] })
    mockBuildEstimatePricingSummaryFromEngines.mockReturnValue({ finalTotal: 3200 })
    mockBuildTrimPaintInput.mockReturnValue({})
    mockProductMap.mockReturnValue({})
  })

  it('prefers job-level overrides over template defaults when calculating outputs', () => {
    const result = deriveEstimateCustomerSendCalculatedData(baseResources)

    expect(mockCalculateWalls).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: {
          labor_rate_per_hour: 75,
        },
      })
    )
    expect(mockBuildEstimatePricingSummaryFromEngines).toHaveBeenCalledWith(
      [
        { kind: 'walls', output: { scopes: [{ id: 'wall-output' }] } },
        { kind: 'ceilings', output: { scopes: [{ id: 'ceiling-output' }] } },
        { kind: 'trim', output: { scopes: [{ id: 'trim-output' }] } },
        { kind: 'drywall', output: { scopes: [{ id: 'drywall-output' }] } },
      ],
      {
        enabled: false,
        dayhours: 6,
        roundingIncrementHours: 2,
      },
      {
        enabled: true,
        amount: 1500,
      },
      expect.anything()
    )
    expect(result).toEqual({
      quoteWallScopes: [{ id: 'wall-output' }],
      quoteCeilingScopes: [{ id: 'ceiling-output' }],
      quoteTrimScopes: [{ id: 'trim-output' }],
      quoteDrywallScopes: [{ id: 'drywall-output' }],
      pricingSummary: { finalTotal: 3200 },
    })
  })

  it('degrades to null pricing summary without crashing when calculations fail', () => {
    mockCalculateWalls.mockImplementation(() => {
      throw new Error('boom')
    })

    const result = deriveEstimateCustomerSendCalculatedData(baseResources)

    expect(result).toEqual({
      quoteWallScopes: baseResources.wallScopes,
      quoteCeilingScopes: baseResources.ceilingScopes,
      quoteTrimScopes: baseResources.trimScopes,
      quoteDrywallScopes: [],
      pricingSummary: null,
    })
  })
})
