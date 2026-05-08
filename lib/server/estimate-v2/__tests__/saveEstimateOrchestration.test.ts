import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildV2CeilingScopeRows: vi.fn(),
  buildV2CeilingSegmentRows: vi.fn(),
  buildV2DoorScopeRows: vi.fn(),
  buildV2RoomRosterRows: vi.fn(),
  buildV2TrimScopeRows: vi.fn(),
  buildV2WallScopeRows: vi.fn(),
  buildV2WallSegmentRows: vi.fn(),
  calculateEstimateV2ArtifactsForSave: vi.fn(),
  createCalculationCatalogsLoader: vi.fn(),
  getEstimate: vi.fn(),
  isMissingFullEstimateSaveRpc: vi.fn(),
  loadEstimateTemplateSettings: vi.fn(),
  loadEstimateV2Response: vi.fn(),
  saveEstimateFullPersistenceTransactional: vi.fn(),
  buildV2RoomPersistenceRow: vi.fn(),
  supabaseFrom: vi.fn(),
}))

vi.mock('../../org.ts', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

vi.mock('../../estimateV2RoutePayload.ts', () => ({
  buildV2CeilingScopeRows: mocks.buildV2CeilingScopeRows,
  buildV2CeilingSegmentRows: mocks.buildV2CeilingSegmentRows,
  buildV2DoorScopeRows: mocks.buildV2DoorScopeRows,
  buildV2RoomRosterRows: mocks.buildV2RoomRosterRows,
  buildV2TrimScopeRows: mocks.buildV2TrimScopeRows,
  buildV2WallScopeRows: mocks.buildV2WallScopeRows,
  buildV2WallSegmentRows: mocks.buildV2WallSegmentRows,
}))

vi.mock('../../estimateTemplateSettings.ts', () => ({
  loadEstimateTemplateSettings: mocks.loadEstimateTemplateSettings,
}))

vi.mock('../calculationOrchestration.ts', () => ({
  calculateEstimateV2ArtifactsForSave: mocks.calculateEstimateV2ArtifactsForSave,
  createCalculationCatalogsLoader: mocks.createCalculationCatalogsLoader,
}))

vi.mock('../loadEstimateAssembly.ts', () => ({
  loadEstimateV2Response: mocks.loadEstimateV2Response,
}))

vi.mock('../roomPersistence.ts', () => ({
  buildV2RoomPersistenceRow: mocks.buildV2RoomPersistenceRow,
}))

vi.mock('../scopeRowPersistence.ts', () => ({
  isMissingFullEstimateSaveRpc: mocks.isMissingFullEstimateSaveRpc,
  saveEstimateFullPersistenceTransactional: mocks.saveEstimateFullPersistenceTransactional,
}))

vi.mock('../shared.ts', async () => {
  const actual = await vi.importActual<typeof import('../shared.ts')>('../shared.ts')
  return {
    ...actual,
    getEstimate: mocks.getEstimate,
  }
})

import { saveEstimateV2Inputs } from '../saveEstimateOrchestration.ts'

const savedEstimate = {
  id: 'estimate-1',
  org_id: 'org-1',
  job_id: 'job-1',
  customer_id: null,
  status: 'draft',
  version_name: 'Draft',
  version_state: 'Draft',
  version_kind: null,
  version_sort_order: null,
  setting_set_id_used: null,
  created_at: '2026-05-03T22:55:00.000Z',
  updated_at: '2026-05-04T15:30:00.000Z',
}

function createSupabaseChain(result: { data?: unknown; error?: { message: string } | null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
  }
  return chain
}

function buildCanonicalSaveArtifacts(overrides: Record<string, unknown> = {}) {
  return {
    quoteWallScopes: [],
    wallCalculations: { scopes: [], segments: [] },
    quoteCeilingScopes: [],
    ceilingCalculations: { scopes: [], segments: [] },
    quoteTrimScopes: [],
    trimCalculations: { scopes: [] },
    quoteDoorScopes: [],
    doorCalculations: { scopes: [] },
    drywallCalculations: { scopes: [] },
    ...overrides,
  }
}

describe('saveEstimateV2Inputs', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.createCalculationCatalogsLoader.mockReturnValue(vi.fn())
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts())
    mocks.loadEstimateV2Response.mockResolvedValue({
      estimate: savedEstimate,
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
      inputs: {},
    })
    mocks.loadEstimateTemplateSettings.mockResolvedValue(null)
    mocks.buildV2RoomPersistenceRow.mockImplementation((row: unknown) => row)
    mocks.isMissingFullEstimateSaveRpc.mockReturnValue(false)
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === 'estimates') return createSupabaseChain({ data: savedEstimate })
      return createSupabaseChain({ data: null })
    })
  })

  it('uses the full-save RPC for collection-only writes', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          job_colors: [{ color_id: 'WHITE' }],
        },
      })
    ).resolves.toEqual({ ok: true, estimate: savedEstimate })

    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        job_colors: [
          expect.objectContaining({
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            color_id: 'WHITE',
          }),
        ],
      }),
    })
    expect(mocks.loadEstimateV2Response).not.toHaveBeenCalled()
  })

  it('always sends room saves through the V2 roster path', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        id: 'room-row-1',
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: 'BEDROOM',
        wall_complexity_id: 'WALL_STD',
        position: 0,
        notes: 'Keep legacy notes as room metadata',
        length_in: 120,
        width_in: 144,
        wallheight_in: 96,
        condition_selections: { ROOM_FURNISHED: 'active' },
      },
    ])
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          rooms: [{ room_id: 'R001', room_name: 'Living', walls_include: 'Y' }],
        },
      })
    ).resolves.toEqual({ ok: true, estimate: savedEstimate })

    expect(mocks.buildV2RoomRosterRows).toHaveBeenCalledWith([
      { room_id: 'R001', room_name: 'Living', walls_include: 'Y' },
    ])
    const payload = mocks.saveEstimateFullPersistenceTransactional.mock.calls[0]?.[0]?.payload
    expect(payload).toEqual(
      expect.objectContaining({
        room_save_mode: 'v2_roster',
        rooms: [
          expect.objectContaining({
            id: 'room-row-1',
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            room_id: 'R001',
            room_name: 'Living',
            room_type_id: 'BEDROOM',
            wall_complexity_id: 'WALL_STD',
            condition_selections: { ROOM_FURNISHED: 'active' },
          }),
        ],
      })
    )
    expect(JSON.stringify(payload)).not.toContain('legacy_replace')
  })

  it('returns pricing summary totals for a saved job-level access fee', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.loadEstimateV2Response.mockResolvedValue({
      estimate: savedEstimate,
      inputs: {
        access_fees: [
          {
            id: 'access-fee-1',
            access_fee_id: 'LADDER-TALL',
            effective_total: 125,
          },
        ],
      },
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: { finalTotal: 125, sharedAccessCost: 125 },
    })
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          access_fees: [
            {
              id: 'access-fee-1',
              room_id: null,
              access_fee_id: ' ladder-tall ',
              qty: '',
              notes: '',
              actual_cost_override: '125',
            },
            {
              id: 'blank-access-fee',
              room_id: null,
              access_fee_id: ' ',
            },
          ],
        },
      })
    ).resolves.toEqual({
      ok: true,
      estimate: savedEstimate,
      inputs: {
        access_fees: [
          {
            id: 'access-fee-1',
            access_fee_id: 'LADDER-TALL',
            effective_total: 125,
          },
        ],
      },
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: { finalTotal: 125, sharedAccessCost: 125 },
    })

    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        access_fees: [
          expect.objectContaining({
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            position: 0,
            room_id: null,
            access_fee_id: 'LADDER-TALL',
            qty: 1,
            notes: null,
            actual_cost_override: 125,
          }),
        ],
      }),
    })
    expect(mocks.calculateEstimateV2ArtifactsForSave).toHaveBeenCalledWith(
      expect.objectContaining({
        roomRows: [],
        wallScopeRows: [],
        wallSegmentRows: [],
        ceilingScopeRows: [],
        ceilingSegmentRows: [],
        trimScopeRows: [],
        doorScopeRows: [],
        drywallRepairRows: [],
        accessFeeRows: [
          expect.objectContaining({
            id: expect.stringMatching(/^access-fee-/),
            access_fee_id: 'LADDER-TALL',
            qty: 1,
            actual_cost_override: 125,
          }),
        ],
        otherRows: [],
      })
    )
    expect(mocks.loadEstimateV2Response).toHaveBeenCalledWith({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })
  })

  it('returns canonical post-save calculations for other-item-only saves', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.loadEstimateV2Response.mockResolvedValue({
      estimate: savedEstimate,
      inputs: {
        other: [{ id: 'other-1', effective_total: 225 }],
      },
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: { finalTotal: 225 },
    })
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          other: [
            {
              id: 'other-1',
              client_description: 'Cabinet touch-up',
              qty: 3,
              materials_each: 75,
            },
          ],
        },
      })
    ).resolves.toEqual({
      ok: true,
      estimate: savedEstimate,
      inputs: {
        other: [{ id: 'other-1', effective_total: 225 }],
      },
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: { finalTotal: 225 },
    })

    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        other: [
          expect.objectContaining({
            id: 'other-1',
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            client_description: 'Cabinet touch-up',
            qty: 3,
            materials_each: 75,
          }),
        ],
      }),
    })
    expect(mocks.calculateEstimateV2ArtifactsForSave).toHaveBeenCalledWith(
      expect.objectContaining({
        roomRows: [],
        wallScopeRows: [],
        wallSegmentRows: [],
        ceilingScopeRows: [],
        ceilingSegmentRows: [],
        trimScopeRows: [],
        doorScopeRows: [],
        drywallRepairRows: [],
        accessFeeRows: [],
        otherRows: [
          expect.objectContaining({
            id: 'other-1',
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            client_description: 'Cabinet touch-up',
            qty: 3,
            materials_each: 75,
          }),
        ],
      })
    )
    expect(mocks.loadEstimateV2Response).toHaveBeenCalledWith({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })
  })

  it('treats a missing full-save RPC as a real save error', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.saveEstimateFullPersistenceTransactional.mockRejectedValue(
      new Error('function public.save_estimate_v2_full_persistence does not exist')
    )
    mocks.isMissingFullEstimateSaveRpc.mockReturnValue(true)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          job_colors: [{ color_id: 'WHITE' }],
        },
      })
    ).rejects.toMatchObject({
      message: 'Full estimate save RPC is required for Estimate V2 persistence',
      status: 400,
    })
    expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('estimates')
  })

  it('fails the save when the full-save RPC throws a duplicate-key collision', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.saveEstimateFullPersistenceTransactional.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "estimate_job_colors_pkey"')
    )

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          job_colors: [{ color_id: 'WHITE' }],
        },
      })
    ).rejects.toMatchObject({
      message: 'duplicate key value violates unique constraint "estimate_job_colors_pkey"',
      status: 400,
    })

    expect(mocks.isMissingFullEstimateSaveRpc).toHaveBeenCalledWith(
      'duplicate key value violates unique constraint "estimate_job_colors_pkey"'
    )
    expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('estimates')
  })

  it('does not treat the removed legacy RPC name as a compatible full-save miss', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.saveEstimateFullPersistenceTransactional.mockRejectedValue(
      new Error('function public.save_estimate_v2_inputs does not exist')
    )

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          job_colors: [{ color_id: 'WHITE' }],
        },
      })
    ).rejects.toMatchObject({
      message: 'function public.save_estimate_v2_inputs does not exist',
      status: 400,
    })

    expect(mocks.isMissingFullEstimateSaveRpc).toHaveBeenCalledWith(
      'function public.save_estimate_v2_inputs does not exist'
    )
    expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('estimates')
  })

  it('fails without returning success when the full-save RPC errors after payload assembly', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: null,
        wall_complexity_id: null,
        position: 0,
        notes: null,
        length_in: null,
        width_in: null,
        wallheight_in: null,
        condition_selections: null,
      },
    ])
    mocks.buildV2WallScopeRows.mockReturnValue({
      scopeRows: [
        {
          id: 'wall-scope-1',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Walls',
          color_id: 'WHITE',
          paint_product_id: null,
          primer_product_id: null,
          prime_mode: 'NONE',
          height_in: 96,
          perimeter_in: 200,
          standard_door_count: 1,
          standard_window_count: 2,
          height_factor: 1,
          complexity_factor: 1,
          wall_flag_factor: 1,
          cut_in_top_factor: 1,
          cut_in_bottom_factor: 1,
          paint_coats: 2,
          primer_coats: 0,
          spot_prime_percent: 0,
          raw_area_sf: 160,
          override_area_sf: null,
          effective_area_sf: 160,
          raw_paint_hours: 2,
          override_paint_hours: null,
          effective_paint_hours: 2,
          raw_primer_hours: 0,
          override_primer_hours: null,
          effective_primer_hours: 0,
          raw_paint_gallons: 1,
          override_paint_gallons: null,
          effective_paint_gallons: 1,
          raw_primer_gallons: 0,
          override_primer_gallons: null,
          effective_primer_gallons: 0,
          raw_supply_cost: 10,
          override_supply_cost: null,
          effective_supply_cost: 10,
          raw_total: 200,
          override_total: null,
          effective_total: 200,
          notes: null,
        },
      ],
    })
    mocks.buildV2WallSegmentRows.mockReturnValue([
      {
        id: 'segment-1',
        wall_scope_id: 'wall-scope-1',
        room_id: 'R001',
        position: 0,
        segment_name: 'A',
        include: 'Y',
        shape_type: 'RECTANGLE',
        quantity: 1,
        width_in: 120,
        height_in: 96,
        base_in: null,
        manual_area_sf: null,
        raw_area_sf: 80,
        override_area_sf: null,
        effective_area_sf: 80,
        notes: null,
      },
    ])
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts({
      wallCalculations: {
        scopes: [{ id: 'wall-scope-1', total: 200 }],
        segments: [
          {
            id: 'segment-1',
            wall_scope_id: 'wall-scope-1',
            room_id: 'R001',
            position: 0,
            segment_name: 'A',
            include: 'Y',
            shape_type: 'RECTANGLE',
            quantity: 1,
            width_in: 120,
            height_in: 96,
            base_in: null,
            manual_area_sf: null,
            raw_area_sf: 80,
            override_area_sf: null,
            effective_area_sf: 80,
            notes: null,
          },
        ],
      },
      quoteWallScopes: [
        {
          id: 'wall-scope-1',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Walls',
          color_id: 'WHITE',
          paint_product_id: null,
          primer_product_id: null,
          prime_mode: 'NONE',
          height_in: 96,
          perimeter_in: 200,
          standard_door_count: 1,
          standard_window_count: 2,
          height_factor: 1,
          complexity_factor: 1,
          wall_flag_factor: 1,
          cut_in_top_factor: 1,
          cut_in_bottom_factor: 1,
          paint_coats: 2,
          primer_coats: 0,
          spot_prime_percent: 0,
          raw_area_sf: 160,
          override_area_sf: null,
          effective_area_sf: 160,
          raw_paint_hours: 2,
          override_paint_hours: null,
          effective_paint_hours: 2,
          raw_primer_hours: 0,
          override_primer_hours: null,
          effective_primer_hours: 0,
          raw_paint_gallons: 1,
          override_paint_gallons: null,
          effective_paint_gallons: 1,
          raw_primer_gallons: 0,
          override_primer_gallons: null,
          effective_primer_gallons: 0,
          raw_supply_cost: 10,
          override_supply_cost: null,
          effective_supply_cost: 10,
          raw_total: 200,
          override_total: null,
          effective_total: 200,
          notes: null,
        },
      ],
    }))
    mocks.saveEstimateFullPersistenceTransactional.mockRejectedValue(
      new Error('rpc failed after internal writes started')
    )

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          rooms: [{ room_id: 'R001', room_name: 'Living' }],
          room_wall_scopes: [{ id: 'wall-scope-1', room_id: 'R001' }],
          wall_segments: [{ id: 'segment-1', wall_scope_id: 'wall-scope-1' }],
        },
      })
    ).rejects.toMatchObject({
      message: 'rpc failed after internal writes started',
      status: 400,
    })

    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledTimes(1)
    expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('estimates')
  })

  it('uses the full-save RPC for V2 wall saves', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: null,
        wall_complexity_id: null,
        position: 0,
        notes: null,
        length_in: null,
        width_in: null,
        wallheight_in: null,
        condition_selections: null,
      },
    ])
    mocks.buildV2WallScopeRows.mockReturnValue({
      scopeRows: [
        {
          id: 'wall-scope-1',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Walls',
          color_id: 'WHITE',
          paint_product_id: null,
          primer_product_id: null,
          prime_mode: 'NONE',
          height_in: 96,
          perimeter_in: 200,
          standard_door_count: 1,
          standard_window_count: 2,
          height_factor: 1,
          complexity_factor: 1,
          wall_flag_factor: 1,
          cut_in_top_factor: 1,
          cut_in_bottom_factor: 1,
          paint_coats: 2,
          primer_coats: 0,
          spot_prime_percent: 0,
          raw_area_sf: 160,
          override_area_sf: null,
          effective_area_sf: 160,
          raw_paint_hours: 2,
          override_paint_hours: null,
          effective_paint_hours: 2,
          raw_primer_hours: 0,
          override_primer_hours: null,
          effective_primer_hours: 0,
          raw_paint_gallons: 1,
          override_paint_gallons: null,
          effective_paint_gallons: 1,
          raw_primer_gallons: 0,
          override_primer_gallons: null,
          effective_primer_gallons: 0,
          raw_supply_cost: 10,
          override_supply_cost: null,
          effective_supply_cost: 10,
          raw_total: 200,
          override_total: null,
          effective_total: 200,
          notes: null,
        },
      ],
    })
    mocks.buildV2WallSegmentRows.mockReturnValue([
      {
        id: 'segment-1',
        wall_scope_id: 'wall-scope-1',
        room_id: 'R001',
        position: 0,
        segment_name: 'A',
        include: 'Y',
        shape_type: 'RECTANGLE',
        quantity: 1,
        width_in: 120,
        height_in: 96,
        base_in: null,
        manual_area_sf: null,
        raw_area_sf: 80,
        override_area_sf: null,
        effective_area_sf: 80,
        notes: null,
      },
    ])
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts({
      wallCalculations: {
        scopes: [{ id: 'wall-scope-1', total: 200 }],
        segments: [
          {
            id: 'segment-1',
            wall_scope_id: 'wall-scope-1',
            room_id: 'R001',
            position: 0,
            segment_name: 'A',
            include: 'Y',
            shape_type: 'RECTANGLE',
            quantity: 1,
            width_in: 120,
            height_in: 96,
            base_in: null,
            manual_area_sf: null,
            raw_area_sf: 80,
            override_area_sf: null,
            effective_area_sf: 80,
            notes: null,
          },
        ],
      },
      quoteWallScopes: [
        {
          id: 'wall-scope-1',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Walls',
          color_id: 'WHITE',
          paint_product_id: null,
          primer_product_id: null,
          prime_mode: 'NONE',
          height_in: 96,
          perimeter_in: 200,
          standard_door_count: 1,
          standard_window_count: 2,
          height_factor: 1,
          complexity_factor: 1,
          wall_flag_factor: 1,
          cut_in_top_factor: 1,
          cut_in_bottom_factor: 1,
          paint_coats: 2,
          primer_coats: 0,
          spot_prime_percent: 0,
          raw_area_sf: 160,
          override_area_sf: null,
          effective_area_sf: 160,
          raw_paint_hours: 2,
          override_paint_hours: null,
          effective_paint_hours: 2,
          raw_primer_hours: 0,
          override_primer_hours: null,
          effective_primer_hours: 0,
          raw_paint_gallons: 1,
          override_paint_gallons: null,
          effective_paint_gallons: 1,
          raw_primer_gallons: 0,
          override_primer_gallons: null,
          effective_primer_gallons: 0,
          raw_supply_cost: 10,
          override_supply_cost: null,
          effective_supply_cost: 10,
          raw_total: 200,
          override_total: null,
          effective_total: 200,
          notes: null,
        },
      ],
    }))
    mocks.loadEstimateV2Response.mockResolvedValue({
      estimate: savedEstimate,
      inputs: {},
      wall_calculations: { scopes: [{ id: 'wall-scope-1', total: 200 }] },
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    })
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          rooms: [{ room_id: 'R001', room_name: 'Living' }],
          room_wall_scopes: [{ id: 'wall-scope-1', room_id: 'R001' }],
          wall_segments: [{ id: 'segment-1', wall_scope_id: 'wall-scope-1' }],
        },
      })
    ).resolves.toEqual({
      ok: true,
      estimate: savedEstimate,
      inputs: {},
      wall_calculations: { scopes: [{ id: 'wall-scope-1', total: 200 }] },
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    })

    expect(mocks.calculateEstimateV2ArtifactsForSave).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        estimateId: 'estimate-1',
        ensureCatalogs: expect.any(Function),
      })
    )
    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        room_save_mode: 'v2_roster',
        rooms: [
          expect.objectContaining({
            room_id: 'R001',
            room_name: 'Living',
            room_type_id: null,
            wall_complexity_id: null,
          }),
        ],
        room_wall_scopes: [
          expect.objectContaining({
            id: 'wall-scope-1',
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
          }),
        ],
        wall_segments: [
          expect.objectContaining({
            id: 'segment-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            seg_no: 1,
          }),
        ],
      }),
    })
  })

  it('persists server-calculated wall scope rows over stale client calculated fields', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: '11111111-1111-4111-8111-111111111111' },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: null,
        wall_complexity_id: null,
        position: 0,
        notes: null,
        length_in: 120,
        width_in: 144,
        wallheight_in: 96,
        condition_selections: null,
      },
    ])
    mocks.buildV2WallScopeRows.mockReturnValue({
      scopeRows: [
        {
          id: 'wall-scope-1',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Walls',
          paint_product_id: null,
          primer_product_id: null,
          raw_area_sf: null,
          effective_area_sf: null,
          raw_paint_hours: null,
          effective_paint_hours: null,
          raw_total: null,
          effective_total: null,
          notes: null,
        },
      ],
    })
    mocks.buildV2WallSegmentRows.mockReturnValue([])
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts({
      wallCalculations: { scopes: [{ id: 'wall-scope-1', effective_total: 512 }], segments: [] },
      quoteWallScopes: [
        {
          id: 'wall-scope-1',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Walls',
          paint_product_id: null,
          primer_product_id: null,
          raw_area_sf: 300,
          effective_area_sf: 300,
          raw_paint_hours: 3.75,
          effective_paint_hours: 3.75,
          raw_total: 512,
          effective_total: 512,
          notes: null,
        },
      ],
    }))
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await saveEstimateV2Inputs({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      autosaveOnly: false,
      body: {
        rooms: [{ room_id: 'R001', room_name: 'Living' }],
        room_wall_scopes: [{ id: 'wall-scope-1', room_id: 'R001', raw_area_sf: null, effective_total: null }],
        wall_segments: [],
      },
    })

    const payload = mocks.saveEstimateFullPersistenceTransactional.mock.calls[0]?.[0]?.payload
    expect(payload.room_wall_scopes).toEqual([
      expect.objectContaining({
        id: 'wall-scope-1',
        paint_product_id: null,
        primer_product_id: null,
        raw_area_sf: 300,
        effective_area_sf: 300,
        raw_paint_hours: 3.75,
        effective_paint_hours: 3.75,
        raw_total: 512,
        effective_total: 512,
      }),
    ])
  })

  it('passes access fee and other rows into canonical calculation for scope saves', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: '11111111-1111-4111-8111-111111111111' },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: null,
        wall_complexity_id: null,
        position: 0,
        notes: null,
        length_in: 120,
        width_in: 144,
        wallheight_in: 96,
        condition_selections: null,
      },
    ])
    mocks.buildV2WallScopeRows.mockReturnValue({
      scopeRows: [
        {
          id: 'wall-scope-1',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Walls',
          paint_product_id: null,
          primer_product_id: null,
          raw_total: null,
          effective_total: null,
          notes: null,
        },
      ],
    })
    mocks.buildV2WallSegmentRows.mockReturnValue([])
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts({
      wallCalculations: { scopes: [{ id: 'wall-scope-1', effective_total: 512 }], segments: [] },
      quoteWallScopes: [
        {
          id: 'wall-scope-1',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Walls',
          paint_product_id: null,
          primer_product_id: null,
          raw_total: 512,
          effective_total: 512,
          notes: null,
        },
      ],
    }))
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await saveEstimateV2Inputs({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      autosaveOnly: false,
      body: {
        rooms: [{ room_id: 'R001', room_name: 'Living' }],
        room_wall_scopes: [{ id: 'wall-scope-1', room_id: 'R001' }],
        wall_segments: [],
        access_fees: [
          {
            id: 'access-fee-1',
            room_id: 'r001',
            access_fee_id: ' ladder-tall ',
            qty: '2',
            actual_cost_override: '',
            notes: 'Tall foyer',
          },
        ],
        other: [
          {
            id: 'other-1',
            room_id: 'r001',
            client_description: 'Extra masking',
            qty: '3',
            materials_each: '25',
          },
        ],
      },
    })

    expect(mocks.calculateEstimateV2ArtifactsForSave).toHaveBeenCalledWith(
      expect.objectContaining({
        roomRows: [
          expect.objectContaining({
            room_id: 'R001',
            room_name: 'Living',
          }),
        ],
        wallScopeRows: [
          expect.objectContaining({
            id: 'wall-scope-1',
            room_id: 'R001',
          }),
        ],
        accessFeeRows: [
          expect.objectContaining({
            room_id: 'R001',
            access_fee_id: 'LADDER-TALL',
            qty: 2,
            notes: 'Tall foyer',
          }),
        ],
        otherRows: [
          expect.objectContaining({
            id: 'other-1',
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            room_id: 'R001',
            client_description: 'Extra masking',
            qty: 3,
            materials_each: 25,
          }),
        ],
      })
    )

    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        access_fees: [
          expect.objectContaining({
            access_fee_id: 'LADDER-TALL',
            qty: 2,
          }),
        ],
        other: [
          expect.objectContaining({
            id: 'other-1',
            client_description: 'Extra masking',
            qty: 3,
            materials_each: 25,
          }),
        ],
      }),
    })
    expect(mocks.loadEstimateV2Response).toHaveBeenCalledWith({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })
  })

  it('uses the full-save RPC for ceiling-only scope saves', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: '11111111-1111-4111-8111-111111111111' },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: 'BEDROOM',
        wall_complexity_id: 'WALL_STD',
        position: 0,
        notes: null,
        length_in: 120,
        width_in: 144,
        wallheight_in: 96,
        condition_selections: null,
      },
    ])
    mocks.buildV2CeilingScopeRows.mockReturnValue({
      scopeRows: [],
      scopeIds: new Set(),
      modeByRoom: new Map(),
    })
    mocks.buildV2CeilingSegmentRows.mockReturnValue([])
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts({
      ceilingCalculations: { scopes: [], segments: [] },
      quoteCeilingScopes: [],
    }))
    mocks.loadEstimateV2Response.mockResolvedValue({
      estimate: savedEstimate,
      inputs: {},
      wall_calculations: null,
      ceiling_calculations: { scopes: [] },
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    })
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          rooms: [{ room_id: 'R001', room_name: 'Living' }],
          room_ceiling_scopes: [],
        },
      })
    ).resolves.toEqual({
      ok: true,
      estimate: savedEstimate,
      inputs: {},
      wall_calculations: null,
      ceiling_calculations: { scopes: [] },
      trim_calculations: null,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    })

    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        room_save_mode: 'v2_roster',
        rooms: [
          expect.objectContaining({
            room_id: 'R001',
            room_type_id: 'BEDROOM',
            wall_complexity_id: 'WALL_STD',
          }),
        ],
        room_ceiling_scopes: [],
        ceiling_scope_segments: [],
      }),
    })
  })

  it('uses the full-save RPC for trim-only scope saves', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: '11111111-1111-4111-8111-111111111111' },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: 'BEDROOM',
        wall_complexity_id: 'WALL_STD',
        position: 0,
        notes: null,
        length_in: 120,
        width_in: 144,
        wallheight_in: 96,
        condition_selections: null,
      },
    ])
    mocks.buildV2TrimScopeRows.mockReturnValue({ scopeRows: [] })
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts())
    mocks.loadEstimateV2Response.mockResolvedValue({
      estimate: savedEstimate,
      inputs: {},
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: { scopes: [] },
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    })
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          rooms: [{ room_id: 'R001', room_name: 'Living' }],
          room_trim_scopes: [],
        },
      })
    ).resolves.toEqual({
      ok: true,
      estimate: savedEstimate,
      inputs: {},
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: { scopes: [] },
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    })

    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        room_save_mode: 'v2_roster',
        rooms: [
          expect.objectContaining({
            room_id: 'R001',
            room_type_id: 'BEDROOM',
            wall_complexity_id: 'WALL_STD',
          }),
        ],
        room_trim_scopes: [],
      }),
    })
  })

  it('persists server-calculated trim scope rows over stale client calculated fields', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: '11111111-1111-4111-8111-111111111111' },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: null,
        wall_complexity_id: null,
        position: 0,
        notes: null,
        length_in: 120,
        width_in: 144,
        wallheight_in: 96,
        condition_selections: null,
      },
    ])
    mocks.buildV2TrimScopeRows.mockReturnValue({
      scopeRows: [
        {
          id: 'trim-scope-1',
          room_id: 'R001',
          position: 0,
          include: 'Y',
          scope_name: 'Baseboard',
          trim_type_id: 'BASE',
          paint_product_id: null,
          primer_product_id: null,
          raw_measurement: null,
          effective_measurement: null,
          raw_paint_hours: null,
          effective_paint_hours: null,
          raw_total: null,
          effective_total: null,
          notes: null,
        },
      ],
    })
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts({
      trimCalculations: { scopes: [{ id: 'trim-scope-1', effective_total: 184 }] },
      quoteTrimScopes: [
        {
          id: 'trim-scope-1',
          room_id: 'R001',
          position: 0,
          include: 'Y',
          scope_name: 'Baseboard',
          trim_type_id: 'BASE',
          paint_product_id: null,
          primer_product_id: null,
          raw_measurement: 44,
          effective_measurement: 44,
          raw_paint_hours: 1.47,
          effective_paint_hours: 1.47,
          raw_total: 184,
          effective_total: 184,
          notes: null,
        },
      ],
    }))
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await saveEstimateV2Inputs({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      autosaveOnly: false,
      body: {
        rooms: [{ room_id: 'R001', room_name: 'Living' }],
        room_trim_scopes: [{ id: 'trim-scope-1', room_id: 'R001', raw_measurement: null, effective_total: null }],
      },
    })

    const payload = mocks.saveEstimateFullPersistenceTransactional.mock.calls[0]?.[0]?.payload
    expect(payload.room_trim_scopes).toEqual([
      expect.objectContaining({
        id: 'trim-scope-1',
        paint_product_id: null,
        primer_product_id: null,
        raw_measurement: 44,
        effective_measurement: 44,
        raw_paint_hours: 1.47,
        effective_paint_hours: 1.47,
        raw_total: 184,
        effective_total: 184,
      }),
    ])
  })

  it('maps V2 door scope saves into the full-save RPC payload', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: '11111111-1111-4111-8111-111111111111' },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([
      {
        room_id: 'R001',
        room_name: 'Living',
        room_type_id: 'BEDROOM',
        wall_complexity_id: 'WALL_STD',
        position: 0,
        notes: null,
        length_in: 120,
        width_in: 144,
        wallheight_in: 96,
        condition_selections: null,
      },
    ])
    mocks.buildV2DoorScopeRows.mockReturnValue({
      scopeRows: [
        {
          id: 'door-scope-1',
          room_id: 'R001',
          position: 0,
          include: 'Y',
          scope_name: 'Panel Door',
          door_type_id: 'DOOR_PANEL',
          color_id: 'TRIM_WHITE',
          paint_product_id: 'P-TRIM',
          primer_product_id: 'P-TRIM-PRIMER',
          prime_mode: 'NONE',
          quantity: 1,
          sides: 2,
          paint_coats: 2,
          primer_coats: 1,
          spot_prime_percent: null,
          condition_factor: 1,
          labor_rate: null,
          material_rate: null,
          raw_units: null,
          effective_units: null,
          raw_paint_hours: null,
          override_paint_hours: null,
          effective_paint_hours: null,
          raw_primer_hours: null,
          override_primer_hours: null,
          effective_primer_hours: null,
          raw_material_cost: null,
          override_material_cost: null,
          effective_material_cost: null,
          raw_supply_cost: null,
          override_supply_cost: null,
          effective_supply_cost: null,
          raw_total: null,
          override_total: null,
          effective_total: null,
          notes: 'two sides',
        },
      ],
    })
    mocks.calculateEstimateV2ArtifactsForSave.mockResolvedValue(buildCanonicalSaveArtifacts({
      doorCalculations: {
        scopes: [{ id: 'door-scope-1', effective_total: 92 }],
        room_totals: [{ room_id: 'R001', effective_total: 92 }],
      },
      quoteDoorScopes: [
        {
          id: 'door-scope-1',
          room_id: 'R001',
          position: 0,
          include: 'Y',
          scope_name: 'Panel Door',
          door_type_id: 'DOOR_PANEL',
          color_id: 'TRIM_WHITE',
          paint_product_id: 'P-TRIM',
          primer_product_id: 'P-TRIM-PRIMER',
          prime_mode: 'NONE',
          quantity: 1,
          sides: 2,
          paint_coats: 2,
          primer_coats: 1,
          spot_prime_percent: null,
          condition_factor: 1,
          labor_rate: null,
          material_rate: null,
          raw_units: 2,
          effective_units: 2,
          raw_paint_hours: 1,
          override_paint_hours: null,
          effective_paint_hours: 1,
          raw_primer_hours: 0,
          override_primer_hours: null,
          effective_primer_hours: 0,
          raw_material_cost: 12,
          override_material_cost: null,
          effective_material_cost: 12,
          raw_supply_cost: 0,
          override_supply_cost: null,
          effective_supply_cost: 0,
          raw_total: 92,
          override_total: null,
          effective_total: 92,
          notes: 'two sides',
        },
      ],
    }))
    mocks.loadEstimateV2Response.mockResolvedValue({
      estimate: savedEstimate,
      inputs: {},
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: {
        scopes: [{ id: 'door-scope-1', effective_total: 92 }],
        room_totals: [{ room_id: 'R001', effective_total: 92 }],
      },
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    })
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          rooms: [{ room_id: 'R001', room_name: 'Living' }],
          room_door_scopes: [{ id: 'door-scope-1', room_id: 'R001', door_type_id: 'DOOR_PANEL' }],
        },
      })
    ).resolves.toEqual({
      ok: true,
      estimate: savedEstimate,
      inputs: {},
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: {
        scopes: [{ id: 'door-scope-1', effective_total: 92 }],
        room_totals: [{ room_id: 'R001', effective_total: 92 }],
      },
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    })

    expect(mocks.buildV2DoorScopeRows).toHaveBeenCalledWith(
      [{ id: 'door-scope-1', room_id: 'R001', door_type_id: 'DOOR_PANEL' }],
      new Set(['R001'])
    )
    expect(mocks.calculateEstimateV2ArtifactsForSave).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        estimateId: 'estimate-1',
        ensureCatalogs: expect.any(Function),
      })
    )
    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        room_door_scopes: [
          expect.objectContaining({
            id: 'door-scope-1',
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            room_id: 'R001',
            door_type_id: 'DOOR_PANEL',
            raw_units: 2,
            effective_total: 92,
          }),
        ],
      }),
    })
  })

  it('maps roller payload rows into the full-save RPC payload', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.saveEstimateFullPersistenceTransactional.mockResolvedValue(undefined)

    await expect(
      saveEstimateV2Inputs({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        autosaveOnly: false,
        body: {
          rollers: [
            {
              id: 'roller-1',
              scope: 'Wall',
              wall_color_id: 'color1',
              selected_option_id: 'WALL_9',
              roller_size_in: '9',
              covers_qty: '2',
              notes: 'Saved roller',
            },
            {
              id: 'roller-unassigned',
              scope: 'Wall',
              wall_color_id: 'scope:wall-unassigned',
              selected_option_id: 'WALL_12',
              roller_size_in: '12',
              covers_qty: '1',
              notes: 'Unassigned wall scope',
            },
            {
              id: 'roller-2',
              scope: 'Ceiling',
              selected_option_id: 'CEIL_14',
              roller_size_in: 14,
              covers_qty: 1,
            },
            {
              id: 'applicator-1',
              scope: 'Trim',
              selected_option_id: 'TRIM_4',
              roller_size_in: '4',
              covers_qty: '2',
              notes: 'Saved applicator',
            },
          ],
        },
      })
    ).resolves.toEqual({ ok: true, estimate: savedEstimate })

    expect(mocks.saveEstimateFullPersistenceTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: expect.objectContaining({
        rollers: [
          expect.objectContaining({
            id: 'roller-1',
            org_id: 'org-1',
            estimate_id: 'estimate-1',
            job_id: '11111111-1111-4111-8111-111111111111',
            scope: 'Wall',
            wall_color_id: 'COLOR1',
            selected_option_id: 'WALL_9',
            roller_size_in: 9,
            covers_qty: 2,
            notes: 'Saved roller',
          }),
          expect.objectContaining({
            id: 'roller-unassigned',
            scope: 'Wall',
            wall_color_id: 'scope:wall-unassigned',
            selected_option_id: 'WALL_12',
            roller_size_in: 12,
            covers_qty: 1,
            notes: 'Unassigned wall scope',
          }),
          expect.objectContaining({
            id: 'roller-2',
            scope: 'Ceiling',
            wall_color_id: null,
            selected_option_id: 'CEIL_14',
            roller_size_in: 14,
            covers_qty: 1,
          }),
          expect.objectContaining({
            id: 'applicator-1',
            scope: 'Trim',
            wall_color_id: null,
            selected_option_id: 'TRIM_4',
            roller_size_in: 4,
            covers_qty: 2,
            notes: 'Saved applicator',
          }),
        ],
      }),
    })
  })
})
