import type { CompanyProfileSettings } from './types.ts'

type Unsafe = Record<string, unknown>

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export const emptyCompanyProfileSettings: CompanyProfileSettings = {
  business_name: '',
  timezone: 'America/Chicago',
  main_phone: '',
  business_email: '',
  address: '',
  website: '',
  sender_signature: '',
  logo_url: '',
}

const maxLength = {
  business_name: 120,
  timezone: 80,
  main_phone: 40,
  business_email: 160,
  address: 240,
  website: 240,
  sender_signature: 4000,
  logo_url: 500,
} as const

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function enforceMaxLength(value: string, label: string, limit: number) {
  if (value.length > limit) {
    return `${label} must be ${limit} characters or fewer.`
  }
  return null
}

export function normalizeCompanyProfileSettings(row: Unsafe | null | undefined): CompanyProfileSettings {
  return {
    business_name: asText(row?.business_name),
    timezone: asText(row?.timezone) || emptyCompanyProfileSettings.timezone,
    main_phone: asText(row?.main_phone),
    business_email: asText(row?.business_email),
    address: asText(row?.address),
    website: asText(row?.website),
    sender_signature: asText(row?.sender_signature),
    logo_url: asText(row?.logo_url),
  }
}

export function parseCompanyProfileSettings(input: unknown): ParseResult<CompanyProfileSettings> {
  const row = (input ?? null) as Unsafe | null
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ok: false, error: 'Missing company profile payload.' }
  }

  const data = normalizeCompanyProfileSettings(row)

  if (!data.business_name) {
    return { ok: false, error: 'Business name is required.' }
  }
  if (!data.timezone) {
    return { ok: false, error: 'Timezone is required.' }
  }

  const businessNameError = enforceMaxLength(data.business_name, 'Business name', maxLength.business_name)
  if (businessNameError) return { ok: false, error: businessNameError }

  const timezoneError = enforceMaxLength(data.timezone, 'Timezone', maxLength.timezone)
  if (timezoneError) return { ok: false, error: timezoneError }

  const phoneError = enforceMaxLength(data.main_phone, 'Main phone', maxLength.main_phone)
  if (phoneError) return { ok: false, error: phoneError }

  const emailError = enforceMaxLength(data.business_email, 'Business email', maxLength.business_email)
  if (emailError) return { ok: false, error: emailError }
  if (data.business_email && !isValidEmail(data.business_email)) {
    return { ok: false, error: 'Business email must be a valid email address.' }
  }

  const addressError = enforceMaxLength(data.address, 'Address', maxLength.address)
  if (addressError) return { ok: false, error: addressError }

  const websiteError = enforceMaxLength(data.website, 'Website', maxLength.website)
  if (websiteError) return { ok: false, error: websiteError }
  if (data.website && !isValidUrl(data.website)) {
    return { ok: false, error: 'Website must be a valid http or https URL.' }
  }

  const signatureError = enforceMaxLength(
    data.sender_signature,
    'Default sender signature',
    maxLength.sender_signature
  )
  if (signatureError) return { ok: false, error: signatureError }

  const logoError = enforceMaxLength(data.logo_url, 'Logo URL', maxLength.logo_url)
  if (logoError) return { ok: false, error: logoError }
  if (data.logo_url && !isValidUrl(data.logo_url)) {
    return { ok: false, error: 'Logo URL must be a valid http or https URL.' }
  }

  return { ok: true, data }
}

export function getCompanyProfileValidationError(data: CompanyProfileSettings) {
  const parsed = parseCompanyProfileSettings(data)
  return parsed.ok ? null : parsed.error
}
