export type Unsafe = Record<string, unknown>

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

export type CustomerEstimateDocument = {
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
}

export type EstimatePublicSnapshot = {
  estimate_id: string
  estimate_version_id: string
  version_number: number
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'superseded'
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
