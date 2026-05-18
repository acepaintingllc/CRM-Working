import type {
  BuiltCustomerEstimateDocument,
  CompanyProfile,
  CustomerEstimateDocument,
  CustomerEstimateDocumentSourceMeta,
  CustomerEstimateTermsPage,
  CustomerEstimateTermsSection,
} from './types'
import {
  DEFAULT_CUSTOMER_RESPONSIBILITIES,
  DEFAULT_DOCUMENT_LABEL,
  DEFAULT_EXCLUSIONS,
  DEFAULT_INCLUDED_PREPARATION,
  DEFAULT_QUOTE_FOOTER_NOTE,
  DEFAULT_SCOPE_CHANGE_TERMS,
  DEFAULT_THANK_YOU,
  DOCUMENT_PLACEHOLDERS,
} from './documentFallbacks.ts'
import {
  normalizeQuoteTermsSections,
  splitTermsParagraphs,
  type QuoteTermsSections,
} from './termsDefaults.ts'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function nonEmptyLines(values: string[]) {
  return values.map((value) => asText(value)).filter(Boolean)
}

function pickValueOrPlaceholder(
  value: string,
  placeholder: string,
  missing: string[]
) {
  const text = asText(value)
  if (text) return text
  missing.push(placeholder)
  return placeholder
}

function pickCompanyValue(
  value: string,
  placeholder: string,
  field: keyof CompanyProfile,
  missing: Array<keyof CompanyProfile>
) {
  const text = asText(value)
  if (text) return text
  missing.push(field)
  return placeholder
}

function buildCustomerLines(document: BuiltCustomerEstimateDocument) {
  const lines: string[] = []
  const customer = document.customer
  if (customer.name) {
    lines.push(customer.name)
  } else {
    lines.push(DOCUMENT_PLACEHOLDERS.customerName)
  }
  if (customer.address) {
    lines.push(
      ...customer.address
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    )
  } else {
    const line1 = [customer.street].filter(Boolean).join(' ').trim()
    const line2 = [customer.city, [customer.state, customer.zip].filter(Boolean).join(' ').trim()]
      .filter(Boolean)
      .join(', ')
    lines.push(...[line1, line2].filter(Boolean))
  }
  return lines
}

function buildPricingTermsSection(document: BuiltCustomerEstimateDocument) {
  const missingPaymentFields: string[] = []
  const depositLanguage = document.source_meta.overrides.deposit_language
    ? asText(document.deposit_language)
    : pickValueOrPlaceholder('', DOCUMENT_PLACEHOLDERS.depositTerms, missingPaymentFields)
  const cardFeeNote = document.source_meta.overrides.card_fee_note
    ? asText(document.card_fee_note)
    : pickValueOrPlaceholder('', DOCUMENT_PLACEHOLDERS.cardFeeNote, missingPaymentFields)

  return {
    section: {
      key: 'pricing_payment',
      title: 'Pricing & Payment Terms',
      paragraphs: [
        'This quote includes labor and all materials and supplies unless otherwise noted.',
        `Pricing is valid for ${document.quote_validity_days} days from the date of this quote.`,
        depositLanguage,
        cardFeeNote,
      ],
    } satisfies CustomerEstimateTermsSection,
    missingPaymentFields,
  }
}

function buildAdditionalTermsSection(document: BuiltCustomerEstimateDocument) {
  if (!document.terms.length) return null
  return {
    key: document.source_meta.settings.terms_text ? 'terms_and_conditions' : 'additional_terms',
    title: 'Terms & Conditions',
    paragraphs: document.terms,
  } satisfies CustomerEstimateTermsSection
}

