'use client'

import { readStoredCalendarIds, selectedCalendarIdsStorageKey } from '@/lib/crm/home/calendar'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  addMonths,
  buildMonthWeekRows,
  buildMonthWeeks,
  dateFromLocalKey,
  eventTouchesDay,
  localDateKey,
  resolveSelectedDayKeyForMonth,
  startOfLocalDay,
} from './helpers'
import {
  connectCalendar,
  disconnectCalendar,
  fetchCalendars,
  fetchCalendarStatus,
  fetchEvents,
  resolveInitialSelectedCalendarIds,
} from './api'
import type { CalendarEvent, CalendarInfo, CalendarLoadPhase } from './types'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  if (typeof error === 'string' && error.trim().length > 0) return error
  return fallback
}

export function useCalendarPage() {
  const searchParams = useSearchParams()
  const today = useMemo(() => startOfLocalDay(new Date()), [])
  const [connected, setConnected] = useState<boolean | null>(null)
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDayKey, setSelectedDayKey] = useState(localDateKey(today))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapPhase, setBootstrapPhase] = useState<CalendarLoadPhase>('idle')
  const [eventsPhase, setEventsPhase] = useState<CalendarLoadPhase>('idle')
  const bootstrapRequestIdRef = useRef(0)
  const eventsRequestIdRef = useRef(0)
  const visibleMonthRef = useRef(visibleMonth)

  useEffect(() => {
    visibleMonthRef.current = visibleMonth
  }, [visibleMonth])

  const bootstrapLoading = bootstrapPhase === 'loading'
  const eventsLoading = eventsPhase === 'loading'

  const loadConnectionStatus = useCallback(async () => {
    return fetchCalendarStatus()
  }, [])

  const loadCalendarsAndSelection = useCallback(async () => {
    const calendarsResult = await fetchCalendars()
    return {
      calendars: calendarsResult.value,
      errorMessage: calendarsResult.errorMessage,
      selectedCalendarIds: calendarsResult.errorMessage
        ? []
        : resolveInitialSelectedCalendarIds(calendarsResult.value, readStoredCalendarIds()),
    }
  }, [])

  const loadStatusAndCalendars = useCallback(async () => {
    const requestId = ++bootstrapRequestIdRef.current
    setBootstrapPhase('loading')
    setError(null)

    try {
      const statusResult = await loadConnectionStatus()
      if (bootstrapRequestIdRef.current !== requestId) return null

      if (statusResult.errorMessage) {
        setConnected(false)
        setCalendars([])
        setSelectedCalendarIds([])
        setEvents([])
        setEventsError(null)
        setError(statusResult.errorMessage)
        setBootstrapPhase('error')
        return { connected: false, selectedCalendarIds: [] }
      }

      setConnected(statusResult.value)

      if (!statusResult.value) {
        setCalendars([])
        setSelectedCalendarIds([])
        setEvents([])
        setEventsError(null)
        setBootstrapPhase('ready')
        return { connected: false, selectedCalendarIds: [] }
      }

      const calendarsResult = await loadCalendarsAndSelection()
      if (bootstrapRequestIdRef.current !== requestId) return null

      setCalendars(calendarsResult.calendars)
      setSelectedCalendarIds(calendarsResult.selectedCalendarIds)
      if (calendarsResult.errorMessage) {
        setEvents([])
        setError(calendarsResult.errorMessage)
        setBootstrapPhase('error')
      } else {
        setBootstrapPhase('ready')
      }

      return {
        connected: true,
        selectedCalendarIds: calendarsResult.selectedCalendarIds,
      }
    } catch (loadError: unknown) {
      if (bootstrapRequestIdRef.current !== requestId) return null
      setConnected(false)
      setCalendars([])
      setSelectedCalendarIds([])
      setEvents([])
      setEventsError(null)
      setError(getErrorMessage(loadError, 'Failed to load calendar status.'))
      setBootstrapPhase('error')
      return { connected: false, selectedCalendarIds: [] }
    }
  }, [loadCalendarsAndSelection, loadConnectionStatus])

  const loadEventsFor = useCallback(
    async (args: { connected: boolean | null; selectedCalendarIds: string[]; visibleMonth: Date }) => {
      if (!args.connected || args.selectedCalendarIds.length === 0) {
        eventsRequestIdRef.current += 1
        setEvents([])
        setEventsError(null)
        setEventsPhase('idle')
        return
      }

      const requestId = ++eventsRequestIdRef.current
      setEventsPhase('loading')
      setEventsError(null)

      try {
        const eventsResult = await fetchEvents({
          selectedCalendarIds: args.selectedCalendarIds,
          visibleMonth: args.visibleMonth,
        })
        if (eventsRequestIdRef.current !== requestId) return

        setEvents(eventsResult.value)
        if (eventsResult.errorMessage) {
          setEventsError(eventsResult.errorMessage)
          setEventsPhase('error')
          return
        }

        setEventsPhase('ready')
      } catch (loadError: unknown) {
        if (eventsRequestIdRef.current !== requestId) return
        setEvents([])
        setEventsError(getErrorMessage(loadError, 'Failed to load calendar events.'))
        setEventsPhase('error')
      }
    },
    []
  )

  const connect = useCallback(async () => {
    setBootstrapPhase('loading')
    setError(null)

    try {
      const url = await connectCalendar('/crm/calendar')
      window.location.href = url
    } catch (connectError: unknown) {
      setError(getErrorMessage(connectError, 'Failed to start Google connection.'))
      setBootstrapPhase('error')
    }
  }, [])

  const disconnect = useCallback(async () => {
    setBootstrapPhase('loading')
    setError(null)

    try {
      await disconnectCalendar()
      await loadStatusAndCalendars()
    } catch (disconnectError: unknown) {
      setError(getErrorMessage(disconnectError, 'Failed to disconnect Google Calendar.'))
      setBootstrapPhase('error')
    }
  }, [loadStatusAndCalendars])

  const refreshAll = useCallback(async () => {
    const bootstrapResult = await loadStatusAndCalendars()
    if (!bootstrapResult) return

    await loadEventsFor({
      connected: bootstrapResult.connected,
      selectedCalendarIds: bootstrapResult.selectedCalendarIds,
      visibleMonth: visibleMonthRef.current,
    })
  }, [loadEventsFor, loadStatusAndCalendars])

  const toggleCalendar = useCallback((calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId) ? prev.filter((id) => id !== calendarId) : [...prev, calendarId]
    )
  }, [])

  const goToToday = useCallback(() => {
    const nextToday = startOfLocalDay(new Date())
    setVisibleMonth(new Date(nextToday.getFullYear(), nextToday.getMonth(), 1))
    setSelectedDayKey(localDateKey(nextToday))
  }, [])

  const goToPreviousMonth = useCallback(() => {
    setVisibleMonth((prev) => {
      const nextMonth = addMonths(prev, -1)
      setSelectedDayKey((prevDayKey) => resolveSelectedDayKeyForMonth(prevDayKey, nextMonth))
      return nextMonth
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setVisibleMonth((prev) => {
      const nextMonth = addMonths(prev, 1)
      setSelectedDayKey((prevDayKey) => resolveSelectedDayKeyForMonth(prevDayKey, nextMonth))
      return nextMonth
    })
  }, [])

  const selectDay = useCallback((dayKey: string) => {
    setSelectedDayKey(dayKey)
  }, [])

  const calendarById = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar])),
    [calendars]
  )
  const monthWeeks = useMemo(() => buildMonthWeeks(visibleMonth), [visibleMonth])
  const monthWeekRows = useMemo(() => buildMonthWeekRows(monthWeeks, events), [monthWeeks, events])
  const selectedDay = useMemo(() => dateFromLocalKey(selectedDayKey) ?? today, [selectedDayKey, today])
  const selectedDayEvents = useMemo(
    () => events.filter((event) => eventTouchesDay(event, selectedDay)),
    [events, selectedDay]
  )
  const openGoogleUrl = useMemo(() => {
    const url = new URL('https://calendar.google.com/calendar/u/0/r')
    for (const id of selectedCalendarIds) {
      url.searchParams.append('cid', id)
    }
    return url.toString()
  }, [selectedCalendarIds])

  useEffect(() => {
    void loadStatusAndCalendars()
  }, [loadStatusAndCalendars])

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) setError(err)
  }, [searchParams])

  useEffect(() => {
    try {
      localStorage.setItem(selectedCalendarIdsStorageKey, JSON.stringify(selectedCalendarIds))
    } catch {
      // ignore
    }
  }, [selectedCalendarIds])

  useEffect(() => {
    void loadEventsFor({ connected, selectedCalendarIds, visibleMonth })
  }, [connected, loadEventsFor, selectedCalendarIds, visibleMonth])

  return {
    bootstrapLoading,
    calendarById,
    calendars,
    connect,
    connected,
    disconnect,
    error,
    events,
    eventsError,
    eventsLoading,
    goToNextMonth,
    goToPreviousMonth,
    goToToday,
    loadStatusAndCalendars,
    monthWeekRows,
    openGoogleUrl,
    refreshAll,
    selectDay,
    selectedCalendarIds,
    selectedDay,
    selectedDayEvents,
    selectedDayKey,
    today,
    toggleCalendar,
    visibleMonth,
  }
}
