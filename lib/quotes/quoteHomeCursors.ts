import {
  quoteHomeDefaultPageLimit,
  quoteHomeMaxPageLimit,
  type QuoteHomeCursorKey,
} from './quoteHomeTypes'
import { isUuid } from '../validation/uuid.ts'

const quoteHomeCursorSeparator = '::'
const quoteHomeNullCursorTimestamp = 'null'

export function normalizeQuoteHomeQuery(value: unknown): string {
  return String(value ?? '').trim()
}

export const normalizeQuoteHomeSearchQuery = normalizeQuoteHomeQuery
export const normalizeQuoteHomeJobQuery = normalizeQuoteHomeQuery

export function normalizeQuoteHomePageLimit(
  value: number | null | undefined,
  fallback = quoteHomeDefaultPageLimit,
  maximum = quoteHomeMaxPageLimit
): number {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(1, Math.min(maximum, Math.trunc(next)))
}

export function encodeQuoteHomeCursor(value: {
  timestamp: string | null | undefined
  id: string | null | undefined
}) {
  if (!value.id) return null
  return `${value.timestamp ?? quoteHomeNullCursorTimestamp}${quoteHomeCursorSeparator}${value.id}`
}

export function decodeQuoteHomeCursor(cursor: string | null | undefined):
  | { ok: true; value: QuoteHomeCursorKey | null }
  | { ok: false; message: string } {
  const rawCursor = normalizeQuoteHomeSearchQuery(cursor)
  if (!rawCursor) {
    return { ok: true, value: null }
  }

  const parts = rawCursor.split(quoteHomeCursorSeparator)
  if (parts.length !== 2) {
    return { ok: false, message: 'Invalid cursor.' }
  }

  const [timestamp, id] = parts
  if (!timestamp || !isUuid(id)) {
    return { ok: false, message: 'Invalid cursor.' }
  }

  if (timestamp === quoteHomeNullCursorTimestamp) {
    return {
      ok: true,
      value: {
        timestamp: null,
        id,
      },
    }
  }

  const parsedTimestamp = new Date(timestamp)
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return { ok: false, message: 'Invalid cursor.' }
  }

  return {
    ok: true,
    value: {
      timestamp: parsedTimestamp.toISOString(),
      id,
    },
  }
}
