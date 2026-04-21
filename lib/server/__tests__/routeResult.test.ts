import assert from 'node:assert/strict'
import test from 'node:test'
import { serviceErrorStatus } from '../routeError.ts'

test('serviceErrorStatus maps shared service results to stable http statuses', () => {
  assert.equal(serviceErrorStatus('invalid_input'), 400)
  assert.equal(serviceErrorStatus('forbidden'), 403)
  assert.equal(serviceErrorStatus('not_found'), 404)
  assert.equal(serviceErrorStatus('conflict'), 409)
  assert.equal(serviceErrorStatus('server_error'), 500)
})
