import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
    const { container } = render(
      <QuotesHomeHeader
        vm={{ ...baseVm }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    const settingsMenu = container.querySelector('details') as HTMLDetailsElement

    settingsMenu.open = true
    fireEvent.keyDown(settingsMenu, { key: 'Escape' })

    expect(settingsMenu.open).toBe(false)
  })
})
