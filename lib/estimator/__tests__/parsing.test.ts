import assert from 'node:assert/strict'
import test from 'node:test'
import { isUuid } from '../parsing.ts'

test('estimator parsing uses canonical UUID validation', () => {
  assert.equal(isUuid('d4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d'), true)
  assert.equal(isUuid('22222222-2222-2222-2222-222222222222'), true)
  assert.equal(isUuid('not-a-uuid'), false)
})
