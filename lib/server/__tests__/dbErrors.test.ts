import assert from 'node:assert/strict'
import test from 'node:test'
import {
  exposeServerErrorMessage,
  hasUniqueConstraintConflict,
} from '../dbErrors.ts'

test('hasUniqueConstraintConflict detects unique constraint errors', () => {
  assert.equal(
    hasUniqueConstraintConflict({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    }),
    true
  )
  assert.equal(
    hasUniqueConstraintConflict({ code: 'PGRST116', message: 'Row not found' }),
    false
  )
  assert.equal(hasUniqueConstraintConflict(null), false)
})

test('exposeServerErrorMessage hides db text in production', () => {
  assert.equal(exposeServerErrorMessage('fk violation', false, 'Unable to delete customer'), 'fk violation')
  assert.equal(
    exposeServerErrorMessage('fk violation', true, 'Unable to delete customer'),
    'Unable to delete customer'
  )
})
