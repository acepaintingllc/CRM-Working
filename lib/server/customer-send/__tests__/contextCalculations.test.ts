import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveEstimateCustomerSendCalculatedData } from '../contextCalculations'
import type { EstimateCustomerSendRawResources } from '../contextTypes'

const { mockLoadCalculatedEstimateV2Artifacts } = vi.hoisted(() => ({
  mockLoadCalculatedEstimateV2Artifacts: vi.fn(),
}))

vi.mock('@/lib/server/estimate-v2/calculationOrchestration', () => ({
  loadCalculatedEstimateV2Artifacts: mockLoadCalculatedEstimateV2Artifacts,
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
  rollupFinalTotal: 1044,
  catalogs: { products: [] },
  rooms: [{ room_id: 'room-1', length_in: 120, width_in: 144, mode: 'RECT' }],
  wallScopes: [{ id: 'wall-raw', room_id: 'room-1', mode: 'RECT' }],
  wallSegments: [{ id: 'wall-segment-1' }],
  ceilingSegments: [{ id: 'ceiling-segment-1' }],
  ceilingScopes: [{ id: 'ceiling-raw', room_id: 'room-1', mode: 'SEG' }],
  ceilingScopeSegments: [{ id: 'ceiling-scope-segment-1' }],
  trimScopes: [{ id: 'trim-raw', room_id: 'room-1' }],
  doorScopes: [{ id: 'door-raw', room_id: 'room-1' }],
  drywallRepairs: [{ id: 'drywall-raw', room_id: 'room-1' }],
  accessFees: [{ id: 'fee-1', access_fee_id: 'LADDER', qty: 2 }],
  trimItems: [],
  other: [{ id: 'other-1', client_description: 'Additional prep' }],
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
  publicVersions: [],
}

describe('customer send context calculations', () => {
  beforeEach(() => {
    mockLoadCalculatedEstimateV2Artifacts.mockReset()
    mockLoadCalculatedEstimateV2Artifacts.mockResolvedValue({
      quoteWallScopes: [{ id: 'wall-output' }],
      quoteCeilingScopes: [{ id: 'ceiling-output' }],
      quoteTrimScopes: [{ id: 'trim-output' }],
      quoteDoorScopes: [{ id: 'door-output' }],
      drywallCalculations: { scopes: [{ id: 'drywall-output' }] },
      accessFeeCalculation: {
        rows: [
          {
            id: 'fee-1',
            label: 'Tall ladder',
            group: 'ladders',
            catalogAmount: 75,
            calculatedTotal: 150,
            total: 150,
            overridden: false,
          },
        ],
      },
      otherCalculations: {
        scopes: [{ id: 'other-1', effective_total: 85, pricing_mode: 'fixed' }],
      },
      pricingSummary: { finalTotal: 3200 },
    })
  })

  it('uses the canonical V2 calculation pipeline for customer quote outputs', async () => {
    const result = await deriveEstimateCustomerSendCalculatedData(baseResources, {
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(mockLoadCalculatedEstimateV2Artifacts).toHaveBeenCalledWith({
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      jobsettings: baseResources.jobsettings,
      rooms: baseResources.rooms,
      roomWallScopes: baseResources.wallScopes,
      wallSegments: baseResources.wallSegments,
      roomCeilingScopes: baseResources.ceilingScopes,
      ceilingScopeSegments: baseResources.ceilingScopeSegments,
      roomTrimScopes: baseResources.trimScopes,
      roomDoorScopes: baseResources.doorScopes,
      drywallRepairs: baseResources.drywallRepairs,
      accessFees: baseResources.accessFees,
      other: baseResources.other,
      orgDefaults: baseResources.settingsRow,
    })
    expect(result).toEqual({
      quoteWallScopes: [{ id: 'wall-output' }],
      quoteCeilingScopes: [{ id: 'ceiling-output' }],
      quoteTrimScopes: [{ id: 'trim-output' }],
      quoteDoorScopes: [{ id: 'door-output' }],
      quoteDrywallScopes: [{ id: 'drywall-output' }],
      quoteAccessFees: [
        expect.objectContaining({
          id: 'fee-1',
          label: 'Tall ladder',
          effective_total: 150,
        }),
      ],
      quoteOtherRows: [
        expect.objectContaining({
          id: 'other-1',
          effective_total: 85,
        }),
      ],
      pricingSummary: { finalTotal: 3200 },
    })
  })

  it('degrades to raw rows and null pricing summary without crashing when calculations fail', async () => {
    mockLoadCalculatedEstimateV2Artifacts.mockRejectedValue(new Error('boom'))

    const result = await deriveEstimateCustomerSendCalculatedData(baseResources, {
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result).toEqual({
      quoteWallScopes: baseResources.wallScopes,
      quoteCeilingScopes: baseResources.ceilingScopes,
      quoteTrimScopes: baseResources.trimScopes,
      quoteDoorScopes: baseResources.doorScopes,
      quoteDrywallScopes: baseResources.drywallRepairs,
      quoteAccessFees: baseResources.accessFees,
      quoteOtherRows: baseResources.other,
      pricingSummary: null,
    })
  })
})
