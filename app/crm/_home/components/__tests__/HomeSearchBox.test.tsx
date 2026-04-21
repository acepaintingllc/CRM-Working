import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentPropsWithoutRef } from 'react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeSearchBox } from '../HomeSearchBox'

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

afterEach(() => {
  cleanup()
})

const sections = [
  {
    key: 'customers' as const,
    label: 'Customers' as const,
    items: [
      {
        key: 'customer-1',
        href: '/crm/customers/customer-1',
        title: 'Alice Jones',
        subtitle: 'alice@example.com • 555-1111',
      },
    ],
  },
  {
    key: 'jobs' as const,
    label: 'Jobs' as const,
    items: [
      {
        key: 'job-1',
        href: '/crm/jobs/job-1',
        title: 'Kitchen repaint',
        subtitle: 'Alice Jones',
      },
    ],
  },
]

function SearchBoxHarness() {
  const [query, setQuery] = useState('Alice')
  return (
    <HomeSearchBox
      query={query}
      onQueryChange={setQuery}
      isOpen={query.trim() !== ''}
      sections={sections}
    />
  )
}

describe('HomeSearchBox', () => {
  it('renders search results with listbox and options', () => {
    render(<SearchBoxHarness />)

    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alice Jones').length).toBeGreaterThan(0)
    expect(screen.getByText('Kitchen repaint')).toBeTruthy()
  })

  it('closes on Escape without clearing the query', async () => {
    render(<SearchBoxHarness />)

    const input = screen.getByLabelText('Search customers or jobs') as HTMLInputElement
    await userEvent.click(input)
    await userEvent.keyboard('{Escape}')

    expect(input.value).toBe('Alice')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('reopens after Escape when typing again', async () => {
    render(<SearchBoxHarness />)

    const input = screen.getByLabelText('Search customers or jobs') as HTMLInputElement
    await userEvent.click(input)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()

    await userEvent.type(input, 'a')

    expect(input.value).toBe('Alicea')
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  it('reopens after Escape when the input regains focus', async () => {
    render(<SearchBoxHarness />)

    const input = screen.getByLabelText('Search customers or jobs') as HTMLInputElement
    await userEvent.click(input)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()

    input.blur()
    fireEvent.focus(input)

    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  it('renders the no-results state', () => {
    function NoResultsHarness() {
      const [query, setQuery] = useState('zzz')
      return (
        <HomeSearchBox
          query={query}
          onQueryChange={setQuery}
          isOpen={query.trim() !== ''}
          sections={[]}
        />
      )
    }

    render(<NoResultsHarness />)

    expect(screen.getByText('No results.')).toBeTruthy()
  })
})
