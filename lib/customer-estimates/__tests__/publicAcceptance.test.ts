import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEstimatePublicAcceptanceRecord } from '../publicAcceptance.ts'

test('normalizeEstimatePublicAcceptanceRecord returns accepted signer metadata', () => {
  assert.deepEqual(
    normalizeEstimatePublicAcceptanceRecord({
      legal_name: 'Jordan Customer',
      signature_type: 'typed',
      signature_value: 'Jordan Customer',
      accepted_at: '2026-04-15T15:30:00.000Z',
      user_agent: 'browser',
      ip: '127.0.0.1',
    }),
    {
      legal_name: 'Jordan Customer',
      signature_type: 'typed',
      signature_value: 'Jordan Customer',
      accepted_terms: true,
      accepted_at: '2026-04-15T15:30:00.000Z',
      user_agent: 'browser',
      ip: '127.0.0.1',
    }
  )
})

test('normalizeEstimatePublicAcceptanceRecord ignores incomplete metadata', () => {
  assert.equal(
    normalizeEstimatePublicAcceptanceRecord({
      legal_name: 'Jordan Customer',
      signature_type: 'typed',
      accepted_at: '2026-04-15T15:30:00.000Z',
    }),
    null
  )
})
