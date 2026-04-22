import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCreateQuoteVersionInput,
  buildDefaultQuoteVersionName,
  deriveQuoteVersionsForJob,
  filterEligibleQuoteVersionJobs,
  getQuoteWorkspaceHref,
  normalizeQuoteVersionKind,
} from '../versionCreation.ts'

test('filters eligible jobs by customer id', () => {
  const jobs = [
    { id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' },
    { id: 'job-2', customer_id: null, title: 'Garage' },
    { id: 'job-3', customer_id: '   ', title: 'Bedroom' },
  ]

  assert.deepEqual(filterEligibleQuoteVersionJobs(jobs), [
    { id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' },
  ])
})

test('derives and sorts versions for a selected job', () => {
  const versions = [
    { id: 'estimate-1', job_id: 'job-1', updated_at: '2026-04-20T10:00:00.000Z' },
    { id: 'estimate-2', job_id: 'job-1', updated_at: '2026-04-21T10:00:00.000Z' },
    { id: 'estimate-3', job_id: 'job-2', updated_at: '2026-04-22T10:00:00.000Z' },
  ]

  assert.deepEqual(deriveQuoteVersionsForJob(versions, 'job-1').map((version) => version.id), [
    'estimate-2',
    'estimate-1',
  ])
})

test('builds the create payload with trimmed optional version name', () => {
  const job = { id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' }

  assert.deepEqual(
    buildCreateQuoteVersionInput(job, {
      versionKind: 'split',
      versionName: '  Garage Custom  ',
    }),
    {
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'split',
      version_name: 'Garage Custom',
    }
  )

  assert.deepEqual(
    buildCreateQuoteVersionInput(job, {
      versionKind: 'standard',
      versionName: '   ',
    }),
    {
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'standard',
    }
  )
})

test('normalizes fallback creation rules', () => {
  assert.equal(normalizeQuoteVersionKind('REVISION'), 'revision')
  assert.equal(normalizeQuoteVersionKind('unknown'), 'standard')
  assert.equal(buildDefaultQuoteVersionName(2), 'Quote Version 3')
  assert.equal(getQuoteWorkspaceHref('estimate-9'), '/crm/quotes/estimate-9')
})
