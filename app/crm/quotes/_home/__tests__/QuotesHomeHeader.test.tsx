import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuotesHomeHeader } from '../QuotesHomeHeader'

const baseVm = {
  heroSummaryText: '3 total versions',
  searchFocused: true,
  searchQuery: 'revision',
  searchLoading: false,
  searchEmptyMessage: null,
  searchErrorMessage: null,
  searchCanRetry: false,
  searchResults: [],
}

describe('QuotesHomeHeader', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows a loading state for search results', () => {
    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchLoading: true }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    expect(screen.getByText('Searching quote versions')).toBeInTheDocument()
  })

  it('shows an empty search state separately from errors', () => {
    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchEmptyMessage: 'No quote versions match "revision".' }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    expect(screen.getByText('No matching quote versions')).toBeInTheDocument()
    expect(screen.getByText('No quote versions match "revision".')).toBeInTheDocument()
  })

  it('shows a retryable search error state', () => {
    const onSearchRetry = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchErrorMessage: 'search failed', searchCanRetry: true }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={onSearchRetry}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry search' }))

    expect(screen.getByText('Search results failed to load')).toBeInTheDocument()
    expect(screen.getByText('search failed')).toBeInTheDocument()
    expect(onSearchRetry).toHaveBeenCalledTimes(1)
  })

  it('closes the search results when clicking outside the search container', () => {
    const onSearchFocusedChange = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{ ...baseVm }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.mouseDown(document.body)

    expect(onSearchFocusedChange).toHaveBeenCalledWith(false)
  })

  it('keeps the dropdown open long enough for a result link click to register', () => {
    const onSearchFocusedChange = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{
          ...baseVm,
          searchResults: [
            {
              id: 'estimate-1',
              href: '/crm/quotes/estimate-1',
              title: 'Kitchen revision',
              meta: 'Job 101',
            },
          ],
        }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    const resultLink = screen.getByRole('link', { name: /Kitchen revision/i })

    fireEvent.mouseDown(resultLink)

    expect(onSearchFocusedChange).not.toHaveBeenCalledWith(false)
  })

  it('closes the settings menu on Escape', () => {
    render(
      <QuotesHomeHeader
        vm={{ ...baseVm }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    const settingsToggle = screen.getByRole('button', { name: 'Settings & Constants' })

    fireEvent.click(settingsToggle)

    expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument()

    fireEvent.keyDown(settingsToggle, { key: 'Escape' })

    expect(screen.queryByRole('link', { name: 'Defaults' })).not.toBeInTheDocument()
    expect(settingsToggle).toHaveFocus()
  })

  it('opens and closes the settings panel on toggle button click', () => {
    render(
      <QuotesHomeHeader
        vm={{ ...baseVm }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    const settingsToggle = screen.getByRole('button', { name: 'Settings & Constants' })

    expect(screen.queryByRole('link', { name: 'Defaults' })).not.toBeInTheDocument()

    fireEvent.click(settingsToggle)

    expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument()

    fireEvent.click(settingsToggle)

    expect(screen.queryByRole('link', { name: 'Defaults' })).not.toBeInTheDocument()
  })

  it('closes the settings panel on outside mousedown', () => {
    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchFocused: false }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings & Constants' }))

    expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('link', { name: 'Defaults' })).not.toBeInTheDocument()
  })

  it('keeps settings and search overlays independent when either is opened', () => {
    const onSearchFocusedChange = vi.fn()

    const { rerender } = render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchLoading: true }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings & Constants' }))

    expect(screen.getByText('Searching quote versions')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument()
    expect(onSearchFocusedChange).not.toHaveBeenCalledWith(false)

    rerender(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchFocused: false }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.focus(screen.getByRole('textbox', { name: 'Search quote versions' }))

    expect(onSearchFocusedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument()
  })

  it('renders all settings links when the panel is open', () => {
    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchFocused: false }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings & Constants' }))

    expect(screen.getByRole('link', { name: 'Defaults' })).toHaveAttribute(
      'href',
      '/crm/quotes/defaults'
    )
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/crm/quotes/products'
    )
    expect(screen.getByRole('link', { name: 'Rates & Flags' })).toHaveAttribute(
      'href',
      '/crm/quotes/rates'
    )
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/crm/settings'
    )
  })
})
