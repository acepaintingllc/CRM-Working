import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuoteCreatePage from '../QuoteCreatePage'

const { push, getSearchParam } = vi.hoisted(() => ({
  push: vi.fn(),
  getSearchParam: vi.fn(),
}))

const { fetchJobList, loadJobRecord } = vi.hoisted(() => ({
  fetchJobList: vi.fn(),
  loadJobRecord: vi.fn(),
}))

const { createQuoteVersion, loadQuoteJobVersions } = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: getSearchParam }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList,
  loadJobRecord,
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  loadQuoteJobVersions,
}))

describe('QuoteCreatePage', () => {
  beforeEach(() => {
    push.mockReset()
    getSearchParam.mockReset()
    fetchJobList.mockReset()
    loadJobRecord.mockReset()
    createQuoteVersion.mockReset()
    loadQuoteJobVersions.mockReset()
    getSearchParam.mockReturnValue('job-1')
  })

  afterEach(() => {
    cleanup()
  })

  it('loads the selected job, loads only that job versions, and creates through shared rules', async () => {
    loadJobRecord.mockResolvedValue({
      id: 'job-1',
      customer_id: 'customer-1',
      customer_name: 'Alice',
      customer_address: '123 Main',
      customer_email: null,
      customer_phone: null,
      title: 'Kitchen',
      description: null,
      status: 'estimate_pending',
      estimate_date: null,
      estimate_sent_at: null,
      scheduled_date: null,
      scheduled_end_date: null,
      completed_at: null,
      linked_estimate_id: null,
      closeout_notes: null,
      linked_estimates: [],
    })
    loadQuoteJobVersions.mockResolvedValue({
      job_id: 'job-1',
      total_versions: 2,
      limit: 25,
      next_cursor: null,
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

    expect(fetchJobList).not.toHaveBeenCalled()
    expect(loadJobRecord).toHaveBeenCalledWith('job-1')
    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1', {
      cursor: undefined,
      limit: 25,
    })
    expect(screen.getByText(/Alice .*123 Main/)).toBeInTheDocument()
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
    if (!createButton) throw new Error('Expected an enabled create button')

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
    loadJobRecord.mockResolvedValue({
      id: 'job-1',
      customer_id: null,
      customer_name: 'Alice',
      customer_address: '123 Main',
      customer_email: null,
      customer_phone: null,
      title: 'Kitchen',
      description: null,
      status: 'lead',
      estimate_date: null,
      estimate_sent_at: null,
      scheduled_date: null,
      scheduled_end_date: null,
      completed_at: null,
      linked_estimate_id: null,
      closeout_notes: null,
      linked_estimates: [],
    })
    loadQuoteJobVersions.mockResolvedValue({
      job_id: 'job-1',
      total_versions: 0,
      limit: 25,
      next_cursor: null,
      items: [],
    })

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getByText('Unknown job')).toBeInTheDocument()
    })

    const disabledCreateButton = screen
      .getAllByRole('button', { name: 'Create version' })
      .find((button): button is HTMLButtonElement => button instanceof HTMLButtonElement && button.disabled)
    if (!disabledCreateButton) throw new Error('Expected a disabled create button')

    expect(disabledCreateButton).toBeDisabled()
    expect(createQuoteVersion).not.toHaveBeenCalled()
  })

  it('shows the disabled create flow when no job query param is present', async () => {
    getSearchParam.mockReturnValue(null)

    render(<QuoteCreatePage />)

    await waitFor(() => {
      expect(screen.getByText('Unknown job')).toBeInTheDocument()
    })

    expect(fetchJobList).not.toHaveBeenCalled()
    expect(loadJobRecord).not.toHaveBeenCalled()
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
    expect(
      screen.getByText('Open this page from quote home or pass a job query parameter to create a version.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create version' })).toBeDisabled()
  })

  it('shows the load error and retries quote creation data loading', async () => {
    loadJobRecord
      .mockRejectedValueOnce(new Error('Load failed'))
      .mockResolvedValueOnce({
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        customer_email: null,
        customer_phone: null,
        title: 'Kitchen',
        description: null,
        status: 'estimate_pending',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        scheduled_end_date: null,
        completed_at: null,
        linked_estimate_id: null,
        closeout_notes: null,
        linked_estimates: [],
      })
    loadQuoteJobVersions
      .mockRejectedValueOnce(new Error('Load failed'))
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 1,
        limit: 25,
        next_cursor: null,
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
