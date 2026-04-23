export type Unsafe = Record<string, unknown>

export type EstimatePublicStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'superseded'

export type EstimatePublicSignatureType = 'typed' | 'drawn'

export type EstimatePublicAcceptanceRecord = {
  legal_name: string
  signature_type: EstimatePublicSignatureType
  signature_value: string
  accepted_terms: true
  accepted_at: string
  user_agent: string
  ip: string
}

export type CompanyProfile = {
  business_name: string
  timezone: string
  main_phone: string
  business_email: string
  address: string
  website: string
  sender_signature: string
  logo_url: string
}

export type CustomerEstimateSectionKey = 'walls' | 'ceilings' | 'trim' | 'doors' | 'cabinets' | 'other'

export type CustomerEstimateSection = {
  key: CustomerEstimateSectionKey
  label: string
  text: string
  price: number | null
}

export type CustomerEstimateCustomer = {
  name: string
  email: string
  phone: string
  address: string
  street: string
  city: string
  state: string
  zip: string
}

export type CustomerEstimateQuoteRow = {
  key: CustomerEstimateSectionKey
  label: string
  description: string
  price: number
}

export type CustomerEstimatePricingSummary = {
  finalTotal: number | null
}

export type CustomerEstimateDocumentSourceMeta = {
  company: {
    business_name: boolean
    main_phone: boolean
    business_email: boolean
    address: boolean
    website: boolean
    sender_signature: boolean
    logo_url: boolean
  }
  settings: {
    quote_validity_days: boolean
    terms_text: boolean
  }
  overrides: {
    title: boolean
    intro_paragraph: boolean
    closing_paragraph: boolean
    deposit_language: boolean
    card_fee_note: boolean
  }
}

type CustomerEstimateDocumentBase = {
  meta: {
    estimate_id: string
    version_name: string
    version_state: string
    flow_version: string
    title: string
    quote_date: string
    sent_at: string | null
    viewed_at: string | null
    accepted_at: string | null
    declined_at: string | null
    status: string
    public_token: string | null
  }
  company: CompanyProfile
  customer: CustomerEstimateCustomer
  intro_paragraph: string
  closing_paragraph: string
  quote_validity_days: number
  deposit_language: string
  card_fee_note: string
  quote_rows: CustomerEstimateQuoteRow[]
  scopes: CustomerEstimateSection[]
  total: number | null
  terms: string[]
  source_meta: CustomerEstimateDocumentSourceMeta
}

export type BuiltCustomerEstimateDocument = CustomerEstimateDocumentBase

export type CustomerEstimateTermsSection = {
  key: string
  title: string
  paragraphs: string[]
}

export type CustomerEstimateDocument = CustomerEstimateDocumentBase & {
  header: {
    company_name: string
    contact_lines: string[]
    logo_url: string
    document_label: string
    quote_date_label: string
  }
  customer_block: {
    lines: string[]
  }
  pricing_block: {
    rows: CustomerEstimateQuoteRow[]
    total: number | null
    footer_note: string
  }
  terms_page: {
    title: string
    sections: CustomerEstimateTermsSection[]
  }
  assembly_meta: {
    missing_company_fields: Array<keyof CompanyProfile>
    missing_payment_fields: string[]
    missing_legal_fields: string[]
    used_placeholder_fallbacks: boolean
    used_explicit_terms_text: boolean
  }
}

export type EstimatePublicSnapshot = {
  estimate_id: string
  estimate_version_id: string
  version_number: number
  status: EstimatePublicStatus
  public_token: string | null
  public_url: string | null
  draft: Record<string, unknown>
  document: CustomerEstimateDocument
  snapshot_json: Record<string, unknown>
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  declined_at: string | null
  locked_at: string | null
}
