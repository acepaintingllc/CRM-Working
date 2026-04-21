import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCalendarPage } from '@/lib/crm/calendar/useCalendarPage'

const {
  mockConnectCalendar,
  mockDisconnectCalendar,
  mockFetchCalendars,
  mockFetchCalendarStatus,
  mockFetchEvents,
  mockReadStoredCalendarIds,
  mockUseSearchParams,
} = vi.hoisted(() => ({
  mockConnectCalendar: vi.fn(),
  mockDisconnectCalendar: vi.fn(),
  mockFetchCalendars: vi.fn(),
  mockFetchCalendarStatus: vi.fn(),
  mockFetchEvents: vi.fn(),
  mockReadStoredCalendarIds: vi.fn(),
  mockUseSearchParams: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: mockUseSearchParams,
}))

vi.mock('@/lib/crm/home/calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm/home/calendar')>()
  return {
    ...actual,
    readStoredCalendarIds: mockReadStoredCalendarIds,
  }
})

vi.mock('@/lib/crm/calendar/api', () => ({
  connectCalendar: mockConnectCalendar,
  disconnectCalendar: mockDisconnectCalendar,
  fetchCalendars: mockFetchCalendars,
  fetchCalendarStatus: mockFetchCalendarStatus,
  fetchEvents: mockFetchEvents,
  resolveInitialSelectedCalendarIds: (calendars: Array<{ id: string; primary: boolean; summary: string | null }>, storedIds: string[] | null) => {
    const validStored = (storedIds ?? []).filter((id) => calendars.some((calendar) => calendar.id === id))
    if (validStored.length > 0) return validStored
    const primary = calendars.find((calendar) => calendar.primary)?.id ?? 'primary'
    const austins =
      calendars.find((calendar) => (calendar.summary ?? '').toLowerCase() === "austin's work")?.id ?? null
    return austins ? [austins, primary] : [primary]
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useCalendarPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 21, 9, 0, 0))
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockReadStoredCalendarIds.mockReset()
    mockFetchCalendarStatus.mockReset()
    mockFetchCalendars.mockReset()
    mockFetchEvents.mockReset()
    mockConnectCalendar.mockReset()
    mockDisconnectCalendar.mockReset()
    mockReadStoredCalendarIds.mockReturnValue(['primary'])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('bootstraps successfully and loads events', async () => {
    mockFetchCalendarStatus.mockResolvedValue({ value: true, errorMessage: null })
    mockFetchCalendars.mockResolvedValue({
      value: [
        {
          id: 'primary',
          summary: 'Primary',
          primary: true,
          backgroundColor: '#ffffff',
          foregroundColor: '#111111',
        },
      ],
      errorMessage: null,
    })
    mockFetchEvents.mockResolvedValue({
      value: [
        {
          id: 'event-1',
          calendarId: 'primary',
          summary: 'Standup',
          start: '2026-04-21T10:00:00.000Z',
          end: '2026-04-21T10:30:00.000Z',
          htmlLink: null,
        },
      ],
      errorMessage: null,
    })

    const { result } = renderHook(() => useCalendarPage())

    await flushUpdates()

    expect(result.current.connected).toBe(true)
    expect(result.current.calendars).toHaveLength(1)
    expect(result.current.events).toHaveLength(1)
    expect(result.current.error).toBeNull()
    expect(result.current.eventsError).toBeNull()
  })

  it('surfaces bootstrap status failures without leaving loading stuck', async () => {
    mockFetchCalendarStatus.mockRejectedValue(new Error('Status exploded'))

    const { result } = renderHook(() => useCalendarPage())

    await flushUpdates()

    expect(result.current.bootstrapLoading).toBe(false)
    expect(result.current.connected).toBe(false)
    expect(result.current.error).toBe('Status exploded')
    expect(result.current.calendars).toEqual([])
  })

  it('surfaces calendar list failures after connected status succeeds', async () => {
    mockFetchCalendarStatus.mockResolvedValue({ value: true, errorMessage: null })
    mockFetchCalendars.mockResolvedValue({ value: [], errorMessage: 'Invalid calendar list response.' })

    const { result } = renderHook(() => useCalendarPage())

    await flushUpdates()

    expect(result.current.bootstrapLoading).toBe(false)
    expect(result.current.connected).toBe(true)
    expect(result.current.error).toBe('Invalid calendar list response.')
    expect(result.current.calendars).toEqual([])
  })

  it('surfaces event failures without leaving the events loader stuck', async () => {
    mockFetchCalendarStatus.mockResolvedValue({ value: true, errorMessage: null })
    mockFetchCalendars.mockResolvedValue({
      value: [
        {
          id: 'primary',
          summary: 'Primary',
          primary: true,
          backgroundColor: '#ffffff',
          foregroundColor: '#111111',
        },
      ],
      errorMessage: null,
    })
    mockFetchEvents.mockRejectedValue(new Error('Events exploded'))

    const { result } = renderHook(() => useCalendarPage())

    await flushUpdates()

    expect(result.current.eventsLoading).toBe(false)
    expect(result.current.eventsError).toBe('Events exploded')
    expect(result.current.events).toEqual([])
  })

  it('ignores stale event responses when the visible month changes', async () => {
    const first = deferred<{ value: never[]; errorMessage: null }>()
    const second = deferred<{
      value: Array<{
        id: string
        calendarId: string
        summary: string | null
        start: string | null
        end: string | null
        htmlLink: string | null
      }>
      errorMessage: null
    }>()

    mockFetchCalendarStatus.mockResolvedValue({ value: true, errorMessage: null })
    mockFetchCalendars.mockResolvedValue({
      value: [
        {
          id: 'primary',
          summary: 'Primary',
          primary: true,
          backgroundColor: '#ffffff',
          foregroundColor: '#111111',
        },
      ],
      errorMessage: null,
    })
    mockFetchEvents
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const { result } = renderHook(() => useCalendarPage())

    await flushUpdates()

    act(() => {
      result.current.goToNextMonth()
    })

    second.resolve({
      value: [
        {
          id: 'new-month',
          calendarId: 'primary',
          summary: 'May event',
          start: '2026-05-02T10:00:00.000Z',
          end: '2026-05-02T11:00:00.000Z',
          htmlLink: null,
        },
      ],
      errorMessage: null,
    })

    await flushUpdates()

    first.resolve({ value: [], errorMessage: null })
    await flushUpdates()

    expect(result.current.events[0]?.id).toBe('new-month')
  })

  it('keeps selected day coherent when month navigation moves away from the selected month', async () => {
    mockFetchCalendarStatus.mockResolvedValue({ value: true, errorMessage: null })
    mockFetchCalendars.mockResolvedValue({
      value: [
        {
          id: 'primary',
          summary: 'Primary',
          primary: true,
          backgroundColor: '#ffffff',
          foregroundColor: '#111111',
        },
      ],
      errorMessage: null,
    })
    mockFetchEvents.mockResolvedValue({ value: [], errorMessage: null })

    const { result } = renderHook(() => useCalendarPage())

    await flushUpdates()

    act(() => {
      result.current.selectDay('2026-04-18')
      result.current.goToNextMonth()
    })

    expect(result.current.selectedDayKey).toBe('2026-05-01')
  })

  it('toggleCalendar updates persisted selection and triggers event reload', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    mockFetchCalendarStatus.mockResolvedValue({ value: true, errorMessage: null })
    mockFetchCalendars.mockResolvedValue({
      value: [
        {
          id: 'primary',
          summary: 'Primary',
          primary: true,
          backgroundColor: '#ffffff',
          foregroundColor: '#111111',
        },
        {
          id: 'team',
          summary: 'Team',
          primary: false,
          backgroundColor: '#222222',
          foregroundColor: '#eeeeee',
        },
      ],
      errorMessage: null,
    })
    mockFetchEvents.mockResolvedValue({ value: [], errorMessage: null })

    const { result } = renderHook(() => useCalendarPage())

    await flushUpdates()

    act(() => {
      result.current.toggleCalendar('team')
    })

    await flushUpdates()

    expect(setItemSpy).toHaveBeenCalledWith('acecrm.calendar.selected', JSON.stringify(['primary', 'team']))
    expect(mockFetchEvents).toHaveBeenLastCalledWith({
      selectedCalendarIds: ['primary', 'team'],
      visibleMonth: expect.any(Date),
    })
  })
})
