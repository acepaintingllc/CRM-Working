import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildEstimateGetResponse: vi.fn(),
  getEstimate: vi.fn(),
  loadCalculatedEstimateV2Artifacts: vi.fn(),
  loadEstimateTemplateSettings: vi.fn(),
  supabaseFrom: vi.fn(),
}))

vi.mock('../../org.ts', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

vi.mock('../../estimateGetResponse.ts', () => ({
  buildEstimateGetResponse: mocks.buildEstimateGetResponse,
}))

vi.mock('../../estimateTemplateSettings.ts', () => ({
  loadEstimateTemplateSettings: mocks.loadEstimateTemplateSettings,
}))

vi.mock('../calculationOrchestration.ts', () => ({
  loadCalculatedEstimateV2Artifacts: mocks.loadCalculatedEstimateV2Artifacts,
}))

vi.mock('../shared.ts', async () => {
  const actual = await vi.importActual<typeof import('../shared.ts')>('../shared.ts')
  return {
    ...actual,
    getEstimate: mocks.getEstimate,
  }
})

import { loadEstimateV2Response } from '../loadEstimateAssembly.ts'

function createOrderedQuery(result: unknown, orderCalls = 1) {
  const chain = {
    eq: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(),
  }
  chain.eq.mockReturnValue(chain)
  chain.is.mockReturnValue(chain)
  chain.not.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.order.mockImplementation(() => {
    if (chain.order.mock.calls.length >= orderCalls) {
      return Promise.resolve(result)
    }
    return chain
  })
  return chain
}

describe('loadEstimateV2Response', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

  it('assembles the extracted load service response from repository and calculation seams', async () => {
    const estimate = { id: 'estimate-1', job_id: 'job-1' }
    mocks.getEstimate.mockResolvedValue({ estimate })
    mocks.loadEstimateTemplateSettings.mockRejectedValue(new Error('missing defaults'))
    mocks.loadCalculatedEstimateV2Artifacts.mockResolvedValue({
      calculationCatalogs: {
        wall: {
          paint_products: [{ id: 'paint-1', label: 'Wall White' }],
        },
      },
      quoteWallScopes: [{ id: 'wall-scope-1' }],
      quoteCeilingScopes: [{ id: 'ceiling-scope-1' }],
      quoteTrimScopes: [{ id: 'trim-scope-1' }],
      quoteDoorScopes: [{ id: 'door-scope-1' }],
      wallCalculations: {
        scopes: [{ id: 'wall-scope-1' }],
        segments: [{ id: 'wall-segment-calculated' }],
      },
      ceilingCalculations: {
        scopes: [{ id: 'ceiling-scope-1' }],
        segments: [{ id: 'ceiling-scope-segment-calculated' }],
      },
      trimCalculations: { scopes: [{ id: 'trim-scope-1' }] },
      doorCalculations: { scopes: [{ id: 'door-scope-1' }] },
      drywallCalculations: { scopes: [{ id: 'drywall-scope-1' }] },
      otherCalculations: {
        scopes: [
          {
            id: 'other-1',
            effective_total: 85,
            pricing_mode: 'fixed',
          },
        ],
      },
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
      trimPaintInput: { gallons: 1.25 },
      pricingSummary: { final_total: 1200 },
    })
    mocks.buildEstimateGetResponse.mockReturnValue({ data: 'assembled-response' })

    const queryMap = new Map<string, ReturnType<typeof createOrderedQuery>>([
      ['estimate_jobsettings', createOrderedQuery({ data: { labor_day_policy_enabled: true }, error: null }, 0)],
      ['estimate_rooms', createOrderedQuery({ data: [{ room_id: 'R001' }], error: null }, 1)],
      ['estimate_room_wall_scopes', createOrderedQuery({ data: [{ id: 'wall-scope-raw' }], error: null }, 2)],
      ['estimate_room_ceiling_scopes', createOrderedQuery({ data: [{ id: 'ceiling-scope-raw' }], error: null }, 2)],
      ['estimate_room_ceiling_scope_segments', createOrderedQuery({ data: [{ id: 'ceiling-scope-segment-1' }], error: null }, 2)],
      ['estimate_room_trim_scopes', createOrderedQuery({ data: [{ id: 'trim-scope-raw' }], error: null }, 2)],
      ['estimate_room_door_scopes', createOrderedQuery({ data: [{ id: 'door-scope-raw' }], error: null }, 2)],
      ['estimate_drywall_repairs', createOrderedQuery({ data: [{ id: 'drywall-repair-raw' }], error: null }, 2)],
      ['estimate_rollers', createOrderedQuery({ data: [{ id: 'roller-1' }, { id: 'applicator-1', scope: 'Trim' }], error: null }, 1)],
      ['estimate_prejob', createOrderedQuery({ data: [{ id: 'prejob-1' }], error: null }, 1)],
      ['estimate_trim_items', createOrderedQuery({ data: [{ id: 'trim-item-1' }], error: null }, 1)],
      ['estimate_job_colors', createOrderedQuery({ data: [{ id: 'color-1' }], error: null }, 1)],
      ['estimate_room_flags', createOrderedQuery({ data: [{ id: 'flag-1' }], error: null }, 1)],
      ['estimate_access_fees', createOrderedQuery({ data: [{ id: 'fee-1' }], error: null }, 1)],
      ['estimate_other', createOrderedQuery({ data: [{ id: 'other-1' }], error: null }, 1)],
    ])

    mocks.supabaseFrom.mockImplementation((relation: string) => {
      if (relation === 'estimate_segments') {
        return createOrderedQuery({ data: [{ id: 'wall-segment-1' }], error: null }, 2)
      }

      const query = queryMap.get(relation)
      if (!query) {
        throw new Error(`Unexpected relation ${relation}`)
      }
      return query
    })

    await expect(
      loadEstimateV2Response({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
      })
    ).resolves.toEqual({ data: 'assembled-response' })

    expect(mocks.loadCalculatedEstimateV2Artifacts).toHaveBeenCalledWith({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      jobsettings: { labor_day_policy_enabled: true },
      rooms: [{ room_id: 'R001' }],
      roomWallScopes: [{ id: 'wall-scope-raw' }],
      wallSegments: [{ id: 'wall-segment-1' }],
      roomCeilingScopes: [{ id: 'ceiling-scope-raw' }],
      ceilingScopeSegments: [{ id: 'ceiling-scope-segment-1' }],
      roomTrimScopes: [{ id: 'trim-scope-raw' }],
      roomDoorScopes: [{ id: 'door-scope-raw' }],
      drywallRepairs: [{ id: 'drywall-repair-raw' }],
      accessFees: [{ id: 'fee-1' }],
      other: [{ id: 'other-1' }],
      orgDefaults: null,
    })
    expect(mocks.loadEstimateTemplateSettings).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
    })
    expect(mocks.buildEstimateGetResponse).toHaveBeenCalledWith({
      estimate,
      inputs: {
        jobsettings: { labor_day_policy_enabled: true },
        org_defaults: null,
        paint_products: [{ id: 'paint-1', label: 'Wall White' }],
        rooms: [{ room_id: 'R001' }],
        room_wall_scopes: [{ id: 'wall-scope-1' }],
        wall_segments: [{ id: 'wall-segment-calculated' }],
        room_ceiling_scopes: [{ id: 'ceiling-scope-1' }],
        ceiling_scope_segments: [{ id: 'ceiling-scope-segment-calculated' }],
        room_trim_scopes: [{ id: 'trim-scope-1' }],
        room_door_scopes: [{ id: 'door-scope-1' }],
        drywall_repairs: [{ id: 'drywall-scope-1' }],
        rollers: [{ id: 'roller-1' }, { id: 'applicator-1', scope: 'Trim' }],
        prejob: [{ id: 'prejob-1' }],
        trim_items: [{ id: 'trim-item-1' }],
        job_colors: [{ id: 'color-1' }],
        room_flags: [{ id: 'flag-1' }],
        access_fees: [
          {
            id: 'fee-1',
            label: 'Tall ladder',
            access_group: 'ladders',
            catalog_amount: 75,
            calculated_total: 150,
            effective_total: 150,
            overridden: false,
          },
        ],
        other: [
          {
            id: 'other-1',
            effective_total: 85,
            pricing_mode: 'fixed',
          },
        ],
      },
      wall_calculations: {
        scopes: [{ id: 'wall-scope-1' }],
        segments: [{ id: 'wall-segment-calculated' }],
      },
      ceiling_calculations: {
        scopes: [{ id: 'ceiling-scope-1' }],
        segments: [{ id: 'ceiling-scope-segment-calculated' }],
      },
      trim_calculations: { scopes: [{ id: 'trim-scope-1' }] },
      door_calculations: { scopes: [{ id: 'door-scope-1' }] },
      drywall_calculations: { scopes: [{ id: 'drywall-scope-1' }] },
      trim_paint: { gallons: 1.25 },
      pricing_summary: { final_total: 1200 },
    })
    expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('estimate_ceiling_segments')
    expect(
      mocks.supabaseFrom.mock.calls.filter(([relation]) => relation === 'estimate_segments')
    ).toHaveLength(1)
  })

  it('maps missing estimates to a 404 route-service error', async () => {
    mocks.getEstimate.mockResolvedValue({ error: 'Quote not found' })

    await expect(
      loadEstimateV2Response({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'missing-estimate',
      })
    ).rejects.toMatchObject({
      message: 'Quote not found',
      status: 404,
    })
  })

  it('prevents silent corruption on read: rejects hybrid partial-write state instead of assembling a valid estimate', async () => {
    const estimate = { id: 'estimate-1', job_id: 'job-1' }
    mocks.getEstimate.mockResolvedValue({ estimate })

    const queryMap = new Map<string, ReturnType<typeof createOrderedQuery>>([
      ['estimate_jobsettings', createOrderedQuery({ data: { labor_day_policy_enabled: true }, error: null }, 0)],
      ['estimate_rooms', createOrderedQuery({ data: [{ room_id: 'R001' }], error: null }, 1)],
      [
        'estimate_room_wall_scopes',
        createOrderedQuery(
          {
            data: [{ id: 'wall-scope-orphan', room_id: 'R999' }],
            error: null,
          },
          2
        ),
      ],
      ['estimate_room_ceiling_scopes', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_room_ceiling_scope_segments', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_room_trim_scopes', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_room_door_scopes', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_drywall_repairs', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_rollers', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_prejob', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_trim_items', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_job_colors', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_room_flags', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_access_fees', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_other', createOrderedQuery({ data: [], error: null }, 1)],
    ])

    mocks.supabaseFrom.mockImplementation((relation: string) => {
      if (relation === 'estimate_segments') {
        return createOrderedQuery({ data: [], error: null }, 2)
      }

      const query = queryMap.get(relation)
      if (!query) {
        throw new Error(`Unexpected relation ${relation}`)
      }
      return query
    })

    // This mirrors the hybrid state the save-path regression documents: a changed room roster is
    // visible, but active wall scope rows still point at a room that no longer exists.
    await expect(
      loadEstimateV2Response({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('partial/corrupt estimate state'),
      status: 409,
    })

    expect(mocks.loadCalculatedEstimateV2Artifacts).not.toHaveBeenCalled()
    expect(mocks.buildEstimateGetResponse).not.toHaveBeenCalled()
  })

  it('rejects legacy delete-then-insert corruption when rooms are gone but active children remain', async () => {
    const estimate = { id: 'estimate-1', job_id: 'job-1' }
    mocks.getEstimate.mockResolvedValue({ estimate })

    const queryMap = new Map<string, ReturnType<typeof createOrderedQuery>>([
      ['estimate_jobsettings', createOrderedQuery({ data: { labor_day_policy_enabled: true }, error: null }, 0)],
      ['estimate_rooms', createOrderedQuery({ data: [], error: null }, 1)],
      [
        'estimate_room_wall_scopes',
        createOrderedQuery(
          {
            data: [{ id: 'wall-scope-stale', room_id: 'R001' }],
            error: null,
          },
          2
        ),
      ],
      ['estimate_room_ceiling_scopes', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_room_ceiling_scope_segments', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_room_trim_scopes', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_room_door_scopes', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_drywall_repairs', createOrderedQuery({ data: [], error: null }, 2)],
      ['estimate_rollers', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_prejob', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_trim_items', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_job_colors', createOrderedQuery({ data: [], error: null }, 1)],
      [
        'estimate_room_flags',
        createOrderedQuery(
          {
            data: [{ id: 'room-flag-stale', room_id: 'R001', flag_id: 'HIGH' }],
            error: null,
          },
          1
        ),
      ],
      ['estimate_access_fees', createOrderedQuery({ data: [], error: null }, 1)],
      ['estimate_other', createOrderedQuery({ data: [], error: null }, 1)],
    ])

    mocks.supabaseFrom.mockImplementation((relation: string) => {
      if (relation === 'estimate_segments') {
        return createOrderedQuery({ data: [], error: null }, 2)
      }

      const query = queryMap.get(relation)
      if (!query) {
        throw new Error(`Unexpected relation ${relation}`)
      }
      return query
    })

    await expect(
      loadEstimateV2Response({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('partial/corrupt estimate state'),
      status: 409,
    })

    expect(mocks.loadCalculatedEstimateV2Artifacts).not.toHaveBeenCalled()
    expect(mocks.buildEstimateGetResponse).not.toHaveBeenCalled()
  })
})
