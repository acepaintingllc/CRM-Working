import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarPage from '../page'

const mockUseCalendarPage = vi.fn()

vi.mock('@/lib/crm/calendar/useCalendarPage', () => ({
  useCalendarPage: () => mockUseCalendarPage(),
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

vi.mock('@/lib/crm/calendar/components', () => ({
  CalendarPicker: () => <div>Calendar picker</div>,
  MonthBoard: () => <div>Month board</div>,
  SelectedDayPanel: () => <div>Selected day panel</div>,
}))

describe('CalendarPage', () => {
  beforeEach(() => {
    mockUseCalendarPage.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the shared CRM shell header and calendar body', () => {
    mockUseCalendarPage.mockReturnValue({
      bootstrapLoading: false,
      calendarById: {},
      calendars: [{ id: 'primary', summary: 'Primary', primary: true }],
      connect: vi.fn(),
      connected: true,
      disconnect: vi.fn(),
      error: null,
      events: [],
      eventsError: null,
      eventsLoading: false,
      goToNextMonth: vi.fn(),
      goToPreviousMonth: vi.fn(),
      goToToday: vi.fn(),
      monthWeekRows: [],
      openGoogleUrl: 'https://calendar.google.com',
      refreshAll: vi.fn(),
      selectDay: vi.fn(),
      selectedCalendarIds: ['primary'],
      selectedDay: null,
      selectedDayEvents: [],
      selectedDayKey: null,
      today: new Date('2026-04-21T12:00:00.000Z'),
      toggleCalendar: vi.fn(),
      visibleMonth: new Date('2026-04-01T12:00:00.000Z'),
    })

    render(<CalendarPage />)

    expect(screen.getByText('Calendar')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open in Google/i }).getAttribute('href')).toBe('https://calendar.google.com')
    expect(screen.getByText('Calendar picker')).toBeTruthy()
    expect(screen.getAllByText('Month board').length).toBeGreaterThan(0)
    expect(screen.getByText('Selected day panel')).toBeTruthy()
  })
})
