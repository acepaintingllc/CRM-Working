import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobTimelineItem } from '@/app/crm/jobs/_lib/jobTimelineVm'
import JobTimeline from '../JobTimeline'

function createItems(items: JobTimelineItem[] = []): JobTimelineItem[] {
  return [
    {
      key: 'created_at',
      iconKey: 'circle',
      label: 'Created',
      value: '4/20/2026, 10:00:00 AM',
      at: '2026-04-20T10:00:00.000Z',
    },
    ...items,
  ]
}

describe('JobTimeline', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders timeline items passed by the controller', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <JobTimeline
        items={createItems([
          {
            key: 'quote-sent-1',
            iconKey: 'send',
            label: 'Quote sent',
            value: 'Public version #1',
            at: '2026-04-29T10:00:00.000Z',
            href: '/quote/token-1',
            linkLabel: 'Open quote',
          },
          {
            key: 'quote-sent-2',
            iconKey: 'send',
            label: 'Quote sent',
            value: 'Public version #2',
            at: '2026-04-30T10:00:00.000Z',
            href: '/quote/token-2',
            linkLabel: 'Open quote',
          },
        ])}
        open
        onToggle={vi.fn()}
        onEstimateDateChange={vi.fn()}
      />
    )

    expect(screen.getByText('Public version #1')).toBeTruthy()
    expect(screen.getByText('Public version #2')).toBeTruthy()
    expect(
      consoleError.mock.calls.some((args) =>
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.includes('Encountered two children with the same key')
        )
      )
    ).toBe(false)
  })

  it('uses the shared CRM button for the timeline toggle and preserves toggle behavior', () => {
    const onToggle = vi.fn()

    render(
      <JobTimeline
        items={createItems()}
        open={false}
        onToggle={onToggle}
        onEstimateDateChange={vi.fn()}
      />
    )

    const toggle = screen.getByRole('button', { name: /Timeline\s*Show/ })
    expect(toggle.className).toContain('ace-crm-btn')

    fireEvent.click(toggle)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('renders public quote event links with the correct link attributes', () => {
    render(
      <JobTimeline
        items={createItems([
          {
            key: 'quote-viewed-1',
            iconKey: 'eye',
            label: 'Quote viewed',
            value: 'Customer opened the quote',
            at: '2026-04-29T10:00:00.000Z',
            href: '/quote/token-1',
            linkLabel: 'Open customer quote',
          },
          {
            key: 'quote-accepted-1',
            iconKey: 'check',
            label: 'Quote accepted',
            value: 'Customer accepted online',
            at: '2026-04-30T10:00:00.000Z',
            href: 'https://example.com/quote/token-2',
            linkLabel: 'Open external quote',
          },
        ])}
        open
        onToggle={vi.fn()}
        onEstimateDateChange={vi.fn()}
      />
    )

    const relativeLink = screen.getByRole('link', { name: 'Open customer quote' })
    expect(relativeLink.getAttribute('href')).toBe('/quote/token-1')
    expect(relativeLink.getAttribute('target')).toBeNull()

    const externalLink = screen.getByRole('link', { name: 'Open external quote' })
    expect(externalLink.getAttribute('href')).toBe('https://example.com/quote/token-2')
    expect(externalLink.getAttribute('target')).toBe('_blank')
    expect(externalLink.getAttribute('rel')).toBe('noreferrer')
  })

  it('uses a key-stable shared CRM input and reports datetime-local quote date changes', () => {
    const onEstimateDateChange = vi.fn()

    render(
      <JobTimeline
        items={createItems([
          {
            key: 'estimate_date',
            iconKey: 'calendar',
            label: 'Quote date',
            value: '4/30/2026, 1:00:00 PM',
            at: '2026-04-30T13:00:00.000Z',
            estimateDateInputValue: '2026-04-30T13:00',
          },
        ])}
        open
        onToggle={vi.fn()}
        onEstimateDateChange={onEstimateDateChange}
      />
    )

    const input = screen.getByLabelText('Quote date')
    expect(input.className).toContain('ace-crm-input')
    expect(input).toHaveProperty('value', '2026-04-30T13:00')

    fireEvent.change(input, { target: { value: '2026-05-01T09:30' } })

    expect(onEstimateDateChange).toHaveBeenCalledTimes(1)
    expect(onEstimateDateChange).toHaveBeenCalledWith('2026-05-01T09:30')
  })

  it('updates the controlled quote date input when refreshed items change', () => {
    const { rerender } = render(
      <JobTimeline
        items={createItems([
          {
            key: 'estimate_date',
            iconKey: 'calendar',
            label: 'Quote date',
            value: '4/30/2026, 1:00:00 PM',
            at: '2026-04-30T13:00:00.000Z',
            estimateDateInputValue: '2026-04-30T13:00',
          },
        ])}
        open
        onToggle={vi.fn()}
        onEstimateDateChange={vi.fn()}
      />
    )

    rerender(
      <JobTimeline
        items={createItems([
          {
            key: 'estimate_date',
            iconKey: 'calendar',
            label: 'Quote date',
            value: '5/1/2026, 9:30:00 AM',
            at: '2026-05-01T09:30:00.000Z',
            estimateDateInputValue: '2026-05-01T09:30',
          },
        ])}
        open
        onToggle={vi.fn()}
        onEstimateDateChange={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Quote date')).toHaveProperty('value', '2026-05-01T09:30')
  })
})
