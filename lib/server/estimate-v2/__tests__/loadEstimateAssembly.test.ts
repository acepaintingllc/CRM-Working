import { describe, expect, it, vi } from 'vitest'

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
      quoteDrywallScopes: [{ id: 'drywall-scope-1' }],
      wallCalculations: { scopes: [{ id: 'wall-scope-1' }] },
      ceilingCalculations: { scopes: [{ id: 'ceiling-scope-1' }] },
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
      ['estimate_ceiling_segments', createOrderedQuery({ data: [{ id: 'ceiling-segment-1' }], error: null }, 1)],
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

    let estimateSegmentsCalls = 0
    mocks.supabaseFrom.mockImplementation((relation: string) => {
      if (relation === 'estimate_segments') {
        estimateSegmentsCalls += 1
        return estimateSegmentsCalls === 1
          ? createOrderedQuery({ data: [{ id: 'segment-1' }], error: null }, 1)
          : createOrderedQuery({ data: [{ id: 'wall-segment-1' }], error: null }, 2)
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
    expect(mocks.buildEstimateGetResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        estimate,
        inputs: expect.objectContaining({
          paint_products: [{ id: 'paint-1', label: 'Wall White' }],
          room_wall_scopes: [{ id: 'wall-scope-1' }],
          room_ceiling_scopes: [{ id: 'ceiling-scope-1' }],
          room_trim_scopes: [{ id: 'trim-scope-1' }],
          room_door_scopes: [{ id: 'door-scope-1' }],
          drywall_repairs: [{ id: 'drywall-repair-raw' }],
          access_fees: [
            expect.objectContaining({
              id: 'fee-1',
              label: 'Tall ladder',
              effective_total: 150,
            }),
          ],
          other: [
            expect.objectContaining({
              id: 'other-1',
              effective_total: 85,
              pricing_mode: 'fixed',
            }),
          ],
          rollers: [{ id: 'roller-1' }, { id: 'applicator-1', scope: 'Trim' }],
        }),
        drywall_calculations: { scopes: [{ id: 'drywall-scope-1' }] },
        pricing_summary: { final_total: 1200 },
      })
    )
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
})
