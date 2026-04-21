import assert from 'node:assert/strict'
import test from 'node:test'
import { customerRecordToFormValues, parseLegacyCustomerAddress } from '../forms.ts'

test('parseLegacyCustomerAddress parses canonical legacy strings', () => {
  const parsed = parseLegacyCustomerAddress('123 Main St, Newburgh, IN 47630')
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.deepEqual(parsed.value, {
      street: '123 Main St',
      city: 'Newburgh',
      state: 'IN',
      zip: '47630',
    })
  }
})

test('customerRecordToFormValues prefers structured address fields', () => {
  const result = customerRecordToFormValues({
    name: 'Taylor Jones',
    email: 'taylor@example.com',
    phone: '812-555-0100',
    street: '123 Main St',
    city: 'Newburgh',
    state: 'IN',
    zip: '47630',
    address: 'legacy value',
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.values.street, '123 Main St')
    assert.equal(result.value.values.city, 'Newburgh')
    assert.equal(result.value.legacyAddressCleanup, null)
  }
})

test('customerRecordToFormValues exposes malformed legacy addresses as cleanup state', () => {
  const result = customerRecordToFormValues({
    name: 'Taylor Jones',
    address: '123 Main St Newburgh IN',
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.values.street, '')
    assert.match(result.value.legacyAddressCleanup?.warning ?? '', /older format/i)
    assert.equal(result.value.legacyAddressCleanup?.legacyAddress, '123 Main St Newburgh IN')
  }
})
