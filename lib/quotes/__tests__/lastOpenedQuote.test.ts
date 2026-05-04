import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLastOpenedQuoteRecord,
  lastOpenedQuoteStorageKey,
  readLastOpenedQuote,
  resolveLastOpenedQuoteForOrg,
  writeLastOpenedQuote,
} from '../lastOpenedQuote.ts'

test('builds a last opened quote record from loaded estimate and job metadata', () => {
  assert.deepEqual(
    buildLastOpenedQuoteRecord({
      openedAt: '2026-04-28T12:00:00.000Z',
      estimate: {
        id: 'estimate-1',
        org_id: 'org-1',
        job_id: 'job-1',
        version_name: 'Kitchen Revision',
        version_state: 'draft',
        version_kind: 'revision',
        updated_at: '2026-04-28T11:00:00.000Z',
      },
      job: {
        id: 'job-1',
        title: 'Kitchen',
        status: 'estimate_pending',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        customer_email: null,
        customer_phone: null,
      },
    }),
    {
      estimate_id: 'estimate-1',
      org_id: 'org-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Kitchen Revision',
      version_state: 'draft',
      version_kind: 'revision',
      version_sort_order: 0,
      job_title: 'Kitchen',
      customer_name: 'Alice',
      final_total: null,
      updated_at: '2026-04-28T11:00:00.000Z',
      created_at: null,
      is_sent_estimate: false,
      opened_at: '2026-04-28T12:00:00.000Z',
    }
  )
})

test('round-trips valid last opened quote records and ignores malformed storage', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
  const record = buildLastOpenedQuoteRecord({
    openedAt: '2026-04-28T12:00:00.000Z',
    estimate: {
      id: 'estimate-1',
      org_id: 'org-1',
      job_id: 'job-1',
      version_name: null,
      version_state: null,
      updated_at: null,
    },
    job: null,
  })

  assert.notEqual(record, null)
  writeLastOpenedQuote(storage, record!)
  assert.deepEqual(readLastOpenedQuote(storage), record)

  values.set(lastOpenedQuoteStorageKey, '{')
  assert.equal(readLastOpenedQuote(storage), null)

  values.set(
    lastOpenedQuoteStorageKey,
    JSON.stringify({ estimate_id: 'estimate-1', job_id: 'job-1' })
  )
  assert.equal(readLastOpenedQuote(storage), null)
})

test('returns a stored last opened quote only when it matches the active org', () => {
  const record = buildLastOpenedQuoteRecord({
    estimate: {
      id: 'estimate-1',
      org_id: 'org-1',
      job_id: 'job-1',
      version_name: 'Kitchen Revision',
      version_state: 'draft',
      updated_at: null,
    },
    job: null,
  })

  assert.notEqual(record, null)
  assert.deepEqual(resolveLastOpenedQuoteForOrg(record, 'org-1'), record)
  assert.equal(resolveLastOpenedQuoteForOrg(record, 'org-2'), null)
  assert.equal(resolveLastOpenedQuoteForOrg(record, null), null)
})
