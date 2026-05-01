import type {
  CompanyProfile,
  CustomerEstimateDocument,
  CustomerEstimateSectionKey,
  Unsafe,
} from '@/lib/customer-estimates/types'
import type { QuoteTermsSections } from '@/lib/customer-estimates/termsDefaults'
import type { TemplatePreset } from '@/lib/customer-estimates/presets'

export const CUSTOMER_SEND_SCOPE_KEYS = [
  'walls',
  'ceilings',
  'trim',
  'doors',
  'drywall',
  'cabinets',
  'other',
] as const satisfies readonly CustomerEstimateSectionKey[]

export type CustomerSendScopeKey = (typeof CUSTOMER_SEND_SCOPE_KEYS)[number]

export type EstimatePublicVersionRow = Record<string, unknown>

export type EstimateCustomerSendEstimateRow = {
  id: string
  job_id: string
  customer_id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

export type EstimateCustomerSendJobRow = {
  id: string
  title: string | null
  estimate_date: string | null
}

export type EstimateCustomerSendCustomerRow = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export type EstimateTemplateSettingsRow = {
  labor_day_policy_enabled?: boolean | null
  dayhours?: number | null
  rounding_increment_hours?: number | null
  override_labor_rate?: number | null
  job_minimum_enabled?: boolean | null
  job_minimum_amount?: number | null
  walls_paint_id?: string | null
  wall_paint_id?: string | null
  ceiling_paint_id?: string | null
  trim_paint_id?: string | null
  updated_at: string | null
}

export type EstimateJobSettingsRow = {
  labor_day_policy_enabled?: boolean | null
  dayhours?: number | null
  rounding_increment_hours?: number | null
  override_labor_rate?: number | null
  job_minimum_enabled?: boolean | null
  job_minimum_amount?: number | null
  trim_paint_id?: string | null
  trim_paint_gallons?: number | null
  trim_paint_quarts?: number | null
  trim_paint_qty?: number | null
  trim_paint_uom?: string | null
}

export type QuoteSendDefaults = {
  default_template_key: string
  quote_validity_days: number
  terms_text: string
  terms_sections?: QuoteTermsSections
  template_presets?: TemplatePreset[]
}

export type EstimateCustomerSendSettings = {
  default_template_key?: string | null
  quote_validity_days?: number | null
  terms_text?: string | null
  terms_sections?: QuoteTermsSections | null
  template_presets?: TemplatePreset[] | null
  updated_at?: string | null
}

export type EstimateCustomerSendInputs = {
  rooms: Unsafe[]
  room_wall_scopes: Unsafe[]
  segments: Unsafe[]
  wall_segments: Unsafe[]
  ceiling_segments: Unsafe[]
  room_ceiling_scopes: Unsafe[]
  ceiling_scope_segments: Unsafe[]
  room_trim_scopes: Unsafe[]
  drywall_repairs?: Unsafe[]
  trim_items: Unsafe[]
  other: Unsafe[]
  jobsettings: EstimateJobSettingsRow
  org_defaults: EstimateTemplateSettingsRow
}

export type EstimateCustomerSendContextData = {
  estimate: EstimateCustomerSendEstimateRow
  job: EstimateCustomerSendJobRow & {
    customer_name: string
    customer_email: string
    customer_phone: string
    customer_address: string
  }
  customer: EstimateCustomerSendCustomerRow
  company: CompanyProfile
  settings: EstimateCustomerSendSettings
  inputs: EstimateCustomerSendInputs
  catalogs: Unsafe | null
  pricing_summary: { finalTotal: number | null } | null
  latest_public_version: EstimatePublicVersionRow | null
  latest_sent_version: EstimatePublicVersionRow | null
  latest_draft_version: EstimatePublicVersionRow | null
  public_url: string | null
  public_versions: EstimatePublicVersionRow[]
}

export type EstimateCustomerSendContextResult =
  | EstimateCustomerSendContextData
  | { error: string }

export type EstimateCustomerSendRawResources = {
  estimate: EstimateCustomerSendEstimateRow
} & EstimateCustomerSendCoreResources &
  EstimateCustomerSendScopeResources &
  EstimateCustomerSendVersionResources & {
    catalogs: Unsafe | null
  }

export type EstimateCustomerSendCoreResources = {
  job: EstimateCustomerSendJobRow
  customer: EstimateCustomerSendCustomerRow
  company: CompanyProfile
  quoteDefaults: QuoteSendDefaults
  settingsRow: EstimateTemplateSettingsRow
  jobsettings: EstimateJobSettingsRow
}

export type EstimateCustomerSendScopeResources = {
  rooms: Unsafe[]
  wallScopes: Unsafe[]
  segments: Unsafe[]
  wallSegments: Unsafe[]
  ceilingSegments: Unsafe[]
  ceilingScopes: Unsafe[]
  ceilingScopeSegments: Unsafe[]
  trimScopes: Unsafe[]
  drywallRepairs?: Unsafe[]
  trimItems: Unsafe[]
  other: Unsafe[]
}

export type EstimateCustomerSendVersionResources = {
  publicVersions: EstimatePublicVersionRow[]
}

export type EstimateCustomerSendCalculatedData = {
  quoteWallScopes: Unsafe[]
  quoteCeilingScopes: Unsafe[]
  quoteTrimScopes: Unsafe[]
  quoteDrywallScopes?: Unsafe[]
  pricingSummary: { finalTotal: number | null } | null
}

export type CustomerSendDraft = {
  to_email: string
  cc_email: string
  bcc_email: string
  subject: string
  body: string
  template_key: string
  title: string
  intro_paragraph: string
  closing_paragraph: string
  terms_text: string
  scope_text_edits: Partial<Record<CustomerSendScopeKey, string>>
  quote_validity_days: number | null
  deposit_language: string
  card_fee_note: string
}

export type CustomerSendPublicMeta = {
  status?: string
  sent_at?: string | null
  viewed_at?: string | null
  accepted_at?: string | null
  declined_at?: string | null
  public_token?: string | null
}

export type CustomerSendMode = 'test' | 'send'

export type CustomerSendCopy = {
  sendNotice: string
  sendFailureMessage: string
  lockFailureMessage: string
}

export type CustomerSendPageData = {
  estimate: EstimateCustomerSendContextData['estimate']
  job: EstimateCustomerSendContextData['job']
  customer: Unsafe | null
  company: CompanyProfile
  settings: EstimateCustomerSendContextData['settings'] | null
  inputs: EstimateCustomerSendContextData['inputs']
  catalogs: EstimateCustomerSendContextData['catalogs']
  pricing_summary: { finalTotal: number | null } | null
  draft: CustomerSendDraft
  version: EstimatePublicVersionRow | null
  public_url: string | null
  document: CustomerEstimateDocument
  versions: EstimateCustomerSendContextData['public_versions']
}

export type CustomerSendMutationData = {
  public_url: string | null
  version: EstimatePublicVersionRow | null
  document: Record<string, unknown> | CustomerEstimateDocument | null
}

export type CustomerSendSubmissionData = CustomerSendMutationData & {
  mode: CustomerSendMode
  delivery_error?: string | null
}
