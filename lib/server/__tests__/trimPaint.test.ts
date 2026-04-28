import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTrimPaintInput, normalizeTrimPaintGallons } from '../trimPaint.ts'

test('normalizeTrimPaintGallons combines gallons and quarts', () => {
  assert.equal(normalizeTrimPaintGallons(1, 2), 1.5)
  assert.equal(normalizeTrimPaintGallons('2', '3'), 2.75)
})

test('buildTrimPaintInput uses product label and price_per_gal', () => {
  const result = buildTrimPaintInput({
    jobsettings: {
      trim_paint_id: 'TRIM-WHITE',
      trim_paint_gallons: 1,
      trim_paint_quarts: 2,
    },
    catalogs: new Map([
      ['TRIM-WHITE', { id: 'TRIM-WHITE', label: 'Trim White', price_per_gal: 30 }],
    ]),
  })

  assert.ok(result)
  assert.equal(result?.paint_product_id, 'TRIM-WHITE')
  assert.equal(result?.paint_product_label, 'Trim White')
  assert.equal(result?.gallons, 1)
  assert.equal(result?.quarts, 2)
  assert.equal(result?.normalized_gallons, 1.5)
  assert.equal(result?.paint_cost, 45)
})

test('buildTrimPaintInput falls back to legacy qty/uom', () => {
  const result = buildTrimPaintInput({
    jobsettings: {
      trim_paint_id: 'TRIM-WHITE',
      trim_paint_qty: 2,
      trim_paint_uom: 'Quart',
    },
    catalogs: new Map([
      ['TRIM-WHITE', { id: 'TRIM-WHITE', label: 'Trim White', price_per_gal: 40 }],
    ]),
  })

  assert.ok(result)
  assert.equal(result?.normalized_gallons, 0.5)
  assert.equal(result?.paint_cost, 20)
  assert.equal(result?.gallons, 0)
  assert.equal(result?.quarts, 2)
})

test('buildTrimPaintInput prices job gallons from the org default trim paint product', () => {
  const result = buildTrimPaintInput({
    jobsettings: {
      trim_paint_gallons: 1,
      trim_paint_quarts: 0,
    },
    defaults: {
      trim_paint_id: 'TRIM-WHITE',
    },
    catalogs: new Map([
      ['TRIM-WHITE', { id: 'TRIM-WHITE', label: 'Trim White', price_per_gal: 42 }],
    ]),
  })

  assert.ok(result)
  assert.equal(result?.paint_product_id, 'TRIM-WHITE')
  assert.equal(result?.paint_product_label, 'Trim White')
  assert.equal(result?.normalized_gallons, 1)
  assert.equal(result?.paint_cost, 42)
})
