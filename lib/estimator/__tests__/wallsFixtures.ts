import type { WallCalculationInput } from '../walls.ts'

type ScopeExpectation = {
  id: string
  raw_area_sf: number
  effective_area_sf: number
  raw_supply_cost?: number
  raw_paint_hours?: number
  raw_primer_hours?: number
  raw_total: number
  effective_total: number
  modifier_factor?: number
}

type RoomExpectation = {
  room_id: string
  effective_area_sf: number
  effective_total: number
}

type ColorGroupExpectation = {
  group_key: string
  total_shared_supply_cost: number
  allocations: Record<string, number>
}

export type WallGoldenFixture = {
  name: string
  input: WallCalculationInput
  expected: {
    missing_input_count: number
    scopes: ScopeExpectation[]
    rooms: RoomExpectation[]
    color_group?: ColorGroupExpectation
  }
}

export const WALL_GOLDEN_FIXTURES: WallGoldenFixture[] = [
  {
    name: 'rect_dual_scope_shared_color_group',
    input: {
      settings: {
        labor_rate_per_hour: 50,
        paint_prod_rate_sqft_per_hour: 100,
        primer_prod_rate_sqft_per_hour: 200,
        paint_coverage_sqft_per_gal_per_coat: 200,
        primer_coverage_sqft_per_gal_per_coat: 100,
        paint_coats: 2,
        primer_coats: 1,
        area_supply_cost_per_sf: 0.1,
        per_color_supply_cost: 12,
        paint_price_per_gal: 10,
        primer_price_per_gal: 8,
        spot_prime_percent: 30,
      },
      scopes: [
        {
          id: 'scope-rect-main',
          room_id: 'R001',
          position: 0,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Main Walls',
          color_id: 'A',
          paint_product_id: 'P-WALL',
          primer_product_id: 'P-PRIMER',
          prime_mode: 'FULL',
          height_in: 96,
          perimeter_in: 600,
          standard_door_count: 1,
          standard_window_count: 1,
          height_factor: 1,
          complexity_factor: 1,
          wall_flag_factor: 1,
          cut_in_top_factor: 1,
          cut_in_bottom_factor: 1,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          raw_paint_hours: null,
          override_paint_hours: null,
          effective_paint_hours: null,
          raw_primer_hours: null,
          override_primer_hours: null,
          effective_primer_hours: null,
          raw_paint_gallons: null,
          override_paint_gallons: null,
          effective_paint_gallons: null,
          raw_primer_gallons: null,
          override_primer_gallons: null,
          effective_primer_gallons: null,
          raw_supply_cost: null,
          override_supply_cost: null,
          effective_supply_cost: null,
          raw_total: null,
          override_total: null,
          effective_total: null,
          notes: null,
        },
        {
          id: 'scope-rect-half',
          room_id: 'R001',
          position: 1,
          mode: 'RECT',
          include: 'Y',
          scope_name: 'Half Walls',
          color_id: 'A',
          paint_product_id: 'P-WALL',
          primer_product_id: 'P-PRIMER',
          prime_mode: 'NONE',
          height_in: 96,
          perimeter_in: 300,
          standard_door_count: 0,
          standard_window_count: 0,
          height_factor: 1,
          complexity_factor: 1,
          wall_flag_factor: 1,
          cut_in_top_factor: 1,
          cut_in_bottom_factor: 1,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          raw_paint_hours: null,
          override_paint_hours: null,
          effective_paint_hours: null,
          raw_primer_hours: null,
          override_primer_hours: null,
          effective_primer_hours: null,
          raw_paint_gallons: null,
          override_paint_gallons: null,
          effective_paint_gallons: null,
          raw_primer_gallons: null,
          override_primer_gallons: null,
          effective_primer_gallons: null,
          raw_supply_cost: null,
          override_supply_cost: null,
          effective_supply_cost: null,
          raw_total: null,
          override_total: null,
          effective_total: null,
          notes: null,
        },
      ],
      segments: [],
    },
    expected: {
      missing_input_count: 0,
      scopes: [
        {
          id: 'scope-rect-main',
          raw_area_sf: 364,
          effective_area_sf: 364,
          raw_supply_cost: 44.1447,
          raw_total: 564.6647,
          effective_total: 566.9881,
        },
        {
          id: 'scope-rect-half',
          raw_area_sf: 200,
          effective_area_sf: 200,
          raw_supply_cost: 24.2553,
          raw_total: 244.2553,
          effective_total: 245.5319,
        },
      ],
      rooms: [
        {
          room_id: 'R001',
          effective_area_sf: 564,
          effective_total: 812.52,
        },
      ],
      color_group: {
        group_key: 'P-WALL::A',
        total_shared_supply_cost: 12,
        allocations: {
          'scope-rect-main': 7.7447,
          'scope-rect-half': 4.2553,
        },
      },
    },
  },
  {
    name: 'seg_mixed_shapes_spot_prime_modifiers',
    input: {
      settings: {
        labor_rate_per_hour: 60,
        paint_prod_rate_sqft_per_hour: 100,
        primer_prod_rate_sqft_per_hour: 200,
        paint_coverage_sqft_per_gal_per_coat: 300,
        primer_coverage_sqft_per_gal_per_coat: 250,
        paint_coats: 1,
        primer_coats: 1,
        area_supply_cost_per_sf: 0.05,
        per_color_supply_cost: 10,
        paint_price_per_gal: 45,
        primer_price_per_gal: 30,
        spot_prime_percent: 25,
      },
      scopes: [
        {
          id: 'scope-seg-mix',
          room_id: 'R010',
          position: 0,
          mode: 'SEG',
          include: 'Y',
          scope_name: 'Mixed Segments',
          color_id: 'C',
          paint_product_id: 'P-WALL',
          primer_product_id: 'P-PRIMER',
          prime_mode: 'SPOT',
          height_in: null,
          perimeter_in: null,
          standard_door_count: null,
          standard_window_count: null,
          height_factor: 1.2,
          complexity_factor: 1.1,
          wall_flag_factor: 1.05,
          cut_in_top_factor: 1,
          cut_in_bottom_factor: 0.95,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          raw_paint_hours: null,
          override_paint_hours: null,
          effective_paint_hours: null,
          raw_primer_hours: null,
          override_primer_hours: null,
          effective_primer_hours: null,
          raw_paint_gallons: null,
          override_paint_gallons: null,
          effective_paint_gallons: null,
          raw_primer_gallons: null,
          override_primer_gallons: null,
          effective_primer_gallons: null,
          raw_supply_cost: null,
          override_supply_cost: null,
          effective_supply_cost: null,
          raw_total: null,
          override_total: null,
          effective_total: null,
          notes: null,
        },
      ],
      segments: [
        {
          id: 'seg-rect',
          wall_scope_id: 'scope-seg-mix',
          room_id: 'R010',
          position: 0,
          segment_name: 'Rectangle',
          include: 'Y',
          shape_type: 'RECTANGLE',
          quantity: 2,
          width_in: 120,
          height_in: 96,
          base_in: null,
          manual_area_sf: null,
          standard_door_count: 1,
          standard_window_count: 0,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          notes: null,
        },
        {
          id: 'seg-triangle',
          wall_scope_id: 'scope-seg-mix',
          room_id: 'R010',
          position: 1,
          segment_name: 'Triangle',
          include: 'Y',
          shape_type: 'TRIANGLE',
          quantity: 1,
          width_in: null,
          height_in: 96,
          base_in: 120,
          manual_area_sf: null,
          standard_door_count: 0,
          standard_window_count: 1,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          notes: null,
        },
        {
          id: 'seg-manual-excluded',
          wall_scope_id: 'scope-seg-mix',
          room_id: 'R010',
          position: 2,
          segment_name: 'Manual Excluded',
          include: 'N',
          shape_type: 'MANUAL',
          quantity: 1,
          width_in: null,
          height_in: null,
          base_in: null,
          manual_area_sf: 50,
          standard_door_count: 0,
          standard_window_count: 0,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          notes: null,
        },
      ],
    },
    expected: {
      missing_input_count: 0,
      scopes: [
        {
          id: 'scope-seg-mix',
          raw_area_sf: 164,
          effective_area_sf: 164,
          raw_paint_hours: 2.1594,
          raw_primer_hours: 0.2699,
          raw_supply_cost: 18.2,
          raw_total: 193.4795,
          effective_total: 213.878,
          modifier_factor: 1.3167,
        },
      ],
      rooms: [
        {
          room_id: 'R010',
          effective_area_sf: 164,
          effective_total: 213.878,
        },
      ],
      color_group: {
        group_key: 'P-WALL::C',
        total_shared_supply_cost: 10,
        allocations: {
          'scope-seg-mix': 10,
        },
      },
    },
  },
]
