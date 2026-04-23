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
})
