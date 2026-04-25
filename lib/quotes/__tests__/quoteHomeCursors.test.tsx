import { describe, expect, it } from 'vitest'
import {
  decodeQuoteHomeCursor,
  encodeQuoteHomeCursor,
  normalizeQuoteHomeJobQuery,
  normalizeQuoteHomePageLimit,
  normalizeQuoteHomeSearchQuery,
} from '../quoteHomeCursors'

describe('quote home cursors', () => {
  it('normalizes query aliases and page limits', () => {
    expect(normalizeQuoteHomeSearchQuery('  kitchen  ')).toBe('kitchen')
    expect(normalizeQuoteHomeJobQuery('\n  exterior trim\t ')).toBe('exterior trim')
    expect(normalizeQuoteHomePageLimit(Number.NaN)).toBe(25)
    expect(normalizeQuoteHomePageLimit(101)).toBe(100)
    expect(normalizeQuoteHomePageLimit(0)).toBe(1)
  })

  it('round-trips timestamp and null timestamp cursors', () => {
    const id = '33333333-3333-4333-8333-333333333333'

    expect(
      decodeQuoteHomeCursor(
        encodeQuoteHomeCursor({
          timestamp: '2026-04-24',
          id,
        }),
      ),
    ).toEqual({
      ok: true,
      value: { timestamp: '2026-04-24T00:00:00.000Z', id },
    })

    expect(decodeQuoteHomeCursor(encodeQuoteHomeCursor({ timestamp: null, id }))).toEqual({
      ok: true,
      value: { timestamp: null, id },
    })
  })

  it('rejects malformed cursor payloads', () => {
    expect(decodeQuoteHomeCursor('not-a-cursor')).toEqual({
      ok: false,
      message: 'Invalid cursor.',
    })
    expect(decodeQuoteHomeCursor('bad-date::33333333-3333-4333-8333-333333333333')).toEqual({
      ok: false,
      message: 'Invalid cursor.',
    })
  })
})
