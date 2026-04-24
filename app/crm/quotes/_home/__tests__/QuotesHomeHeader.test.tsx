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
    expect(screen.getByRole('combobox', { name: 'Search quote versions' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByRole('listbox', { name: 'Quote search results' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByRole('status')).toHaveTextContent('Searching quote versions')
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
    expect(screen.getByRole('status')).toHaveTextContent('No matching quote versions')
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

    expect(screen.getByRole('alert')).toHaveTextContent('Search results failed to load')
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

  it('opens search on focus and reports query changes', () => {
    const onSearchFocusedChange = vi.fn()
    const onSearchQueryChange = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchFocused: false, searchQuery: '' }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={onSearchQueryChange}
        onSearchRetry={() => {}}
      />
    )

    const searchInput = screen.getByRole('combobox', { name: 'Search quote versions' })

    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'kitchen' } })

    expect(onSearchFocusedChange).toHaveBeenCalledWith(true)
    expect(onSearchQueryChange).toHaveBeenCalledWith('kitchen')
    expect(searchInput).toHaveAttribute('aria-expanded', 'false')
    expect(searchInput).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('exposes search results as combobox options', () => {
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
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    const searchInput = screen.getByRole('combobox', { name: 'Search quote versions' })
    const results = screen.getByRole('listbox', { name: 'Quote search results' })
    const option = screen.getByRole('option', { name: /Kitchen revision/i })

    expect(searchInput).toHaveAttribute('aria-expanded', 'true')
    expect(searchInput).toHaveAttribute('aria-controls', results.id)
    expect(option).toHaveAttribute('href', '/crm/quotes/estimate-1')
    expect(option).toHaveAttribute('aria-selected', 'false')
  })

  it('closes search results on Escape', () => {
    const onSearchFocusedChange = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{ ...baseVm }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search quote versions' }), {
      key: 'Escape',
    })

    expect(onSearchFocusedChange).toHaveBeenCalledWith(false)
  })

  it('closes search results when focus leaves the search container', () => {
    const onSearchFocusedChange = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{ ...baseVm }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    const searchInput = screen.getByRole('combobox', { name: 'Search quote versions' })
    const settingsToggle = screen.getByRole('button', { name: 'Settings & Constants' })

    fireEvent.blur(searchInput, { relatedTarget: settingsToggle })

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

    const resultLink = screen.getByRole('option', { name: /Kitchen revision/i })

    fireEvent.mouseDown(resultLink)

    expect(onSearchFocusedChange).not.toHaveBeenCalledWith(false)
  })

  it('closes search results after a result is activated', () => {
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

    fireEvent.click(screen.getByRole('option', { name: /Kitchen revision/i }))

    expect(onSearchFocusedChange).toHaveBeenCalledWith(false)
  })

  it('keeps the dropdown open long enough for retry clicks to register', () => {
    const onSearchFocusedChange = vi.fn()
    const onSearchRetry = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchErrorMessage: 'search failed', searchCanRetry: true }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={onSearchRetry}
      />
    )

    const retryButton = screen.getByRole('button', { name: 'Retry search' })

    fireEvent.mouseDown(retryButton)
    fireEvent.click(retryButton)

    expect(onSearchFocusedChange).not.toHaveBeenCalledWith(false)
    expect(onSearchRetry).toHaveBeenCalledTimes(1)
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

    expect(settingsToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Defaults' })).toBeInTheDocument()

    fireEvent.keyDown(settingsToggle, { key: 'Escape' })

    expect(settingsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menuitem', { name: 'Defaults' })).not.toBeInTheDocument()
    expect(settingsToggle).toHaveFocus()
  })

  it('closes the settings menu on Escape from inside the menu and restores focus', () => {
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

    const defaults = screen.getByRole('menuitem', { name: 'Defaults' })
    expect(defaults).toHaveFocus()

    fireEvent.keyDown(defaults, { key: 'Escape' })

    expect(screen.queryByRole('menuitem', { name: 'Defaults' })).not.toBeInTheDocument()
    expect(settingsToggle).toHaveFocus()
  })

  it('moves focus through settings menu items with arrow keys', () => {
    render(
      <QuotesHomeHeader
        vm={{ ...baseVm }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings & Constants' }))

    const defaults = screen.getByRole('menuitem', { name: 'Defaults' })
    const products = screen.getByRole('menuitem', { name: 'Products' })

    expect(defaults).toHaveFocus()

    fireEvent.keyDown(defaults, { key: 'ArrowDown' })

    expect(products).toHaveFocus()
  })

  it('opens the settings menu from arrow keys and supports Home, End, and wrapping', () => {
    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchFocused: false }}
        onSearchFocusedChange={() => {}}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    const settingsToggle = screen.getByRole('button', { name: 'Settings & Constants' })

    fireEvent.keyDown(settingsToggle, { key: 'ArrowUp' })

    const defaults = screen.getByRole('menuitem', { name: 'Defaults' })
    const products = screen.getByRole('menuitem', { name: 'Products' })
    const rates = screen.getByRole('menuitem', { name: 'Rates & Flags' })
    const settings = screen.getByRole('menuitem', { name: 'Settings' })

    expect(settings).toHaveFocus()

    fireEvent.keyDown(settings, { key: 'Home' })
    expect(defaults).toHaveFocus()

    fireEvent.keyDown(defaults, { key: 'End' })
    expect(settings).toHaveFocus()

    fireEvent.keyDown(settings, { key: 'ArrowDown' })
    expect(defaults).toHaveFocus()

    fireEvent.keyDown(defaults, { key: 'ArrowUp' })
    expect(settings).toHaveFocus()

    fireEvent.keyDown(settings, { key: 'Home' })
    fireEvent.keyDown(defaults, { key: 'ArrowDown' })
    expect(products).toHaveFocus()

    fireEvent.keyDown(products, { key: 'ArrowDown' })
    expect(rates).toHaveFocus()
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

    expect(settingsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menuitem', { name: 'Defaults' })).not.toBeInTheDocument()

    fireEvent.click(settingsToggle)

    expect(settingsToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Quote settings' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Defaults' })).toBeInTheDocument()

    fireEvent.click(settingsToggle)

    expect(settingsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menuitem', { name: 'Defaults' })).not.toBeInTheDocument()
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

    expect(screen.getByRole('menuitem', { name: 'Defaults' })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('menuitem', { name: 'Defaults' })).not.toBeInTheDocument()
  })

  it('closes both active overlays on outside mousedown', () => {
    const onSearchFocusedChange = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchLoading: true }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings & Constants' }))

    expect(screen.getByText('Searching quote versions')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Defaults' })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(onSearchFocusedChange).toHaveBeenCalledWith(false)
    expect(screen.queryByRole('menuitem', { name: 'Defaults' })).not.toBeInTheDocument()
  })

  it('keeps settings open when search opens', () => {
    const onSearchFocusedChange = vi.fn()

    render(
      <QuotesHomeHeader
        vm={{ ...baseVm, searchFocused: false }}
        onSearchFocusedChange={onSearchFocusedChange}
        onSearchQueryChange={() => {}}
        onSearchRetry={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings & Constants' }))
    fireEvent.focus(screen.getByRole('combobox', { name: 'Search quote versions' }))

    expect(onSearchFocusedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('menuitem', { name: 'Defaults' })).toBeInTheDocument()
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

    expect(screen.getByRole('menuitem', { name: 'Defaults' })).toHaveAttribute(
      'href',
      '/crm/quotes/defaults'
    )
    expect(screen.getByRole('menuitem', { name: 'Products' })).toHaveAttribute(
      'href',
      '/crm/quotes/products'
    )
    expect(screen.getByRole('menuitem', { name: 'Rates & Flags' })).toHaveAttribute(
      'href',
      '/crm/quotes/rates'
    )
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/crm/settings'
    )
  })
})