const recognizedStructuredTermHeadings = new Map<string, string>([
  ['our process', 'Our Process'],
  ['our process & what to expect', 'Our Process & What to Expect'],
  ['include preparation', 'Included Preparation'],
  ['included preparation', 'Included Preparation'],
  ['include preperation', 'Included Preparation'],
  ['included preperation', 'Included Preparation'],
  ['customer responsibilities', 'Customer Responsibilities'],
  ['customer responsibility', 'Customer Responsibilities'],
  ['before we start', 'Before We Start'],
  ['during & after the project', 'During & After the Project'],
  ['during and after the project', 'During & After the Project'],
  ['scope of work', 'Scope of Work'],
  ['exclusions', 'Exclusions'],
  ['changes to scope', 'Changes to Scope'],
  ['pricing & payment terms', 'Pricing & Payment Terms'],
  ['pricing and payment terms', 'Pricing & Payment Terms'],
  ['pricing & payment', 'Pricing & Payment Terms'],
  ['pricing and payment', 'Pricing & Payment Terms'],
  ['payment terms', 'Pricing & Payment Terms'],
  ['insurance', 'Insurance'],
  ['thank you', 'Thank You'],
  ['project terms', 'Project Terms'],
])

function normalizeStructuredTermHeading(value: string) {
  return asText(value)
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[:.]+$/g, '')
    .trim()
    .toLowerCase()
}

