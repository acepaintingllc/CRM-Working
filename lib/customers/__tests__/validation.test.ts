import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerAddress } from '../validation.ts'

test('buildCustomerAddress assembles canonical address fields', () => {
  assert.equal(
    buildCustomerAddress({ street: '123 Main St', city: 'Newburgh', state: 'IN', zip: '47630' }),
    '123 Main St, Newburgh, IN 47630'
  )
  assert.equal(buildCustomerAddress({ address: 'Legacy Address' }), 'Legacy Address')
  assert.equal(buildCustomerAddress({ street: '', city: '', state: '', zip: '' }), null)
})
