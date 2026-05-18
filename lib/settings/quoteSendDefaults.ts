import { templatePresets, type TemplatePreset } from '../customer-estimates/presets.ts'
import {
  DEFAULT_ESTIMATE_TEMPLATE_KEY,
  DEFAULT_QUOTE_VALIDITY_DAYS,
  DEFAULT_TERMS_TEXT,
} from '../estimator/defaults.ts'
import {
  defaultQuoteTermsSections,
  normalizeQuoteTermsSections,
} from '../customer-estimates/termsDefaults.ts'
import type { QuoteSendDefaults } from './types.ts'

type Unsafe = Record<string, unknown>

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export const emptyQuoteSendDefaults: QuoteSendDefaults = {
  default_template_key: DEFAULT_ESTIMATE_TEMPLATE_KEY,
  quote_validity_days: DEFAULT_QUOTE_VALIDITY_DAYS,
  terms_font_size: 14.8,
  terms_text: DEFAULT_TERMS_TEXT,
  terms_sections: defaultQuoteTermsSections,
  template_presets: templatePresets,
}

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

function asFiniteNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeTemplatePresets(value: unknown): TemplatePreset[] {
  const rows = Array.isArray(value) ? value : []
  const byKey = new Map(
    rows
      .filter((row): row is Unsafe => !!row && typeof row === 'object' && !Array.isArray(row))
      .map((row) => [asText(row.key), row] as const)
      .filter(([key]) => !!key)
  )

  return templatePresets.map((fallback) => {
    const row = byKey.get(fallback.key)
    return {
      key: fallback.key,
      label: asText(row?.label) || fallback.label,
      subject: asText(row?.subject) || fallback.subject,
      body: asText(row?.body) || fallback.body,
    }
  })
}

export function normalizeQuoteSendDefaults(row: Unsafe | null | undefined): QuoteSendDefaults {
  const normalizedTemplatePresets = normalizeTemplatePresets(row?.template_presets)
  return {
    default_template_key: asText(row?.default_template_key) || emptyQuoteSendDefaults.default_template_key,
    quote_validity_days: asInteger(row?.quote_validity_days) ?? emptyQuoteSendDefaults.quote_validity_days,
    terms_font_size: asFiniteNumber(row?.terms_font_size) ?? emptyQuoteSendDefaults.terms_font_size,
    terms_text: asNormalizedTerms(row?.terms_text) || emptyQuoteSendDefaults.terms_text,
    terms_sections: normalizeQuoteTermsSections(row?.terms_sections),
    template_presets: normalizedTemplatePresets,
  }
}

export function parseQuoteSendDefaults(input: unknown): ParseResult<QuoteSendDefaults> {
  const row = (input ?? null) as Unsafe | null
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ok: false, error: 'Missing quote send defaults payload.' }
  }

  const data = normalizeQuoteSendDefaults(row)

  const allowedTemplateKeys = new Set(data.template_presets.map((preset) => preset.key))
  if (!allowedTemplateKeys.has(data.default_template_key)) {
    return { ok: false, error: 'Default template preset is invalid.' }
  }
  if (!Number.isInteger(data.quote_validity_days) || data.quote_validity_days < 1 || data.quote_validity_days > 365) {
    return { ok: false, error: 'Quote validity days must be an integer between 1 and 365.' }
  }
  if (data.terms_font_size < 11 || data.terms_font_size > 18) {
    return { ok: false, error: 'Terms font size must be between 11 and 18.' }
  }
  if (data.terms_text.length > 8000) {
    return { ok: false, error: 'Terms and conditions must be 8000 characters or fewer.' }
  }
  const termsSectionsText = JSON.stringify(data.terms_sections)
  if (termsSectionsText.length > 20000) {
    return { ok: false, error: 'Structured quote terms must be 20000 characters or fewer.' }
  }
  for (const preset of data.template_presets) {
    if (preset.label.length > 80 || preset.subject.length > 200 || preset.body.length > 4000) {
      return { ok: false, error: 'Template presets contain text that is too long.' }
    }
  }

  return { ok: true, data }
}

export function getQuoteSendDefaultsValidationError(data: QuoteSendDefaults) {
  const parsed = parseQuoteSendDefaults(data)
  return parsed.ok ? null : parsed.error
}
