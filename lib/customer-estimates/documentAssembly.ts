import { reconcileWholeDollarRows } from '../estimator/pricingPolicies.ts'
import { buildDefaultTermsText } from './presets.ts'
import {
  asText,
  formatAddressFromParts,
  formatHumanDate,
  round2,
} from './buildShared.ts'
import type {
  BuiltCustomerEstimateDocument,
  CustomerEstimateCustomer,
  CustomerEstimateQuoteRow,
} from './types.ts'
import type {
  NormalizedCustomerEstimateInput,
  NormalizedCustomerRecord,
  NormalizedJobRecord,
} from './inputNormalization.ts'
import { buildCustomerEstimateSections, splitParagraphs } from './textGeneration.ts'
import type { ScopeBuckets } from './scopeExtraction.ts'

export function buildCustomerProfile(params: {
  customer?: NormalizedCustomerRecord | null
  job: NormalizedJobRecord
}): CustomerEstimateCustomer {
  const customer = params.customer ?? null
  const job = params.job
  const address = formatAddressFromParts({
    address: asText(customer?.address || job.customer_address),
    street: asText(customer?.street),
    city: asText(customer?.city),
    state: asText(customer?.state),
    zip: asText(customer?.zip),
  })
  return {
    name: asText(customer?.name || job.customer_name),
    email: asText(customer?.email || job.customer_email),
    phone: asText(customer?.phone || job.customer_phone),
    address,
    street: asText(customer?.street),
    city: asText(customer?.city),
    state: asText(customer?.state),
    zip: asText(customer?.zip),
  }
}

export function assembleCustomerEstimateBuild(params: {
  normalized: NormalizedCustomerEstimateInput
  scoped: ScopeBuckets
}): BuiltCustomerEstimateDocument {
  const { normalized, scoped } = params
  const estimate = normalized.estimate
  const job = normalized.job
  const total = normalized.pricingSummary?.finalTotal ?? null
  const versionName = asText(estimate.version_name) || 'Quote'
  const flowVersion = 'v2'
  const status = asText(normalized.publicMeta?.status) || asText(estimate.version_state) || 'draft'
  const title = normalized.overrides?.title?.trim() || versionName
  const estimateDate = asText(job.estimate_date || estimate.created_at || estimate.updated_at)
  const intro =
    normalized.overrides?.intro_paragraph?.trim() ||
    `Thank you for the opportunity to prepare this quote for ${asText(job.customer_name) || 'your project'}.`
  const closing =
    normalized.overrides?.closing_paragraph?.trim() ||
    'Please review the quote below. If everything looks right, you can accept it directly from the secure link.'
  const quoteValidityDays = resolveQuoteValidityDays(
    normalized.overrides?.quote_validity_days,
    normalized.settings?.quote_validity_days
  )
  const depositLanguage =
    normalized.overrides?.deposit_language?.trim() ||
    'A deposit may be required for scheduling or special-order materials.'
  const cardFeeNote =
    normalized.overrides?.card_fee_note?.trim() ||
    'Credit card payments are subject to a processing fee.'
  const termsText = normalized.settings?.terms_text?.trim() || ''
  const terms = splitParagraphs(
    termsText ||
      buildDefaultTermsText({
        quoteValidityDays,
        estimateDate,
        depositLanguage,
        cardFeeNote,
      })
  )

  const sections = buildCustomerEstimateSections({
    scoped,
    overrides: normalized.overrides,
  }).filter((section) => section.price != null && section.text.trim())
  const customer = buildCustomerProfile({ customer: normalized.customer, job })
  const quoteRows: CustomerEstimateQuoteRow[] = reconcileWholeDollarRows(
    sections.map((section) => ({
      key: section.key,
      label: section.label,
      description: section.text.trim(),
      price: section.price ?? 0,
    })),
    total ?? null
  )
  const computedTotal = Math.round(total ?? round2(quoteRows.reduce((sum, section) => sum + section.price, 0)))

  return {
    meta: {
      estimate_id: asText(estimate.id),
      version_name: versionName,
      version_state: asText(estimate.version_state) || 'draft',
      flow_version: flowVersion,
      title,
      quote_date: formatHumanDate(estimateDate),
      sent_at: normalized.publicMeta?.sent_at ?? null,
      viewed_at: normalized.publicMeta?.viewed_at ?? null,
      accepted_at: normalized.publicMeta?.accepted_at ?? null,
      declined_at: normalized.publicMeta?.declined_at ?? null,
      status,
      public_token: normalized.publicMeta?.public_token ?? null,
    },
    company: normalized.company,
    customer,
    intro_paragraph: intro,
    closing_paragraph: closing,
    quote_validity_days: quoteValidityDays,
    deposit_language: depositLanguage,
    card_fee_note: cardFeeNote,
    quote_rows: quoteRows,
    scopes: sections,
    total: computedTotal,
    terms,
    source_meta: {
      company: {
        business_name: !!asText(normalized.company.business_name),
        main_phone: !!asText(normalized.company.main_phone),
        business_email: !!asText(normalized.company.business_email),
        address: !!asText(normalized.company.address),
        website: !!asText(normalized.company.website),
        sender_signature: !!asText(normalized.company.sender_signature),
        logo_url: !!asText(normalized.company.logo_url),
      },
      settings: {
        quote_validity_days:
          normalized.overrides?.quote_validity_days != null ||
          normalized.settings?.quote_validity_days != null,
        terms_text: !!normalized.settings?.terms_text?.trim(),
      },
      overrides: {
        title: !!normalized.overrides?.title?.trim(),
        intro_paragraph: !!normalized.overrides?.intro_paragraph?.trim(),
        closing_paragraph: !!normalized.overrides?.closing_paragraph?.trim(),
        deposit_language: !!normalized.overrides?.deposit_language?.trim(),
        card_fee_note: !!normalized.overrides?.card_fee_note?.trim(),
      },
    },
  }
}

function resolveQuoteValidityDays(
  overrideValue: string | number | null | undefined,
  settingsValue: number | null | undefined
) {
  for (const value of [overrideValue, settingsValue, 90]) {
    const candidate = Number(value)
    if (Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate)
    }
  }
  return 90
}
