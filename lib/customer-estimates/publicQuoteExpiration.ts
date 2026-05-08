import type { EstimatePublicSnapshot } from './types'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function parsePublicQuoteDate(value: unknown) {
  const text = asText(value)
  if (!text) return null

  const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getPublicQuoteExpirationDate(snapshot: EstimatePublicSnapshot) {
  const validDays = Number(snapshot.document.quote_validity_days)
  if (!Number.isFinite(validDays) || validDays <= 0) return null

  const sourceDate =
    parsePublicQuoteDate(snapshot.sent_at) ??
    parsePublicQuoteDate(snapshot.document.meta.sent_at)
  if (!sourceDate) return null

  const expiresAt = new Date(sourceDate)
  expiresAt.setDate(expiresAt.getDate() + validDays)
  return expiresAt
}

export function isPublicQuoteExpired(snapshot: EstimatePublicSnapshot, now = new Date()) {
  const expiresAt = getPublicQuoteExpirationDate(snapshot)
  return expiresAt ? now.getTime() > expiresAt.getTime() : false
}
