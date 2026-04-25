import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildV2CeilingScopeRows: vi.fn(),
  buildV2CeilingSegmentRows: vi.fn(),
  buildV2RoomRosterRows: vi.fn(),
  buildV2TrimScopeRows: vi.fn(),
  buildV2WallScopeRows: vi.fn(),
  buildV2WallSegmentRows: vi.fn(),
  calculateCeilingsForSave: vi.fn(),
  calculateTrimForSave: vi.fn(),
  calculateWallsForSave: vi.fn(),
  createCalculationCatalogsLoader: vi.fn(),
  getEstimate: vi.fn(),
  isMissingStructuredEstimateSaveRpc: vi.fn(),
  isRecoverableStructuredEstimateSaveRpcPkCollision: vi.fn(),
  replaceLegacyEstimateRooms: vi.fn(),
  saveEstimateStructuredInputsTransactional: vi.fn(),
  saveV2RoomRoster: vi.fn(),
  softReplaceRows: vi.fn(),
  softReplaceWallSegments: vi.fn(),
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
  buildV2RoomRosterRows: mocks.buildV2RoomRosterRows,
  buildV2TrimScopeRows: mocks.buildV2TrimScopeRows,
  buildV2WallScopeRows: mocks.buildV2WallScopeRows,
  buildV2WallSegmentRows: mocks.buildV2WallSegmentRows,
}))

vi.mock('../calculationOrchestration.ts', () => ({
  calculateCeilingsForSave: mocks.calculateCeilingsForSave,
  calculateTrimForSave: mocks.calculateTrimForSave,
  calculateWallsForSave: mocks.calculateWallsForSave,
  createCalculationCatalogsLoader: mocks.createCalculationCatalogsLoader,
}))

vi.mock('../roomPersistence.ts', () => ({
  buildLegacyEstimateRoomRows: vi.fn(),
  replaceLegacyEstimateRooms: mocks.replaceLegacyEstimateRooms,
  saveV2RoomRoster: mocks.saveV2RoomRoster,
}))

vi.mock('../scopeRowPersistence.ts', () => ({
  isMissingStructuredEstimateSaveRpc: mocks.isMissingStructuredEstimateSaveRpc,
  isRecoverableStructuredEstimateSaveRpcPkCollision:
    mocks.isRecoverableStructuredEstimateSaveRpcPkCollision,
  saveEstimateStructuredInputsTransactional: mocks.saveEstimateStructuredInputsTransactional,
  softReplaceRows: mocks.softReplaceRows,
  softReplaceWallSegments: mocks.softReplaceWallSegments,
}))

vi.mock('../shared.ts', async () => {
  const actual = await vi.importActual<typeof import('../shared.ts')>('../shared.ts')
  return {
    ...actual,
    getEstimate: mocks.getEstimate,
  }
})

import { saveEstimateV2Inputs } from '../saveEstimateOrchestration.ts'

describe('saveEstimateV2Inputs', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.createCalculationCatalogsLoader.mockReturnValue(vi.fn())
    mocks.isMissingStructuredEstimateSaveRpc.mockReturnValue(false)
    mocks.isRecoverableStructuredEstimateSaveRpcPkCollision.mockReturnValue(false)
  })

  it('uses the structured transactional seam for collection-only writes and exits early', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: '11111111-1111-4111-8111-111111111111',
      },
    })
    mocks.saveEstimateStructuredInputsTransactional.mockResolvedValue(undefined)

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
    ).resolves.toEqual({ ok: true })

    expect(mocks.saveEstimateStructuredInputsTransactional).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: '11111111-1111-4111-8111-111111111111',
      payload: {
        job_colors: [{ color_id: 'WHITE' }],
      },
    })
    expect(mocks.saveV2RoomRoster).not.toHaveBeenCalled()
    expect(mocks.softReplaceRows).not.toHaveBeenCalled()
    expect(mocks.softReplaceWallSegments).not.toHaveBeenCalled()
  })

  it('maps extracted V2 wall seams through calculation and persistence boundaries', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: 'job-1',
      },
    })
    mocks.buildV2RoomRosterRows.mockReturnValue([{ room_id: 'R001', room_name: 'Living' }])
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
    mocks.calculateWallsForSave.mockResolvedValue({
      wallCalculations: { scopes: [{ id: 'wall-scope-1', total: 200 }] },
      wallSegmentRows: [
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
    })
    mocks.saveV2RoomRoster.mockResolvedValue(undefined)
    mocks.softReplaceRows.mockResolvedValue(undefined)
    mocks.softReplaceWallSegments.mockResolvedValue(undefined)

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
      wall_calculations: { scopes: [{ id: 'wall-scope-1', total: 200 }] },
      ceiling_calculations: null,
      trim_calculations: null,
    })

    expect(mocks.calculateWallsForSave).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOrigin: 'http://localhost:3000',
        orgId: 'org-1',
        userId: 'user-1',
        estimateId: 'estimate-1',
        scopes: [
          expect.objectContaining({
            id: 'wall-scope-1',
            room_id: 'R001',
          }),
        ],
        segments: [
          expect.objectContaining({
            id: 'segment-1',
            wall_scope_id: 'wall-scope-1',
          }),
        ],
        ensureCatalogs: expect.any(Function),
      })
    )
    expect(mocks.saveV2RoomRoster).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: 'job-1',
      rows: [{ room_id: 'R001', room_name: 'Living' }],
    })
    expect(mocks.softReplaceRows).toHaveBeenCalledWith({
      table: 'estimate_room_wall_scopes',
      orgId: 'org-1',
      estimateId: 'estimate-1',
      rows: [
        expect.objectContaining({
          id: 'wall-scope-1',
          org_id: 'org-1',
          estimate_id: 'estimate-1',
          job_id: 'job-1',
        }),
      ],
    })
    expect(mocks.softReplaceWallSegments).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      rows: [
        expect.objectContaining({
          id: 'segment-1',
          job_id: 'job-1',
          seg_no: 1,
        }),
      ],
    })
  })

  it('maps roller payload rows to estimate_rollers persistence', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: {
        id: 'estimate-1',
        job_id: 'job-1',
      },
    })
    mocks.softReplaceRows.mockResolvedValue(undefined)

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
              wall_color_id: 'COLOR1',
              roller_size_in: '9',
              covers_qty: '2',
              notes: 'Saved roller',
            },
            {
              id: 'roller-2',
              scope: 'Ceiling',
              roller_size_in: 14,
              covers_qty: 1,
            },
            {
              id: 'applicator-1',
              scope: 'Trim',
              roller_size_in: '4',
              covers_qty: '2',
              notes: 'Saved applicator',
            },
          ],
        },
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.softReplaceRows).toHaveBeenCalledWith({
      table: 'estimate_rollers',
      orgId: 'org-1',
      estimateId: 'estimate-1',
      rows: [
        expect.objectContaining({
          id: 'roller-1',
          org_id: 'org-1',
          estimate_id: 'estimate-1',
          job_id: 'job-1',
          scope: 'Wall',
          wall_color_id: 'COLOR1',
          roller_size_in: 9,
          covers_qty: 2,
          notes: 'Saved roller',
        }),
        expect.objectContaining({
          id: 'roller-2',
          scope: 'Ceiling',
          wall_color_id: null,
          roller_size_in: 14,
          covers_qty: 1,
        }),
        expect.objectContaining({
          id: 'applicator-1',
          scope: 'Trim',
          wall_color_id: null,
          roller_size_in: 4,
          covers_qty: 2,
          notes: 'Saved applicator',
        }),
      ],
    })
  })
})
