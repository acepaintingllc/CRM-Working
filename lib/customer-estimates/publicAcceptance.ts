import { asText } from './buildShared.ts'
import type { EstimatePublicSnapshot } from './types.ts'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function normalizeEstimatePublicAcceptanceRecord(
  value: unknown
): EstimatePublicSnapshot['acceptance_json'] {
  const record = asRecord(value)
  if (!record) return null

  const legalName = asText(record.legal_name)
  const signatureType = asText(record.signature_type)
  const signatureValue = asText(record.signature_value)
  const acceptedAt = asText(record.accepted_at)
  if (!legalName || (signatureType !== 'typed' && signatureType !== 'drawn') || !signatureValue || !acceptedAt) {
    return null
  }

  return {
    legal_name: legalName,
    ...(asText(record.customer_email) ? { customer_email: asText(record.customer_email) } : {}),
    signature_type: signatureType,
    signature_value: signatureValue,
    accepted_terms: true,
    accepted_at: acceptedAt,
    user_agent: asText(record.user_agent),
    ip: asText(record.ip),
    ...(asText(record.customer_message) ? { customer_message: asText(record.customer_message) } : {}),
  }
}
