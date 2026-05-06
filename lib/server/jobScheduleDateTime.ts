const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/

export type ScheduleDateTimeBlock = {
  startAt: string
  endAt: string
}

export type PersistedScheduleDateTimeBlock = {
  start_at: unknown
  end_at: unknown
}

function isValidScheduleDateTimeString(value: string) {
  const match = DATE_TIME_PATTERN.exec(value)
  if (!match) return false

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, , zoneRaw] = match
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  const second = secondRaw ? Number(secondRaw) : 0

  if (month < 1 || month > 12) return false
  if (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false
  if (hour > 23 || minute > 59 || second > 59) return false

  if (zoneRaw && zoneRaw !== 'Z') {
    const zoneHour = Number(zoneRaw.slice(1, 3))
    const zoneMinute = Number(zoneRaw.slice(4, 6))
    if (zoneHour > 23 || zoneMinute > 59) return false
  }

  return true
}

export function normalizeScheduleDateTime(value: unknown) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (!isValidScheduleDateTimeString(trimmed)) return null

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function normalizeScheduleDateTimeBlock(block: PersistedScheduleDateTimeBlock) {
  const startAt = normalizeScheduleDateTime(block.start_at)
  const endAt = normalizeScheduleDateTime(block.end_at)

  if (!startAt || !endAt) return null
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) return null

  return {
    startAt,
    endAt,
  } satisfies ScheduleDateTimeBlock
}
