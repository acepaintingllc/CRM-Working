export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function asNum(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function formatHumanDate(value: string) {
  const raw = asText(value)
  if (!raw) return ''
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw)
  if (isoDate) {
    const year = Number(isoDate[1])
    const month = Number(isoDate[2])
    const day = Number(isoDate[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return raw
}

export function listJoin(values: string[]) {
  const filtered = values.map((value) => asText(value)).filter(Boolean)
  if (filtered.length === 0) return ''
  if (filtered.length === 1) return filtered[0]
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`
  return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`
}

export function uniqueText(values: string[]) {
  return Array.from(new Set(values.map((value) => asText(value)).filter(Boolean)))
}

export function humanizeIdentifier(value: string) {
  const trimmed = asText(value)
  if (!trimmed) return ''
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])/g, (_, ch: string) => ch.toUpperCase())
    .trim()
}

export function humanizeRoomCode(value: string) {
  const trimmed = asText(value).toUpperCase()
  if (!trimmed) return ''
  const match = /^R0*(\d+)$/i.exec(trimmed)
  if (match) return `Room ${Number(match[1])}`
  return humanizeIdentifier(trimmed) || 'Room'
}

export function labelOrFallback(value: unknown, fallback: string) {
  const text = asText(value)
  if (!text) return fallback
  if (/^[0-9a-f-]{16,}$/i.test(text)) return fallback
  return text
}

export function cleanCustomerFacingText(value: string) {
  const raw = asText(value)
  if (!raw) return ''
  return raw
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/\b[a-f0-9]{16,}\b/gi, '')
    .replace(/\s*(?:\u2014|-)\s*\$\d[\d,]*(?:\.\d{2})?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s+-\s+/g, ' - ')
    .trim()
}

export function formatAddressFromParts(params: {
  address?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}) {
  const street = asText(params.street)
  const city = asText(params.city)
  const state = asText(params.state)
  const zip = asText(params.zip)
  const fallbackAddress = asText(params.address)
  const line1 = street || fallbackAddress
  const cityStateZip = [state, zip].filter(Boolean).join(' ').trim()
  const line2 = city && cityStateZip ? `${city}, ${cityStateZip}` : city || cityStateZip
  return [line1, line2].filter(Boolean).join('\n')
}

export function textJoin(values: string[]) {
  return values.filter((value) => !!value.trim()).join(' ')
}

export function sentenceCase(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function normalizeScopeText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\b(drywall)\b/gi, 'drywall')
    .replace(/\b(wallpaper)\b/gi, 'wallpaper')
    .trim()
}
