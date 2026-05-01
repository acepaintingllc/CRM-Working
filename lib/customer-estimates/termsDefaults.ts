import {
  DEFAULT_CUSTOMER_RESPONSIBILITIES,
  DEFAULT_EXCLUSIONS,
  DEFAULT_INCLUDED_PREPARATION,
  DEFAULT_SCOPE_CHANGE_TERMS,
  DEFAULT_THANK_YOU,
} from './documentFallbacks.ts'

export type QuoteTermsSections = {
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

export const defaultQuoteTermsSections: QuoteTermsSections = {
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
  const includedPreparation = readSectionObject(row.included_preparation)
  const pricingPayment = readSectionObject(row.pricing_payment)

  return {
    included_preparation: {
      walls: textOrDefault(
        includedPreparation.walls,
        defaultQuoteTermsSections.included_preparation.walls
      ),
      ceilings: textOrDefault(
        includedPreparation.ceilings,
        defaultQuoteTermsSections.included_preparation.ceilings
      ),
      trim: textOrDefault(
        includedPreparation.trim,
        defaultQuoteTermsSections.included_preparation.trim
      ),
    },
    customer_responsibilities: textOrDefault(
      row.customer_responsibilities,
      defaultQuoteTermsSections.customer_responsibilities
    ),
    exclusions: textOrDefault(row.exclusions, defaultQuoteTermsSections.exclusions),
    scope_changes: textOrDefault(row.scope_changes, defaultQuoteTermsSections.scope_changes),
    pricing_payment: {
      payment_instructions: textOrDefault(
        pricingPayment.payment_instructions,
        defaultQuoteTermsSections.pricing_payment.payment_instructions
      ),
      deposit_terms: textOrDefault(
        pricingPayment.deposit_terms,
        defaultQuoteTermsSections.pricing_payment.deposit_terms
      ),
      balance_due: textOrDefault(
        pricingPayment.balance_due,
        defaultQuoteTermsSections.pricing_payment.balance_due
      ),
      card_fee_note: textOrDefault(
        pricingPayment.card_fee_note,
        defaultQuoteTermsSections.pricing_payment.card_fee_note
      ),
    },
    insurance: textOrDefault(row.insurance, defaultQuoteTermsSections.insurance),
    thank_you: textOrDefault(row.thank_you, defaultQuoteTermsSections.thank_you),
  }
}
