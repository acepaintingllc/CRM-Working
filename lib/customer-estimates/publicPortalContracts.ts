import { asText } from './buildShared'
import type {
  EstimatePublicAcceptanceRecord,
  EstimatePublicSignatureType,
  EstimatePublicSnapshot,
} from './types'

export type PublicEstimateSnapshotResponse = {
  data: EstimatePublicSnapshot
}

export type PublicEstimateMutationResponse = {
  data: EstimatePublicSnapshot
}

export type PublicEstimateErrorResponse = {
  error: string
}

export type PublicEstimateAcceptRequest = {
  legalName: string
  signatureType: EstimatePublicSignatureType
  signatureValue: string
  acceptedTerms: true
}

export type PublicEstimateDeclineRequest = {
  reason: string
}

type ParseOk<T> = {
  ok: true
  value: T
}

type ParseError = {
  ok: false
  error: string
}

type ParseResult<T> = ParseOk<T> | ParseError

const maxLegalNameLength = 200
const maxDeclineReasonLength = 2000
const maxDrawnSignatureLength = 200_000
const typedSignatureType = 'typed'
const drawnSignatureType = 'drawn'

export const publicEstimatePortalErrors = {
  invalidToken: 'Invalid token',
  quoteNotFound: 'Quote not found',
  quoteSnapshotMissing: 'Quote snapshot missing',
  legalNameRequired: 'Legal name is required',
  legalNameTooLong: 'Legal name is too long',
  acceptanceRequired: 'Acceptance checkbox is required',
  signatureRequired: 'Signature is required',
  signatureTypeInvalid: 'Signature type must be typed or drawn',
  typedSignatureMismatch: 'Typed signature must match the full legal name',
  drawnSignatureInvalid: 'Drawn signature is invalid',
  declineReasonTooLong: 'Decline reason is too long',
} as const

function ok<T>(value: T): ParseOk<T> {
  return { ok: true, value }
}

function fail(error: string): ParseError {
  return { ok: false, error }
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function normalizePublicSignerText(value: unknown) {
  return asText(value).replace(/\s+/g, ' ')
}

function normalizeDrawnSignature(value: unknown) {
  return asText(value)
}

function parseAcceptedTerms(record: Record<string, unknown>) {
  return (
    record.accepted_terms === true ||
    record.accepted === true ||
    record.agreement_checked === true
  )
}

function parseSignatureType(value: unknown): EstimatePublicSignatureType | null {
  const normalized = asText(value).toLowerCase()
  if (!normalized || normalized === typedSignatureType) return typedSignatureType
  if (normalized === drawnSignatureType) return drawnSignatureType
  return null
}

function isDrawnSignatureDataUrl(value: string) {
  return /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i.test(value)
}

export function parsePublicEstimateAcceptRequest(input: unknown): ParseResult<PublicEstimateAcceptRequest> {
  const record = asRecord(input)
  const legalName = normalizePublicSignerText(record.legal_name ?? record.full_name)
  if (!legalName) return fail(publicEstimatePortalErrors.legalNameRequired)
  if (legalName.length > maxLegalNameLength) {
    return fail(publicEstimatePortalErrors.legalNameTooLong)
  }

  if (!parseAcceptedTerms(record)) {
    return fail(publicEstimatePortalErrors.acceptanceRequired)
  }

  const signatureType = parseSignatureType(record.signature_type)
  if (!signatureType) return fail(publicEstimatePortalErrors.signatureTypeInvalid)

  if (signatureType === typedSignatureType) {
    const signatureValue = normalizePublicSignerText(
      record.signature_value ?? record.signature
    )
    if (!signatureValue) return fail(publicEstimatePortalErrors.signatureRequired)
    if (signatureValue !== legalName) {
      return fail(publicEstimatePortalErrors.typedSignatureMismatch)
    }
    return ok({
      legalName,
      signatureType,
      signatureValue,
      acceptedTerms: true,
    })
  }

  const signatureValue = normalizeDrawnSignature(record.signature_value ?? record.signature)
  if (!signatureValue) return fail(publicEstimatePortalErrors.signatureRequired)
  if (
    signatureValue.length > maxDrawnSignatureLength ||
    !isDrawnSignatureDataUrl(signatureValue)
  ) {
    return fail(publicEstimatePortalErrors.drawnSignatureInvalid)
  }

  return ok({
    legalName,
    signatureType,
    signatureValue,
    acceptedTerms: true,
  })
}

export function parsePublicEstimateDeclineRequest(input: unknown): ParseResult<PublicEstimateDeclineRequest> {
  const record = asRecord(input)
  const reason = asText(record.reason)
  if (reason.length > maxDeclineReasonLength) {
    return fail(publicEstimatePortalErrors.declineReasonTooLong)
  }
  return ok({ reason })
}

export function createPublicEstimateAcceptanceRecord(params: {
  acceptedAt: string
  ip?: string
  legalName: string
  signatureType: EstimatePublicSignatureType
  signatureValue: string
  userAgent?: string
}): EstimatePublicAcceptanceRecord {
  return {
    legal_name: params.legalName,
    signature_type: params.signatureType,
    signature_value: params.signatureValue,
    accepted_terms: true,
    accepted_at: params.acceptedAt,
    user_agent: asText(params.userAgent),
    ip: asText(params.ip),
  }
}
