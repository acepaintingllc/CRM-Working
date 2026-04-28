import {
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  buildCustomerSendDocument,
  buildCustomerSendPublicMeta,
  asText,
} from './document'
import type {
  CustomerSendDraft,
  CustomerSendScopeKey,
  EstimateCustomerSendContextData,
} from './types'
import { CUSTOMER_SEND_SCOPE_KEYS } from './types'

function asMaybeNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function buildEmptyScopeTextEdits(): Record<CustomerSendScopeKey, string> {
  return CUSTOMER_SEND_SCOPE_KEYS.reduce(
    (acc, key) => {
      acc[key] = ''
      return acc
    },
    {} as Record<CustomerSendScopeKey, string>
  )
}

function normalizeScopeTextForComparison(value: string): string {
  return asText(value)
    .toLowerCase()
    .replace(/\bwith\b/g, 'using')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

function stripGeneratedProductClause(value: string): string {
  return value
    .replace(/,\s*using\s+[^.,;!?]+(?=\s*(?:,\s*with\b|[.,;!?]?$))/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

function matchesGeneratedScopeText(value: string, baseText: string) {
  const normalizedValue = normalizeScopeTextForComparison(value)
  const normalizedBase = normalizeScopeTextForComparison(baseText)

  return (
    normalizedValue === normalizedBase ||
    normalizedValue === stripGeneratedProductClause(normalizedBase)
  )
}

export function sanitizeCustomerSendDraft(
  body: Record<string, unknown> | null | undefined
): CustomerSendDraft {
  const draft = (body?.draft as Record<string, unknown> | null | undefined) ?? body ?? {}
  const scopeTextEditsRaw =
    (draft.scope_text_edits as Record<string, unknown> | null | undefined) ?? {}
  const scopeTextEdits = buildEmptyScopeTextEdits()

  for (const key of CUSTOMER_SEND_SCOPE_KEYS) {
    scopeTextEdits[key] = asText(scopeTextEditsRaw[key])
  }

  return {
    to_email: asText(draft.to_email),
    cc_email: asText(draft.cc_email),
    bcc_email: asText(draft.bcc_email),
    subject: asText(draft.subject),
    body: asText(draft.body),
    template_key: asText(draft.template_key),
    title: asText(draft.title),
    intro_paragraph: asText(draft.intro_paragraph),
    closing_paragraph: asText(draft.closing_paragraph),
    terms_text: asText(draft.terms_text),
    scope_text_edits: scopeTextEdits,
    quote_validity_days: asMaybeNumber(draft.quote_validity_days),
    deposit_language: asText(draft.deposit_language),
    card_fee_note: asText(draft.card_fee_note),
  } satisfies CustomerSendDraft
}

export function normalizeCustomerSendDraftScopeText(params: {
  context: EstimateCustomerSendContextData
  draft: CustomerSendDraft
}): ServiceResult<CustomerSendDraft> {
  const baseline = buildCustomerSendDocument({
    context: params.context,
    publicMeta: buildCustomerSendPublicMeta(null, 'draft'),
  })
  if (!baseline.ok) return baseline

  const baselineByKey = new Map(
    baseline.data.scopes.map((section) => [section.key, section.text] as const)
  )
  const normalizedScopeTextEdits = buildEmptyScopeTextEdits()

  for (const key of CUSTOMER_SEND_SCOPE_KEYS) {
    const value = asText(params.draft.scope_text_edits[key])
    if (!value) {
      normalizedScopeTextEdits[key] = ''
      continue
    }

    const baseText = asText(baselineByKey.get(key))
    if (
      baseText &&
      matchesGeneratedScopeText(value, baseText)
    ) {
      normalizedScopeTextEdits[key] = ''
      continue
    }

    normalizedScopeTextEdits[key] = value
  }

  return okResult({
    ...params.draft,
    scope_text_edits: normalizedScopeTextEdits,
  })
}

export function normalizeCustomerSendMode(value: unknown): 'test' | 'send' {
  return asText(value).toLowerCase() === 'test' ? 'test' : 'send'
}
