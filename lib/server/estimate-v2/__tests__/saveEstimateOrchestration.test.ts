import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildV2CeilingScopeRows: vi.fn(),
  buildV2CeilingSegmentRows: vi.fn(),
  buildV2DoorScopeRows: vi.fn(),
  buildV2RoomRosterRows: vi.fn(),
  buildV2TrimScopeRows: vi.fn(),
  buildV2WallScopeRows: vi.fn(),
  buildV2WallSegmentRows: vi.fn(),
  calculateCeilingsForSave: vi.fn(),
  calculateDoorsForSave: vi.fn(),
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
  buildV2DoorScopeRows: mocks.buildV2DoorScopeRows,
  buildV2RoomRosterRows: mocks.buildV2RoomRosterRows,
  buildV2TrimScopeRows: mocks.buildV2TrimScopeRows,
  buildV2WallScopeRows: mocks.buildV2WallScopeRows,
  buildV2WallSegmentRows: mocks.buildV2WallSegmentRows,
}))

vi.mock('../calculationOrchestration.ts', () => ({
  calculateCeilingsForSave: mocks.calculateCeilingsForSave,
  calculateDoorsForSave: mocks.calculateDoorsForSave,
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
      rows: [
        expect.objectContaining({
          room_id: 'R001',
          room_name: 'Living',
          room_type_id: null,
          wall_complexity_id: null,
        }),
      ],
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

  it('uses V2 room roster persistence for ceiling-only scope saves', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: 'job-1' },
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
    mocks.calculateCeilingsForSave.mockResolvedValue({
      ceilingCalculations: { scopes: [] },
      ceilingScopeRows: [],
      ceilingSegmentRows: [],
    })
    mocks.saveV2RoomRoster.mockResolvedValue(undefined)
    mocks.softReplaceRows.mockResolvedValue(undefined)

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
      wall_calculations: null,
      ceiling_calculations: { scopes: [] },
      trim_calculations: null,
    })

    expect(mocks.saveV2RoomRoster).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: 'job-1',
      rows: [
        expect.objectContaining({
          room_id: 'R001',
          room_type_id: 'BEDROOM',
          wall_complexity_id: 'WALL_STD',
        }),
      ],
    })
    expect(mocks.replaceLegacyEstimateRooms).not.toHaveBeenCalled()
  })

  it('uses V2 room roster persistence for trim-only scope saves', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: 'job-1' },
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
    mocks.calculateTrimForSave.mockResolvedValue({ scopes: [] })
    mocks.saveV2RoomRoster.mockResolvedValue(undefined)
    mocks.softReplaceRows.mockResolvedValue(undefined)

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
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: { scopes: [] },
    })

    expect(mocks.saveV2RoomRoster).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      jobId: 'job-1',
      rows: [
        expect.objectContaining({
          room_id: 'R001',
          room_type_id: 'BEDROOM',
          wall_complexity_id: 'WALL_STD',
        }),
      ],
    })
    expect(mocks.replaceLegacyEstimateRooms).not.toHaveBeenCalled()
  })

  it('maps V2 door scope saves through calculation and door persistence boundaries', async () => {
    mocks.getEstimate.mockResolvedValue({
      estimate: { id: 'estimate-1', job_id: 'job-1' },
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
    mocks.calculateDoorsForSave.mockResolvedValue({
      scopes: [
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
      room_totals: [{ room_id: 'R001', effective_total: 92 }],
    })
    mocks.saveV2RoomRoster.mockResolvedValue(undefined)
    mocks.softReplaceRows.mockResolvedValue(undefined)

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
      wall_calculations: null,
      ceiling_calculations: null,
      trim_calculations: null,
      door_calculations: {
        scopes: [expect.objectContaining({ id: 'door-scope-1', effective_total: 92 })],
        room_totals: [{ room_id: 'R001', effective_total: 92 }],
      },
    })

    expect(mocks.buildV2DoorScopeRows).toHaveBeenCalledWith(
      [{ id: 'door-scope-1', room_id: 'R001', door_type_id: 'DOOR_PANEL' }],
      new Set(['R001'])
    )
    expect(mocks.calculateDoorsForSave).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        estimateId: 'estimate-1',
        roomRows: [
          expect.objectContaining({
            room_id: 'R001',
            room_name: 'Living',
          }),
        ],
        scopes: [
          expect.objectContaining({
            id: 'door-scope-1',
            door_type_id: 'DOOR_PANEL',
          }),
        ],
        ensureCatalogs: expect.any(Function),
      })
    )
    expect(mocks.softReplaceRows).toHaveBeenCalledWith({
      table: 'estimate_room_door_scopes',
      orgId: 'org-1',
      estimateId: 'estimate-1',
      rows: [
        expect.objectContaining({
          id: 'door-scope-1',
          org_id: 'org-1',
          estimate_id: 'estimate-1',
          job_id: 'job-1',
          room_id: 'R001',
          door_type_id: 'DOOR_PANEL',
          raw_units: 2,
          effective_total: 92,
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
    })
  })
})
