import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveHeightFactorMultiplierFromInches } from '../heightFactors.ts'

const bands = [
  { min_height_ft: 0, max_height_ft: 10, labor_multiplier: 1 },
  { min_height_ft: 10, max_height_ft: 12, labor_multiplier: 1.15 },
  { min_height_ft: 12, max_height_ft: 16, labor_multiplier: 1.3 },
  { min_height_ft: 16, max_height_ft: null, labor_multiplier: 1.5 },
]

test('resolveHeightFactorMultiplierFromInches uses the standard band below 10 ft', () => {
  assert.equal(resolveHeightFactorMultiplierFromInches(96, bands), 1)
})

test('resolveHeightFactorMultiplierFromInches prefers the higher-min band on shared boundaries', () => {
  assert.equal(resolveHeightFactorMultiplierFromInches(120, bands), 1.15)
  assert.equal(resolveHeightFactorMultiplierFromInches(144, bands), 1.3)
  assert.equal(resolveHeightFactorMultiplierFromInches(192, bands), 1.5)
})

test('resolveHeightFactorMultiplierFromInches falls back to 1 for invalid heights or empty catalogs', () => {
  assert.equal(resolveHeightFactorMultiplierFromInches(null, bands), 1)
  assert.equal(resolveHeightFactorMultiplierFromInches(0, bands), 1)
  assert.equal(resolveHeightFactorMultiplierFromInches(120, []), 1)
})
