import { describe, expect, it } from 'vitest'
import { buildJobCloseoutReferenceVm } from '../jobCloseoutVm'
import type { JobDetail } from '@/types/jobs/api'

function job(overrides: Partial<JobDetail> = {}): JobDetail {
  return {
    id: 'job-1',
    customer_id: 'customer-1',
    customer_name: 'Taylor Jones',
    customer_address: '123 Main St',
    customer_email: 'taylor@example.com',
    customer_phone: '812-555-0100',
    title: 'Interior repaint',
    description: null,
    status: 'estimate_scheduled',
    estimate_date: null,
    estimate_sent_at: null,
    scheduled_date: null,
    scheduled_end_date: null,
    completed_at: null,
    closeout_notes: null,
    ...overrides,
  }
}

describe('buildJobCloseoutReferenceVm', () => {
  it('hides the closeout reference for active jobs without closeout data', () => {
    expect(buildJobCloseoutReferenceVm({ job: job(), paintLogs: [] })).toBeNull()
  })

  it('shows completed jobs with empty closeout state render data', () => {
    const vm = buildJobCloseoutReferenceVm({
      job: job({ status: 'completed' }),
      paintLogs: [],
    })

    expect(vm).toEqual({
      notes: 'No closeout notes yet.',
      hasNotes: false,
      paintLogs: [],
    })
  })

  it('shows saved notes and paint logs even when the job is not completed', () => {
    const vm = buildJobCloseoutReferenceVm({
      job: job({ closeout_notes: 'Customer requested touch-up notes.' }),
      paintLogs: [
        {
          id: 'paint-1',
          where_used: 'Trim',
          paint_product: 'ProClassic',
          sheen: 'Satin',
          color: 'SW 7005',
          notes: 'Two coats',
        },
      ],
    })

    expect(vm?.notes).toBe('Customer requested touch-up notes.')
    expect(vm?.paintLogs).toEqual([
      {
        key: 'paint-1',
        area: 'Trim',
        product: 'ProClassic',
        sheen: 'Satin',
        color: 'SW 7005',
        notes: 'Two coats',
      },
    ])
  })
})
