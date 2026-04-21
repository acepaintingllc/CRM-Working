function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function toLocalDateTimeInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`
}

export function next8amLocalDateTimeValue() {
  const now = new Date()
  const next = new Date(now)
  if (now.getHours() >= 8) next.setDate(next.getDate() + 1)
  next.setHours(8, 0, 0, 0)
  return toLocalDateTimeInputValue(next)
}

export function toIsoFromLocalDateTimeValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function addLocalDateTimeHours(localValue: string, hours: number) {
  const start = localValue ? new Date(localValue) : new Date(next8amLocalDateTimeValue())
  const end = new Date(start)
  end.setHours(end.getHours() + hours)
  return toLocalDateTimeInputValue(end)
}
