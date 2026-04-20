import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEstimateGetResponse } from '../estimateGetResponse.ts'

test('buildEstimateGetResponse includes trim paint and paint products', () => {
  const response = buildEstimateGetResponse({
    estimate: { id: 'EST-1' },
    inputs: {
      jobsettings: { trim_paint_id: 'TRIM-WHITE' },
      paint_products: [{ id: 'TRIM-WHITE', label: 'Trim White' }],
      rooms: [],
      room_wall_scopes: [],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [],
      ceiling_scope_segments: [],
      room_trim_scopes: [],
      rollers: [],
      prejob: [],
      trim_items: [],
      job_colors: [],
      room_flags: [],
      access_fees: [],
      other: [],
    },
    wall_calculations: { scopes: [] },
    ceiling_calculations: { scopes: [] },
    trim_calculations: { scopes: [] },
    trim_paint: {
      paint_product_id: 'TRIM-WHITE',
      paint_product_label: 'Trim White',
      gallons: 1,
      quarts: 2,
      normalized_gallons: 1.5,
      paint_cost: 45,
    },
    pricing_summary: { trimPaintMaterialCost: 45 },
  })

  assert.equal(response.estimate.id, 'EST-1')
  assert.equal((response.inputs.paint_products as Array<{ id: string }>).length, 1)
  assert.equal((response.inputs.paint_products as Array<{ id: string }>)[0].id, 'TRIM-WHITE')
  assert.equal(response.trim_paint && (response.trim_paint as { paint_cost: number }).paint_cost, 45)
  assert.equal((response.pricing_summary as { trimPaintMaterialCost: number }).trimPaintMaterialCost, 45)
})
