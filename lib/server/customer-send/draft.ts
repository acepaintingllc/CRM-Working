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
  return {
    walls: '',
    ceilings: '',
    trim: '',
    doors: '',
    drywall: '',
    cabinets: '',
    other: '',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function readDraftPayload(body: Record<string, unknown> | null | undefined): Record<string, unknown> {
  // Request body JSON is untrusted until we verify it is an object.
  if (isRecord(body?.draft)) return body.draft
  return isRecord(body) ? body : {}
}

function readScopeTextEditsPayload(draft: Record<string, unknown>): Record<string, unknown> {
  // Nested request JSON is untrusted until we verify it is an object.
  return isRecord(draft.scope_text_edits) ? draft.scope_text_edits : {}
}

function buildDraftInputRecord(draft: CustomerSendDraft | null | undefined): Record<string, unknown> {
  if (!draft) return {}
  return {
    to_email: draft.to_email,
    cc_email: draft.cc_email,
    bcc_email: draft.bcc_email,
    subject: draft.subject,
    body: draft.body,
    template_key: draft.template_key,
    title: draft.title,
    intro_paragraph: draft.intro_paragraph,
    closing_paragraph: draft.closing_paragraph,
    terms_text: draft.terms_text,
    scope_text_edits: {
      ...buildEmptyScopeTextEdits(),
      ...draft.scope_text_edits,
    },
    quote_validity_days: draft.quote_validity_days,
    deposit_language: draft.deposit_language,
    card_fee_note: draft.card_fee_note,
  }
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
  const draft = readDraftPayload(body)
  const scopeTextEditsRaw = readScopeTextEditsPayload(draft)
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

export function mergeCustomerSendDraftInput(params: {
  baseDraft: CustomerSendDraft | null | undefined
  body: Record<string, unknown> | null | undefined
}): CustomerSendDraft {
  const baseDraft = buildDraftInputRecord(params.baseDraft)
  const incomingDraft = readDraftPayload(params.body)
  const mergedScopeTextEdits = {
    ...readScopeTextEditsPayload(baseDraft),
    ...readScopeTextEditsPayload(incomingDraft),
  }

  return sanitizeCustomerSendDraft({
    ...baseDraft,
    ...incomingDraft,
    scope_text_edits: mergedScopeTextEdits,
  })
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

  const baselineByKey = new Map<CustomerSendScopeKey, string>(
    baseline.data.scopes.map((section) => [section.key, section.text])
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

function normalizeComparableScopeText(value: string | null | undefined) {
  return asText(value)
}

export function didCustomerSendArtifactInputsChange(params: {
  currentDraft: CustomerSendDraft | null | undefined
  nextDraft: CustomerSendDraft
}): boolean {
  const current = params.currentDraft
  if (!current) return true

  if (asText(current.title) !== asText(params.nextDraft.title)) return true
  if (asText(current.intro_paragraph) !== asText(params.nextDraft.intro_paragraph)) return true
  if (asText(current.closing_paragraph) !== asText(params.nextDraft.closing_paragraph)) return true
  if ((current.quote_validity_days ?? null) !== (params.nextDraft.quote_validity_days ?? null)) {
    return true
  }
  if (asText(current.deposit_language) !== asText(params.nextDraft.deposit_language)) return true
  if (asText(current.card_fee_note) !== asText(params.nextDraft.card_fee_note)) return true

  for (const key of CUSTOMER_SEND_SCOPE_KEYS) {
    if (
      normalizeComparableScopeText(current.scope_text_edits[key]) !==
      normalizeComparableScopeText(params.nextDraft.scope_text_edits[key])
    ) {
      return true
    }
  }

  return false
}
