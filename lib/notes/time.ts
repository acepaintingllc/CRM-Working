type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const dtfCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string) {
  const existing = dtfCache.get(timeZone)
  if (existing) return existing
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  dtfCache.set(timeZone, created)
  return created
}

function partsToObject(parts: Intl.DateTimeFormatPart[]) {
  const find = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  return {
    year: find('year'),
    month: find('month'),
    day: find('day'),
    hour: find('hour'),
    minute: find('minute'),
    second: find('second'),
  }
}

export function resolveTimeZone(value: string | null | undefined) {
  const fallback = 'America/Chicago'
  if (!value || !value.trim()) return fallback
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    return fallback
  }
}

export function getDatePartsInTimeZone(date: Date, timeZone: string): DateParts {
  return partsToObject(formatter(timeZone).formatToParts(date))
}

export function localDateKey(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function localTimeKey(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - date.getTime()
}

export function makeUtcDateForTimeZone(params: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second?: number
  timeZone: string
}) {
  const second = params.second ?? 0
  const naiveUtc = Date.UTC(params.year, params.month - 1, params.day, params.hour, params.minute, second)
  const guess = new Date(naiveUtc)
  const offset = getTimeZoneOffsetMs(guess, params.timeZone)
  return new Date(naiveUtc - offset)
}

export function getTodayBoundsInTimeZone(now: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(now, timeZone)
  const start = makeUtcDateForTimeZone({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    timeZone,
  })
  const end = new Date(start.getTime())
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end, dateKey: localDateKey(now, timeZone) }
}

export function parseHHMM(value: string | null | undefined) {
  if (!value) return null
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null
  return { hour: Number(match[1]), minute: Number(match[2]) }
}
