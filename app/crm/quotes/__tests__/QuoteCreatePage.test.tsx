import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuoteCreatePage from '../QuoteCreatePage'

const { push, getSearchParam } = vi.hoisted(() => ({
  push: vi.fn(),
  getSearchParam: vi.fn(),
}))

const { createQuoteVersion, loadQuoteCreateJobContext, loadQuoteJobVersions } = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  loadQuoteCreateJobContext: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
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

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  loadQuoteCreateJobContext,
  loadQuoteJobVersions,
}))

describe('QuoteCreatePage', () => {
  beforeEach(() => {
    push.mockReset()
    getSearchParam.mockReset()
    createQuoteVersion.mockReset()
    loadQuoteCreateJobContext.mockReset()
    loadQuoteJobVersions.mockReset()
    getSearchParam.mockReturnValue('job-1')
  })

  afterEach(() => {
    cleanup()
  })

  it('loads the selected job, loads only that job versions, and creates through shared rules', async () => {
    loadQuoteCreateJobContext.mockResolvedValue({
      job: {
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        title: 'Kitchen',
        eligibility: { eligible: true, reason: 'eligible' },
      },
    })
    loadQuoteJobVersions.mockResolvedValue({
      job_id: 'job-1',
      total_versions: 2,
      items: [
        {
          estimate_id: 'estimate-2',
          job_id: 'job-1',
          customer_id: 'customer-1',
          version_name: 'Version B',
          version_state: 'live',
          version_kind: 'revision',
          version_sort_order: 2,
          job_title: 'Kitchen',
          customer_name: 'Alice',
          final_total: 1300,
          updated_at: '2026-04-21T10:00:00.000Z',
          created_at: '2026-04-20T10:00:00.000Z',
          is_sent_estimate: false,
        },
        {
          estimate_id: 'estimate-1',
          job_id: 'job-1',
          customer_id: 'customer-1',
          version_name: 'Version A',
          version_state: 'draft',
          version_kind: 'standard',
          version_sort_order: 1,
          job_title: 'Kitchen',
          customer_name: 'Alice',
          final_total: 500,
          updated_at: '2026-04-20T10:00:00.000Z',
          created_at: '2026-04-19T10:00:00.000Z',
          is_sent_estimate: false,
        },
      ],
    })
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getByText('Existing Quotes (2)')).toBeInTheDocument()
    })

    expect(loadQuoteCreateJobContext).toHaveBeenCalledWith('job-1')
    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1')
    expect(screen.getByText('Alice · 123 Main')).toBeInTheDocument()
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

  it('disables creation when the selected job is not eligible', async () => {
    loadQuoteCreateJobContext.mockResolvedValue({
      job: {
        id: 'job-1',
        customer_id: null,
        customer_name: 'Alice',
        customer_address: '123 Main',
        title: 'Kitchen',
        eligibility: { eligible: false, reason: 'missing_customer' },
      },
    })
    loadQuoteJobVersions.mockResolvedValue({ job_id: 'job-1', total_versions: 0, items: [] })

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getByText('Kitchen')).toBeInTheDocument()
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

  it('shows the disabled create flow when no job query param is present', async () => {
    getSearchParam.mockReturnValue(null)

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getByText('Unknown job')).toBeInTheDocument()
    })

    expect(loadQuoteCreateJobContext).not.toHaveBeenCalled()
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
    expect(
      screen.getByText('Open this page from quote home or pass a job query parameter to create a version.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create version' })).toBeDisabled()
  })

  it('shows missing jobs as quote-create data errors', async () => {
    loadQuoteCreateJobContext.mockRejectedValue(new Error('Job not found.'))
    loadQuoteJobVersions.mockResolvedValue({ job_id: 'job-1', total_versions: 0, items: [] })

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getAllByText('Job not found.').length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Create version' })).toBeDisabled()
  })

  it('shows the load error and retries quote creation data loading', async () => {
    loadQuoteCreateJobContext
      .mockRejectedValueOnce(new Error('Load failed'))
      .mockResolvedValueOnce({
        job: {
          id: 'job-1',
          customer_id: 'customer-1',
          customer_name: 'Alice',
          customer_address: '123 Main',
          title: 'Kitchen',
          eligibility: { eligible: true, reason: 'eligible' },
        },
      })
    loadQuoteJobVersions
      .mockRejectedValueOnce(new Error('Load failed'))
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 1,
        items: [
          {
            estimate_id: 'estimate-1',
            job_id: 'job-1',
            customer_id: 'customer-1',
            version_name: 'Version A',
            version_state: 'draft',
            version_kind: 'standard',
            version_sort_order: 1,
            job_title: 'Kitchen',
            customer_name: 'Alice',
            final_total: 500,
            updated_at: '2026-04-20T10:00:00.000Z',
            created_at: '2026-04-19T10:00:00.000Z',
            is_sent_estimate: false,
          },
        ],
      })

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getAllByText('Load failed').length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Existing Quotes (1)')).toBeInTheDocument()
    })
  })
})
