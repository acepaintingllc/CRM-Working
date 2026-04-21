import { templatePresets } from '../customer-estimates/presets.ts'
import {
  DEFAULT_ESTIMATE_TEMPLATE_KEY,
  DEFAULT_QUOTE_VALIDITY_DAYS,
  DEFAULT_TERMS_TEXT,
} from '../estimator/defaults.ts'
import type { QuoteSendDefaults } from './types.ts'

type Unsafe = Record<string, unknown>

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export const emptyQuoteSendDefaults: QuoteSendDefaults = {
  default_template_key: DEFAULT_ESTIMATE_TEMPLATE_KEY,
  quote_validity_days: DEFAULT_QUOTE_VALIDITY_DAYS,
  terms_text: DEFAULT_TERMS_TEXT,
}

const allowedTemplateKeys = new Set(templatePresets.map((preset) => preset.key))

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNormalizedTerms(value: unknown) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
}

function asInteger(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.trunc(parsed)
}

export function normalizeQuoteSendDefaults(row: Unsafe | null | undefined): QuoteSendDefaults {
  return {
    default_template_key: asText(row?.default_template_key) || emptyQuoteSendDefaults.default_template_key,
    quote_validity_days: asInteger(row?.quote_validity_days) ?? emptyQuoteSendDefaults.quote_validity_days,
    terms_text: asNormalizedTerms(row?.terms_text) || emptyQuoteSendDefaults.terms_text,
  }
}

export function parseQuoteSendDefaults(input: unknown): ParseResult<QuoteSendDefaults> {
  const row = (input ?? null) as Unsafe | null
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ok: false, error: 'Missing quote send defaults payload.' }
  }

  const data = normalizeQuoteSendDefaults(row)

  if (!allowedTemplateKeys.has(data.default_template_key)) {
    return { ok: false, error: 'Default template preset is invalid.' }
  }
  if (!Number.isInteger(data.quote_validity_days) || data.quote_validity_days < 1 || data.quote_validity_days > 365) {
    return { ok: false, error: 'Quote validity days must be an integer between 1 and 365.' }
  }
  if (data.terms_text.length > 8000) {
    return { ok: false, error: 'Terms and conditions must be 8000 characters or fewer.' }
  }

  return { ok: true, data }
}

export function getQuoteSendDefaultsValidationError(data: QuoteSendDefaults) {
  const parsed = parseQuoteSendDefaults(data)
  return parsed.ok ? null : parsed.error
}
