import { describe, expect, it } from 'vitest'
import {
  buildSearchSections,
  getActivityStatusDisplay,
  getReminderToneDisplay,
} from '../display'

describe('display helpers', () => {
  it('maps activity statuses to badge display tokens', () => {
    expect(getActivityStatusDisplay('completed')).toEqual({
      badge: '✓',
      background: 'var(--crm-success-bg)',
      color: 'var(--crm-success-text)',
    })
    expect(getActivityStatusDisplay('lost')).toEqual({
      badge: '✕',
      background: 'var(--crm-danger-bg)',
      color: 'var(--crm-danger-text)',
    })
    expect(getActivityStatusDisplay('estimate_sent')).toEqual({
      badge: '•',
      background: 'var(--crm-border)',
      color: 'var(--crm-muted)',
    })
  })

  it('maps reminder tones to style tokens', () => {
    expect(getReminderToneDisplay('danger')).toEqual({
      borderColor: 'var(--crm-danger-border)',
      background: 'var(--crm-danger-bg)',
      textColor: 'var(--crm-danger-text)',
    })
    expect(getReminderToneDisplay('default')).toEqual({
      borderColor: 'var(--crm-border)',
      background: 'transparent',
      textColor: 'var(--crm-muted)',
    })
  })

  it('builds grouped customer and job search sections', () => {
    expect(
      buildSearchSections({
        customers: [
          {
            id: 'customer-1',
            name: 'Alice Jones',
            email: 'alice@example.com',
            phone: '555-1111',
            address: '123 Main St',
          },
        ],
        jobs: [
          {
            id: 'job-1',
            title: 'Kitchen repaint',
            customer_name: 'Alice Jones',
            customer_address: '123 Main St',
            status: 'estimate_sent',
            estimate_total_amount: 1200,
          },
        ],
      })
    ).toEqual([
      {
        key: 'customers',
        label: 'Customers',
        items: [
          {
            key: 'customer-1',
            href: '/crm/customers/customer-1',
            title: 'Alice Jones',
            subtitle: 'alice@example.com • 555-1111',
          },
        ],
      },
      {
        key: 'jobs',
        label: 'Jobs',
        items: [
          {
            key: 'job-1',
            href: '/crm/jobs/job-1',
            title: 'Kitchen repaint',
            subtitle: 'Alice Jones',
          },
        ],
      },
    ])
  })
})