function sectionKeyFromTitle(title: string) {
  return normalizeStructuredTermHeading(title)
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function splitStructuredTermLines(value: string) {
  return value
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function buildDetectedStructuredTermsSections(params: {
  keyPrefix: string
  fallbackTitle: string
  text: string
}): CustomerEstimateTermsSection[] {
  const lines = splitStructuredTermLines(params.text)
  const sections: CustomerEstimateTermsSection[] = []
  let current: CustomerEstimateTermsSection | null = null

  const pushCurrent = () => {
    if (current?.paragraphs.length) sections.push(current)
    current = null
  }

  for (const line of lines) {
    const heading = recognizedStructuredTermHeadings.get(normalizeStructuredTermHeading(line))
    if (heading) {
      pushCurrent()
      current = {
        key: `${params.keyPrefix}_${sectionKeyFromTitle(heading)}`,
        title: heading,
        paragraphs: [],
      }
      continue
    }

    if (!current) {
      current = {
        key: params.keyPrefix,
        title: params.fallbackTitle,
        paragraphs: [],
      }
    }
    current.paragraphs.push(line)
  }

  pushCurrent()

  if (sections.length > 0) return sections

  const paragraphs = splitTermsParagraphs(params.text)
  if (paragraphs.length === 0) return []

  return [
    {
      key: params.keyPrefix,
      title: params.fallbackTitle,
      paragraphs,
    },
  ]
}

function buildStructuredTermsSections(
  terms: QuoteTermsSections,
  quoteValidityDays: number
): CustomerEstimateTermsPage[] {
  const replaceTokens = (value: string) =>
    value.replace(/\{quote_validity_days\}/g, String(quoteValidityDays))
  const ourProcessText = replaceTokens(terms.our_process)
  const projectTermsText = replaceTokens(terms.project_terms)
  const pages = [
    {
      title: 'Our Process & What to Expect',
      sections: buildDetectedStructuredTermsSections({
        keyPrefix: 'our_process',
        fallbackTitle: 'Our Process & What to Expect',
        text: ourProcessText,
      }),
    },
    {
      title: 'Project Terms',
      sections: buildDetectedStructuredTermsSections({
        keyPrefix: 'project_terms',
        fallbackTitle: 'Project Terms',
        text: projectTermsText,
      }),
    },
  ]

  return pages
    .map((page) => ({
      ...page,
      sections: page.sections.filter((section) => section.paragraphs.length > 0),
    }))
    .filter((page) => page.sections.length > 0)
}

export function assembleCustomerEstimateDocument(
  document: BuiltCustomerEstimateDocument
): CustomerEstimateDocument {
  const missingCompanyFields: Array<keyof CompanyProfile> = []
  const companyName = pickCompanyValue(
    document.company.business_name,
    DOCUMENT_PLACEHOLDERS.companyName,
    'business_name',
    missingCompanyFields
  )
  const companyPhone = pickCompanyValue(
    document.company.main_phone,
    DOCUMENT_PLACEHOLDERS.companyPhone,
    'main_phone',
    missingCompanyFields
  )
  const companyEmail = pickCompanyValue(
    document.company.business_email,
    DOCUMENT_PLACEHOLDERS.companyEmail,
    'business_email',
    missingCompanyFields
  )

  const pricingTerms = buildPricingTermsSection(document)
  const missingLegalFields: string[] = []
  const insuranceStatement = DOCUMENT_PLACEHOLDERS.insuranceStatement
  missingLegalFields.push(insuranceStatement)

  const additionalTerms = buildAdditionalTermsSection(document)
  const structuredTerms = document.terms_sections
    ? normalizeQuoteTermsSections(document.terms_sections)
    : null

  const termsPages: CustomerEstimateTermsPage[] = structuredTerms
    ? buildStructuredTermsSections(structuredTerms, document.quote_validity_days)
    : document.source_meta.settings.terms_text
    ? [
        {
          title: 'Project Terms',
          sections: [
            ...(additionalTerms ? [additionalTerms] : []),
            {
              key: 'thank_you',
              title: 'Thank you',
              paragraphs: DEFAULT_THANK_YOU,
            },
          ],
        },
      ]
    : [
        {
          title: 'Our Process & What to Expect',
          sections: [
            {
              key: 'included_preparation',
              title: 'Included Preparation',
              paragraphs: DEFAULT_INCLUDED_PREPARATION.map(
                (item) => `${item.title}: ${item.text}`
              ),
            },
            {
              key: 'customer_responsibilities',
              title: 'Customer Responsibilities',
              paragraphs: DEFAULT_CUSTOMER_RESPONSIBILITIES,
            },
            {
              key: 'changes_to_scope',
              title: 'Changes to Scope',
              paragraphs: DEFAULT_SCOPE_CHANGE_TERMS,
            },
          ],
        },
        {
          title: 'Project Terms',
          sections: [
            {
              key: 'exclusions',
              title: 'Exclusions',
              paragraphs: DEFAULT_EXCLUSIONS,
            },
            pricingTerms.section,
            {
              key: 'insurance',
              title: 'Insurance',
              paragraphs: [insuranceStatement],
            },
            ...(additionalTerms ? [additionalTerms] : []),
            {
              key: 'thank_you',
              title: 'Thank you',
              paragraphs: DEFAULT_THANK_YOU,
            },
          ],
        },
      ]
  const primaryTermsPage = termsPages[0] ?? {
    title: 'Project Terms',
    sections: [] satisfies CustomerEstimateTermsSection[],
  }

  return {
    ...document,
    header: {
      company_name: companyName,
      contact_lines: nonEmptyLines([companyPhone, companyEmail]),
      logo_url: asText(document.company.logo_url),
      document_label: DEFAULT_DOCUMENT_LABEL,
      quote_date_label: document.meta.quote_date || '-',
    },
    customer_block: {
      lines: buildCustomerLines(document),
    },
    pricing_block: {
      rows: document.quote_rows,
      total: document.total,
      footer_note: DEFAULT_QUOTE_FOOTER_NOTE,
    },
    terms_page: primaryTermsPage,
    terms_pages: termsPages,
    assembly_meta: {
      missing_company_fields: missingCompanyFields,
      missing_payment_fields: structuredTerms || document.source_meta.settings.terms_text
        ? []
        : pricingTerms.missingPaymentFields,
      missing_legal_fields: structuredTerms || document.source_meta.settings.terms_text ? [] : missingLegalFields,
      used_placeholder_fallbacks:
        missingCompanyFields.length > 0 ||
        (!structuredTerms &&
          !document.source_meta.settings.terms_text &&
          (pricingTerms.missingPaymentFields.length > 0 || missingLegalFields.length > 0)),
      used_explicit_terms_text:
        document.source_meta.settings.terms_text || !!document.source_meta.settings.terms_sections,
    },
  }
}

function deriveSourceMeta(document: Record<string, unknown>): CustomerEstimateDocumentSourceMeta {
  const company = (document.company as Record<string, unknown> | null | undefined) ?? {}
  return {
    company: {
      business_name: !!asText(company.business_name),
      main_phone: !!asText(company.main_phone),
      business_email: !!asText(company.business_email),
      address: !!asText(company.address),
      website: !!asText(company.website),
      sender_signature: !!asText(company.sender_signature),
      logo_url: !!asText(company.logo_url),
    },
    settings: {
      quote_validity_days: document.quote_validity_days != null,
      terms_text: Array.isArray(document.terms) && document.terms.length > 0,
      terms_sections: !!document.terms_sections,
    },
    overrides: {
      title: !!asText((document.meta as Record<string, unknown> | null | undefined)?.title),
      intro_paragraph: !!asText(document.intro_paragraph),
      closing_paragraph: !!asText(document.closing_paragraph),
      deposit_language: !!asText(document.deposit_language),
      card_fee_note: !!asText(document.card_fee_note),
    },
  }
}

export function ensureAssembledCustomerEstimateDocument(
  document: BuiltCustomerEstimateDocument | CustomerEstimateDocument | Record<string, unknown>
): CustomerEstimateDocument {
  if (
    document &&
    typeof document === 'object' &&
    'header' in document &&
    'pricing_block' in document &&
    'terms_page' in document &&
    'assembly_meta' in document
  ) {
    return document as CustomerEstimateDocument
  }

  const company = (document.company as Record<string, unknown> | null | undefined) ?? {}
  const customer = (document.customer as Record<string, unknown> | null | undefined) ?? {}
  const meta = (document.meta as Record<string, unknown> | null | undefined) ?? {}
  const builtDocument = {
    ...(document as Record<string, unknown>),
    meta: {
      estimate_id: asText(meta.estimate_id),
      version_name: asText(meta.version_name),
      version_state: asText(meta.version_state),
      flow_version: asText(meta.flow_version),
      title: asText(meta.title),
      quote_date: asText(meta.quote_date),
      sent_at: (meta.sent_at as string | null | undefined) ?? null,
      viewed_at: (meta.viewed_at as string | null | undefined) ?? null,
      accepted_at: (meta.accepted_at as string | null | undefined) ?? null,
      declined_at: (meta.declined_at as string | null | undefined) ?? null,
      status: asText(meta.status),
      public_token: (meta.public_token as string | null | undefined) ?? null,
    },
    company: {
      business_name: asText(company.business_name),
      timezone: asText(company.timezone),
      main_phone: asText(company.main_phone),
      business_email: asText(company.business_email),
      address: asText(company.address),
      website: asText(company.website),
      sender_signature: asText(company.sender_signature),
      logo_url: asText(company.logo_url),
    },
    customer: {
      name: asText(customer.name),
      email: asText(customer.email),
      phone: asText(customer.phone),
      address: asText(customer.address),
      street: asText(customer.street),
      city: asText(customer.city),
      state: asText(customer.state),
      zip: asText(customer.zip),
    },
    intro_paragraph: asText(document.intro_paragraph),
    closing_paragraph: asText(document.closing_paragraph),
    quote_validity_days: Number(document.quote_validity_days ?? 0),
    deposit_language: asText(document.deposit_language),
    card_fee_note: asText(document.card_fee_note),
    quote_rows: (document.quote_rows as BuiltCustomerEstimateDocument['quote_rows'] | undefined) ?? [],
    scopes: (document.scopes as BuiltCustomerEstimateDocument['scopes'] | undefined) ?? [],
    total:
      typeof document.total === 'number' && Number.isFinite(document.total)
        ? document.total
        : null,
    terms: (document.terms as string[] | undefined) ?? [],
    terms_font_size:
      typeof document.terms_font_size === 'number' && Number.isFinite(document.terms_font_size)
        ? document.terms_font_size
        : null,
    terms_sections:
      ((document as Record<string, unknown>).terms_sections as BuiltCustomerEstimateDocument['terms_sections'] | undefined) ??
      null,
    source_meta:
      ((document as Record<string, unknown>).source_meta as CustomerEstimateDocumentSourceMeta | undefined) ??
      deriveSourceMeta(document as Record<string, unknown>),
  } as BuiltCustomerEstimateDocument

  return assembleCustomerEstimateDocument(builtDocument)
}
