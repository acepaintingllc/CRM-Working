import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isV2EstimateSchema,
  resolveEstimateCatalogSource,
  shouldUseV2EstimateCatalogSource,
} from '../estimateCustomerPortalSource.ts'

test('isV2EstimateSchema recognizes v2 markers in schema strings', () => {
  assert.equal(isV2EstimateSchema('v2'), true)
  assert.equal(isV2EstimateSchema('v2-walls'), true)
  assert.equal(isV2EstimateSchema('v2_legacy'), true)
  assert.equal(isV2EstimateSchema('legacy'), false)
  assert.equal(isV2EstimateSchema(null), false)
})

test('shouldUseV2EstimateCatalogSource prefers actual v2 scope rows when schema is blank', () => {
  assert.equal(
    shouldUseV2EstimateCatalogSource({
      sheetSchemaVersion: null,
      roomWallScopes: [{ id: 'wall-1' }],
    }),
    true
  )
  assert.equal(
    shouldUseV2EstimateCatalogSource({
      sheetSchemaVersion: '',
      roomCeilingScopes: [{ id: 'ceil-1' }],
    }),
    true
  )
  assert.equal(
    shouldUseV2EstimateCatalogSource({
      sheetSchemaVersion: '',
      roomTrimScopes: [{ id: 'trim-1' }],
    }),
    true
  )
  assert.equal(
    shouldUseV2EstimateCatalogSource({
      sheetSchemaVersion: 'legacy',
    }),
    false
  )
})

test('resolveEstimateCatalogSource honors an explicit v2 override', () => {
  assert.equal(
    resolveEstimateCatalogSource({
      sheetSchemaVersion: 'legacy',
      catalogSource: 'v2',
    }),
    'v2'
  )
  assert.equal(
    resolveEstimateCatalogSource({
      sheetSchemaVersion: null,
      roomWallScopes: [],
    }),
    'estimate'
  )
})
