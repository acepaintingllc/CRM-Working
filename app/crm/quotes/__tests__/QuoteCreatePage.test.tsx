import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuoteCreatePage from '../QuoteCreatePage'

const { push, getSearchParam } = vi.hoisted(() => ({
  push: vi.fn(),
  getSearchParam: vi.fn(),
}))

const { fetchJobList } = vi.hoisted(() => ({
  fetchJobList: vi.fn(),
}))

const { createQuoteVersion, loadQuoteList } = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  loadQuoteList: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: getSearchParam }),
}))

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

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList,
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  loadQuoteList,
}))

describe('QuoteCreatePage', () => {
  beforeEach(() => {
    push.mockReset()
    getSearchParam.mockReset()
    fetchJobList.mockReset()
    createQuoteVersion.mockReset()
    loadQuoteList.mockReset()
    getSearchParam.mockReturnValue('job-1')
  })

  afterEach(() => {
    cleanup()
  })

  it('loads the preselected job, derives matching versions, and creates through shared rules', async () => {
    fetchJobList.mockResolvedValue([
      {
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        title: 'Kitchen',
        description: null,
        status: 'estimate_pending',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        completed_at: null,
      },
      {
        id: 'job-2',
        customer_id: null,
        customer_name: 'Bob',
        customer_address: '456 Oak',
        title: 'Garage',
        description: null,
        status: 'lead',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        completed_at: null,
      },
    ])
    loadQuoteList.mockResolvedValue({
      estimates: [
        {
          id: 'estimate-1',
          job_id: 'job-1',
          version_name: 'Version A',
          version_state: 'draft',
          version_kind: 'standard',
          updated_at: '2026-04-20T10:00:00.000Z',
        },
        {
          id: 'estimate-2',
          job_id: 'job-1',
          version_name: 'Version B',
          version_state: 'live',
          version_kind: 'revision',
          updated_at: '2026-04-21T10:00:00.000Z',
        },
        {
          id: 'estimate-3',
          job_id: 'job-2',
          version_name: 'Garage Alt',
          version_state: 'draft',
          version_kind: 'alternate',
          updated_at: '2026-04-22T10:00:00.000Z',
        },
      ],
    })
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getByText('Existing Quotes (2)')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Version B').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText('Leave blank for default name'), {
      target: { value: '  Kitchen Split  ' },
    })
    fireEvent.change(screen.getByDisplayValue('Standard'), {
      target: { value: 'split' },
    })
    const createButton = screen
      .getAllByRole('button', { name: 'Create version' })
      .find((button): button is HTMLButtonElement => button instanceof HTMLButtonElement && !button.disabled)
    if (!createButton) {
      throw new Error('Expected an enabled create button')
    }
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(createQuoteVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          job_id: 'job-1',
          customer_id: 'customer-1',
          version_kind: 'split',
        })
      )
      expect(push).toHaveBeenCalledWith('/crm/quotes/estimate-99')
    })
  })

  it('disables creation when the preselected job is not eligible', async () => {
    fetchJobList.mockResolvedValue([
      {
        id: 'job-1',
        customer_id: null,
        customer_name: 'Alice',
        customer_address: '123 Main',
        title: 'Kitchen',
        description: null,
        status: 'lead',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        completed_at: null,
      },
    ])
    loadQuoteList.mockResolvedValue({ estimates: [] })

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getByText('Unknown job')).toBeInTheDocument()
    })

    const disabledCreateButton = screen
      .getAllByRole('button', { name: 'Create version' })
      .find((button): button is HTMLButtonElement => button instanceof HTMLButtonElement && button.disabled)
    if (!disabledCreateButton) {
      throw new Error('Expected a disabled create button')
    }
    expect(disabledCreateButton).toBeDisabled()
    expect(createQuoteVersion).not.toHaveBeenCalled()
  })
})
