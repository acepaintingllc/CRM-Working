import type { CrmHomeSearchResults } from '@/lib/crm/home/types'

export function getActivityStatusDisplay(status: string | null) {
  if (status === 'completed') {
    return {
      badge: '\u2713',
      background: 'var(--crm-success-bg)',
      color: 'var(--crm-success-text)',
    }
  }

  if (status === 'lost') {
    return {
      badge: '\u2715',
      background: 'var(--crm-danger-bg)',
      color: 'var(--crm-danger-text)',
    }
  }

  return {
    badge: '\u2022',
    background: 'var(--crm-border)',
    color: 'var(--crm-muted)',
  }
}

export function getReminderToneDisplay(tone: 'danger' | 'default') {
  return {
    borderColor: tone === 'danger' ? 'var(--crm-danger-border)' : 'var(--crm-border)',
    background: tone === 'danger' ? 'var(--crm-danger-bg)' : 'transparent',
    textColor: tone === 'danger' ? 'var(--crm-danger-text)' : 'var(--crm-muted)',
  }
}

export function buildSearchSections(results: CrmHomeSearchResults) {
  const sections: Array<{
    key: 'customers' | 'jobs'
    label: 'Customers' | 'Jobs'
    items: Array<{
      key: string
      href: string
      title: string
      subtitle: string | null
    }>
  }> = []

  if (results.customers.length > 0) {
    sections.push({
      key: 'customers',
      label: 'Customers',
      items: results.customers.map((customer) => ({
        key: customer.id,
        href: `/crm/customers/${customer.id}`,
        title: customer.name ?? 'Unnamed customer',
        subtitle:
          customer.email || customer.phone
            ? [customer.email, customer.phone].filter(Boolean).join(' \u2022 ')
            : null,
      })),
    })
  }

  if (results.jobs.length > 0) {
    sections.push({
      key: 'jobs',
      label: 'Jobs',
      items: results.jobs.map((job) => ({
        key: job.id,
        href: `/crm/jobs/${job.id}`,
        title: job.title ?? 'Untitled job',
        subtitle: job.customer_name ?? null,
      })),
    })
  }

  return sections
}
