import { describe, expect, it } from 'vitest'
import {
  buildCreateQuoteVersionInput,
  buildDefaultQuoteVersionName,
  deriveQuoteVersionsForJob,
  filterEligibleQuoteVersionJobs,
  getQuoteWorkspaceHref,
  normalizeQuoteVersionKind,
} from '../versionCreation'

describe('versionCreation', () => {
  it('filters eligible jobs by customer id', () => {
    const jobs = [
      { id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' },
      { id: 'job-2', customer_id: null, title: 'Garage' },
      { id: 'job-3', customer_id: '   ', title: 'Bedroom' },
    ]

    expect(filterEligibleQuoteVersionJobs(jobs)).toEqual([
      { id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' },
    ])
  })

  it('derives and sorts versions for a selected job', () => {
    const versions = [
      { id: 'estimate-1', job_id: 'job-1', updated_at: '2026-04-20T10:00:00.000Z' },
      { id: 'estimate-2', job_id: 'job-1', updated_at: '2026-04-21T10:00:00.000Z' },
      { id: 'estimate-3', job_id: 'job-2', updated_at: '2026-04-22T10:00:00.000Z' },
    ]

    expect(deriveQuoteVersionsForJob(versions, 'job-1').map((version) => version.id)).toEqual([
      'estimate-2',
      'estimate-1',
    ])
  })

  it('builds the create payload with trimmed optional version name', () => {
    const job = { id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' }

    expect(
      buildCreateQuoteVersionInput(job, {
        versionKind: 'split',
        versionName: '  Garage Custom  ',
      })
    ).toEqual({
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'split',
      version_name: 'Garage Custom',
    })

    expect(
      buildCreateQuoteVersionInput(job, {
        versionKind: 'standard',
        versionName: '   ',
      })
    ).toEqual({
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'standard',
    })
  })

  it('normalizes fallback creation rules', () => {
    expect(normalizeQuoteVersionKind('REVISION')).toBe('revision')
    expect(normalizeQuoteVersionKind('unknown')).toBe('standard')
    expect(buildDefaultQuoteVersionName(2)).toBe('Quote Version 3')
    expect(getQuoteWorkspaceHref('estimate-9')).toBe('/crm/quotes/estimate-9')
  })
})
