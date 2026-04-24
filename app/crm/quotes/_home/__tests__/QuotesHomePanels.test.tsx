import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QuotesHomeCreatePanel } from '../QuotesHomeCreatePanel'
import { QuotesHomeJobList } from '../QuotesHomeJobList'
import { QuotesHomeSelectedJobPanel } from '../QuotesHomeSelectedJobPanel'
import { QuotesHomeVersionList } from '../QuotesHomeVersionList'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('Quotes home panels', () => {
  it('uses CRM button actions for the job-list empty state', () => {
    render(
      <QuotesHomeJobList
        vm={{
          loading: false,
          searchQuery: '',
          selectedJobId: '',
          items: [],
          emptyState: 'no_jobs',
        }}
        onJobQueryChange={() => {}}
        onSelectJob={() => {}}
      />,
    )

    const addContact = screen.getByRole('link', { name: 'Add contact' })
    const openJobs = screen.getByRole('link', { name: 'Open jobs' })

    expect(addContact).toHaveClass('ace-crm-btn', 'ace-crm-btn-primary')
    expect(openJobs).toHaveClass('ace-crm-btn', 'ace-crm-btn-secondary')
  })

  it('uses CRM button actions for version open and delete', () => {
    const onRequestDelete = vi.fn()

    render(
      <QuotesHomeVersionList
        vm={{
          heading: '1 version under this job',
          emptyMessage: null,
          items: [
            {
              id: 'estimate-1',
              title: 'Version A',
              total: '$1,250',
              meta: 'Draft / Standard',
              href: '/crm/quotes/estimate-1',
              deleting: false,
            },
          ],
        }}
        onRequestDelete={onRequestDelete}
      />,
    )

    expect(screen.getByRole('link', { name: 'Open version' })).toHaveClass(
      'ace-crm-btn',
      'ace-crm-btn-primary',
    )

    const deleteButton = screen.getByRole('button', { name: /delete/i })
    expect(deleteButton).toHaveClass('ace-crm-btn', 'ace-crm-btn-danger')

    fireEvent.click(deleteButton)

    expect(onRequestDelete).toHaveBeenCalledWith('estimate-1')
  })

  it('uses the CRM primary button for create version and keeps the local field controls', () => {
    render(
      <QuotesHomeCreatePanel
        vm={{
          creating: false,
          loading: false,
          selectedJobName: 'Kitchen',
          versionKind: 'standard',
          versionName: '',
          canCreate: false,
        }}
        onCreate={() => {}}
        onVersionKindChange={() => {}}
        onVersionNameChange={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Create version' })).toHaveClass(
      'ace-crm-btn',
      'ace-crm-btn-primary',
    )
    expect(
      screen.getByRole('button', { name: 'Create version' }),
    ).toBeDisabled()
    expect(
      screen.getByPlaceholderText(
        'Leave blank for the next default version name',
      ),
    ).toHaveClass('ace-crm-input')
    expect(screen.getByRole('combobox')).toHaveClass('ace-crm-input')
  })

  it('owns the selected-job stats grid locally and no longer uses the page-injected class', () => {
    render(
      <QuotesHomeSelectedJobPanel
        vm={{
          loading: false,
          emptyMessage: null,
          title: 'Kitchen Remodel',
          customerLine: 'Alice / 123 Main',
          jobHref: '/crm/jobs/job-1',
          stats: [
            { label: 'Customer', value: 'Alice' },
            { label: 'Job Status', value: 'Estimate Pending' },
            { label: 'Versions', value: '2' },
          ],
        }}
      />,
    )

    expect(screen.getByRole('link', { name: 'Open job' })).toHaveClass(
      'ace-crm-btn',
      'ace-crm-btn-secondary',
    )
    expect(
      document.querySelector('.quotes-home-selected-job-stats'),
    ).not.toBeNull()
    expect(document.querySelector('.v2-hub-job-stats')).toBeNull()
  })
})
