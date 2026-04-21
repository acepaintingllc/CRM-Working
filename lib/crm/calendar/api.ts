import { eventSortValue, monthKeyLocal } from '../home/calendar.ts'

import type { CalendarEvent, CalendarInfo } from './types.ts'

type CalendarFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type ReadArrayResult<T> = {
  valid: boolean
  value: T[]
}

type FetchResult<T> = {
  errorMessage: string | null
  value: T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function readNullableString(value: unknown) {
  return value == null ? null : typeof value === 'string' ? value : null
}

async function getDefaultFetch(): Promise<CalendarFetch> {
  const authModule = await import('../../auth/authedFetch.ts')
  return authModule.authedFetch
}

async function readJson(response: Response) {
  return response.json().catch(() => null)
}

function getResponseError(response: Response, payload: unknown) {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error.trim().length > 0) {
    return payload.error
  }
  return response.statusText || 'Request failed'
}

export function readCalendarInfo(value: unknown): CalendarInfo | null {
  if (!isRecord(value)) return null

  const id = readString(value.id)
  const primary = readBoolean(value.primary)
  if (!id || primary == null) return null

  return {
    id,
    summary: readNullableString(value.summary),
    primary,
    backgroundColor: readNullableString(value.backgroundColor),
    foregroundColor: readNullableString(value.foregroundColor),
  }
}

export function readCalendarInfosPayload(payload: unknown): ReadArrayResult<CalendarInfo> {
  if (!isRecord(payload) || !Array.isArray(payload.calendars)) {
    return { valid: false, value: [] }
  }

  const calendars = payload.calendars
    .map((value) => readCalendarInfo(value))
    .filter((value): value is CalendarInfo => value != null)

  return {
    valid: calendars.length === payload.calendars.length,
    value: calendars,
  }
}

export function readCalendarEvent(value: unknown): CalendarEvent | null {
  if (!isRecord(value)) return null

  const id = readString(value.id)
  const calendarId = readString(value.calendarId)
  if (!id || !calendarId) return null

  return {
    id,
    calendarId,
    summary: readNullableString(value.summary),
    start: readNullableString(value.start),
    end: readNullableString(value.end),
    htmlLink: readNullableString(value.htmlLink),
  }
}

export function readCalendarEventsPayload(payload: unknown): ReadArrayResult<CalendarEvent> {
  if (!isRecord(payload) || !Array.isArray(payload.events)) {
    return { valid: false, value: [] }
  }

  const events = payload.events
    .map((value) => readCalendarEvent(value))
    .filter((value): value is CalendarEvent => value != null)

  return {
    valid: events.length === payload.events.length,
    value: events,
  }
}

export function resolveInitialSelectedCalendarIds(
  calendars: CalendarInfo[],
  storedIds: string[] | null
) {
  const validStored = (storedIds ?? []).filter((id) => calendars.some((calendar) => calendar.id === id))
  if (validStored.length > 0) return validStored

  const primary = calendars.find((calendar) => calendar.primary)?.id ?? 'primary'
  const austins =
    calendars.find((calendar) => (calendar.summary ?? '').toLowerCase() === "austin's work")?.id ?? null

  return austins
    ? [austins, primary].filter((value, index, values) => values.indexOf(value) === index)
    : [primary]
}

export async function fetchCalendarStatus(fetchImpl?: CalendarFetch): Promise<FetchResult<boolean>> {
  const fetcher = fetchImpl ?? (await getDefaultFetch())
  const response = await fetcher('/api/google-calendar/status', { cache: 'no-store' })
  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(getResponseError(response, payload))
  }

  if (!isRecord(payload) || typeof payload.connected !== 'boolean') {
    return { value: false, errorMessage: 'Invalid calendar status response.' }
  }

  return { value: payload.connected, errorMessage: null }
}

export async function fetchCalendars(fetchImpl?: CalendarFetch): Promise<FetchResult<CalendarInfo[]>> {
  const fetcher = fetchImpl ?? (await getDefaultFetch())
  const response = await fetcher('/api/google-calendar/calendars', { cache: 'no-store' })
  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(getResponseError(response, payload))
  }

  const parsed = readCalendarInfosPayload(payload)
  if (!parsed.valid) {
    return { value: [], errorMessage: 'Invalid calendar list response.' }
  }

  return { value: parsed.value, errorMessage: null }
}

export async function fetchEvents(
  args: { selectedCalendarIds: string[]; visibleMonth: Date },
  fetchImpl?: CalendarFetch
): Promise<FetchResult<CalendarEvent[]>> {
  const fetcher = fetchImpl ?? (await getDefaultFetch())
  const params = new URLSearchParams()
  params.set('calendar_ids', args.selectedCalendarIds.join(','))
  params.set('limit', '250')
  params.set('month', monthKeyLocal(args.visibleMonth))

  const response = await fetcher(`/api/google-calendar/events?${params.toString()}`, {
    cache: 'no-store',
  })
  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(getResponseError(response, payload))
  }

  const parsed = readCalendarEventsPayload(payload)
  if (!parsed.valid) {
    return { value: [], errorMessage: 'Invalid calendar events response.' }
  }

  return {
    value: [...parsed.value].sort((a, b) => eventSortValue(a) - eventSortValue(b)),
    errorMessage: null,
  }
}

export async function connectCalendar(next: string, fetchImpl?: CalendarFetch) {
  const fetcher = fetchImpl ?? (await getDefaultFetch())
  const response = await fetcher('/api/google-calendar/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ next }),
  })
  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(getResponseError(response, payload))
  }

  if (!isRecord(payload) || typeof payload.url !== 'string' || payload.url.length === 0) {
    throw new Error('Failed to start Google connection')
  }

  return payload.url
}

export async function disconnectCalendar(fetchImpl?: CalendarFetch) {
  const fetcher = fetchImpl ?? (await getDefaultFetch())
  const response = await fetcher('/api/google-calendar/disconnect', { method: 'POST' })
  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(getResponseError(response, payload))
  }
}
