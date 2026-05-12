import {
  DEFAULT_CUSTOMER_RESPONSIBILITIES,
  DEFAULT_EXCLUSIONS,
  DEFAULT_INCLUDED_PREPARATION,
  DEFAULT_SCOPE_CHANGE_TERMS,
  DEFAULT_THANK_YOU,
} from './documentFallbacks.ts'

export type QuoteTermsSections = {
  our_process: string
  project_terms: string
}

type LegacyQuoteTermsSections = {
  included_preparation: {
    walls: string
    ceilings: string
    trim: string
  }
  customer_responsibilities: string
  exclusions: string
  scope_changes: string
  pricing_payment: {
    payment_instructions: string
    deposit_terms: string
    balance_due: string
    card_fee_note: string
  }
  insurance: string
  thank_you: string
}

type Unsafe = Record<string, unknown>

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function splitTermsParagraphs(value: string) {
  return asText(value)
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function joinParagraphs(values: string[]) {
  return values.map(asText).filter(Boolean).join('\n\n')
}

function buildDefaultOurProcess() {
  return joinParagraphs([
    'Our team will review the project scope with you before work begins and confirm the areas included in this quote.',
    `Walls: ${DEFAULT_INCLUDED_PREPARATION.find((item) => item.key === 'walls')?.text ?? ''}`,
    `Ceilings: ${DEFAULT_INCLUDED_PREPARATION.find((item) => item.key === 'ceilings')?.text ?? ''}`,
    `Trim: ${DEFAULT_INCLUDED_PREPARATION.find((item) => item.key === 'trim')?.text ?? ''}`,
    ...DEFAULT_CUSTOMER_RESPONSIBILITIES,
    ...DEFAULT_SCOPE_CHANGE_TERMS,
  ])
}

function buildDefaultProjectTerms() {
  return joinParagraphs([
    ...DEFAULT_EXCLUSIONS,
    'Make all checks payable to ACE Painting LLC.',
    'Pricing is valid for {quote_validity_days} days from the date of this quote.',
    'A deposit may be required for scheduling or special-order materials.',
    'The remaining balance is due upon completion unless otherwise agreed in writing.',
    'Credit card payments are subject to a processing fee.',
    'ACE Painting LLC is fully insured. Certificate of Insurance available upon request.',
    ...DEFAULT_THANK_YOU,
  ])
}

export const defaultQuoteTermsSections: QuoteTermsSections = {
  our_process: buildDefaultOurProcess(),
  project_terms: buildDefaultProjectTerms(),
}

const legacyDefaultQuoteTermsSections: LegacyQuoteTermsSections = {
  included_preparation: {
    walls: DEFAULT_INCLUDED_PREPARATION.find((item) => item.key === 'walls')?.text ?? '',
    ceilings: DEFAULT_INCLUDED_PREPARATION.find((item) => item.key === 'ceilings')?.text ?? '',
    trim: DEFAULT_INCLUDED_PREPARATION.find((item) => item.key === 'trim')?.text ?? '',
  },
  customer_responsibilities: DEFAULT_CUSTOMER_RESPONSIBILITIES.join('\n\n'),
  exclusions: DEFAULT_EXCLUSIONS.join('\n\n'),
  scope_changes: DEFAULT_SCOPE_CHANGE_TERMS.join('\n\n'),
  pricing_payment: {
    payment_instructions: 'Make all checks payable to ACE Painting LLC.',
    deposit_terms: 'A deposit may be required for scheduling or special-order materials.',
    balance_due: 'The remaining balance is due upon completion unless otherwise agreed in writing.',
    card_fee_note: 'Credit card payments are subject to a processing fee.',
  },
  insurance:
    'ACE Painting LLC is fully insured. Certificate of Insurance available upon request.',
  thank_you: DEFAULT_THANK_YOU.join('\n\n'),
}

function readSectionObject(value: unknown): Unsafe {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Unsafe) : {}
}

function textOrDefault(value: unknown, fallback: string) {
  return asText(value) || fallback
}

export function normalizeQuoteTermsSections(value: unknown): QuoteTermsSections {
  const row = readSectionObject(value)
  const explicitOurProcess = asText(row.our_process)
  const explicitProjectTerms = asText(row.project_terms)
  if (explicitOurProcess || explicitProjectTerms) {
    return {
      our_process: explicitOurProcess || defaultQuoteTermsSections.our_process,
      project_terms: explicitProjectTerms || defaultQuoteTermsSections.project_terms,
    }
  }
  if (Object.keys(row).length === 0) {
    return defaultQuoteTermsSections
  }

  const includedPreparation = readSectionObject(row.included_preparation)
  const pricingPayment = readSectionObject(row.pricing_payment)
  const legacyTerms = {
    included_preparation: {
      walls: textOrDefault(
        includedPreparation.walls,
        legacyDefaultQuoteTermsSections.included_preparation.walls
      ),
      ceilings: textOrDefault(
        includedPreparation.ceilings,
        legacyDefaultQuoteTermsSections.included_preparation.ceilings
      ),
      trim: textOrDefault(
        includedPreparation.trim,
        legacyDefaultQuoteTermsSections.included_preparation.trim
      ),
    },
    customer_responsibilities: textOrDefault(
      row.customer_responsibilities,
      legacyDefaultQuoteTermsSections.customer_responsibilities
    ),
    exclusions: textOrDefault(row.exclusions, legacyDefaultQuoteTermsSections.exclusions),
    scope_changes: textOrDefault(row.scope_changes, legacyDefaultQuoteTermsSections.scope_changes),
    pricing_payment: {
      payment_instructions: textOrDefault(
        pricingPayment.payment_instructions,
        legacyDefaultQuoteTermsSections.pricing_payment.payment_instructions
      ),
      deposit_terms: textOrDefault(
        pricingPayment.deposit_terms,
        legacyDefaultQuoteTermsSections.pricing_payment.deposit_terms
      ),
      balance_due: textOrDefault(
        pricingPayment.balance_due,
        legacyDefaultQuoteTermsSections.pricing_payment.balance_due
      ),
      card_fee_note: textOrDefault(
        pricingPayment.card_fee_note,
        legacyDefaultQuoteTermsSections.pricing_payment.card_fee_note
      ),
    },
    insurance: textOrDefault(row.insurance, legacyDefaultQuoteTermsSections.insurance),
    thank_you: textOrDefault(row.thank_you, legacyDefaultQuoteTermsSections.thank_you),
  }

  return {
    our_process: joinParagraphs([
      `Walls: ${legacyTerms.included_preparation.walls}`,
      `Ceilings: ${legacyTerms.included_preparation.ceilings}`,
      `Trim: ${legacyTerms.included_preparation.trim}`,
      ...splitTermsParagraphs(legacyTerms.customer_responsibilities),
      ...splitTermsParagraphs(legacyTerms.scope_changes),
    ]),
    project_terms: joinParagraphs([
      ...splitTermsParagraphs(legacyTerms.exclusions),
      legacyTerms.pricing_payment.payment_instructions,
      'Pricing is valid for {quote_validity_days} days from the date of this quote.',
      legacyTerms.pricing_payment.deposit_terms,
      legacyTerms.pricing_payment.balance_due,
      legacyTerms.pricing_payment.card_fee_note,
      ...splitTermsParagraphs(legacyTerms.insurance),
      ...splitTermsParagraphs(legacyTerms.thank_you),
    ]),
  }
}
