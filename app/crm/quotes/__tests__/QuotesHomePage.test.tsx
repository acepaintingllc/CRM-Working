import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  quoteHomeBootstrap,
  quoteHomeJob2Versions,
  quoteHomeJobs,
} from '@/test-support/quoteHomeFixtures'
import QuotesHomePage from '../QuotesHomePage'

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}))

const {
  createQuoteVersion,
  deleteQuoteVersion,
  loadQuoteHomeBootstrap,
  loadQuoteHomeJobs,
  loadQuoteHomeSearch,
  loadQuoteJobVersions,
} = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  deleteQuoteVersion: vi.fn(),
  loadQuoteHomeBootstrap: vi.fn(),
  loadQuoteHomeJobs: vi.fn(),
  loadQuoteHomeSearch: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  deleteQuoteVersion,
  loadQuoteHomeBootstrap,
  loadQuoteHomeJobs,
  loadQuoteHomeSearch,
  loadQuoteJobVersions,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
}

describe('QuotesHomePage', () => {
  beforeEach(() => {
    cleanup()
    push.mockReset()
    createQuoteVersion.mockReset()
    deleteQuoteVersion.mockReset()
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeJobs.mockReset()
    loadQuoteHomeSearch.mockReset()
    loadQuoteJobVersions.mockReset()
    loadQuoteHomeSearch.mockResolvedValue({ query: '', items: [] })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the SSR bootstrap view without issuing a client bootstrap request', () => {
    render(<QuotesHomePage initialData={quoteHomeBootstrap} />)

    expect(screen.getByRole('heading', { name: 'Quote Home' })).toBeInTheDocument()
    expect(screen.getByText('Shared CRM shell')).toBeInTheDocument()
    expect(
      screen.getByText('3 total versions · 1 drafts · 1 sent/awaiting · 1 live')
    ).toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: 'Jobs' })).toHaveAttribute(
      'aria-activedescendant',
      'quote-home-job-job-1'
    )
    expect(screen.getByRole('option', { name: /Kitchen.*selected/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Garage/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2 versions under this job' })).toBeInTheDocument()
    expect(screen.getByText('Version B')).toBeInTheDocument()
    expect(screen.getByText('Version A')).toBeInTheDocument()
    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
  })

  it('shows the client fallback loading state and then hydrates when no initial data is provided', async () => {
    const bootstrap = deferred<typeof quoteHomeBootstrap>()
    loadQuoteHomeBootstrap.mockReturnValueOnce(bootstrap.promise)

    render(<QuotesHomePage />)

    expect(screen.getByRole('heading', { name: 'Quote Home' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading jobs...')
    expect(screen.getByRole('button', { name: 'Create version' })).toBeDisabled()
    expect(screen.getAllByText('...')).toHaveLength(4)

    bootstrap.resolve(quoteHomeBootstrap)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Kitchen.*selected/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: '2 versions under this job' })).toBeInTheDocument()
    expect(screen.queryByText('Loading jobs...')).not.toBeInTheDocument()
    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
  })

  it('keeps the selected job stable when a jobs query changes the visible job list', async () => {
    loadQuoteHomeJobs.mockResolvedValueOnce({
      query: 'garage',
      limit: 25,
      next_cursor: null,
      items: [quoteHomeJobs[1]],
    })

    render(<QuotesHomePage initialData={quoteHomeBootstrap} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search jobs' }), {
      target: { value: 'garage' },
    })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Garage/i })).toBeInTheDocument()
    })

    expect(screen.queryByRole('option', { name: /Kitchen/i })).not.toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: 'Jobs' })).not.toHaveAttribute(
      'aria-activedescendant'
    )
    expect(screen.getByRole('heading', { name: 'Kitchen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2 versions under this job' })).toBeInTheDocument()
    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({
      query: 'garage',
      limit: 25,
      cursor: undefined,
    })
  })

  it('selects a visible job and loads that job version list', async () => {
    loadQuoteJobVersions.mockResolvedValueOnce(quoteHomeJob2Versions)

    render(<QuotesHomePage initialData={quoteHomeBootstrap} />)

    fireEvent.click(screen.getByRole('option', { name: /Garage/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Garage' })).toBeInTheDocument()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-2')
    expect(screen.getByRole('heading', { name: '1 version under this job' })).toBeInTheDocument()
    expect(screen.getByText('Garage Alt')).toBeInTheDocument()
    expect(screen.queryByText('Version A')).not.toBeInTheDocument()
  })

  it('surfaces a selected-job version load failure and retries from the page', async () => {
    loadQuoteJobVersions
      .mockRejectedValueOnce(new Error('versions failed'))
      .mockResolvedValueOnce(quoteHomeJob2Versions)

    render(<QuotesHomePage initialData={quoteHomeBootstrap} />)

    fireEvent.click(screen.getByRole('option', { name: /Garage/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Versions failed to load')
    })
    expect(screen.getByText('versions failed')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry versions' }))

    await waitFor(() => {
      expect(screen.getByText('Garage Alt')).toBeInTheDocument()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Versions failed to load')).not.toBeInTheDocument()
  })
})
