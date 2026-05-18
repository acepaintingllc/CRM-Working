import type {
  CompanyProfile,
  CustomerEstimateDocument,
  CustomerEstimatePricingSummary,
  CustomerEstimateSectionKey,
} from '@/lib/customer-estimates/types'
import type { QuoteTermsSections } from '@/lib/customer-estimates/termsDefaults'
import type { TemplatePreset } from '@/lib/customer-estimates/presets'
import type { EstimateTemplateSettingsRow } from '@/lib/server/estimateTemplateSettings'
import type { CustomerSendReadinessResult } from '@/lib/customer-send/readiness'
export type { EstimateTemplateSettingsRow } from '@/lib/server/estimateTemplateSettings'

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

export const CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND =
  'customer_send_operational_snapshot' as const
export const CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION = 1 as const

export type CustomerQuoteIncludeFlag = 'Y' | 'N'

export type EstimatePublicVersionRow = {
  id: string | null
  estimate_id?: string | null
  customer_id?: string | null
  version_number?: number | null
  status?: string | null
  public_token?: string | null
  created_at?: string | null
  sent_at?: string | null
  viewed_at?: string | null
  accepted_at?: string | null
  declined_at?: string | null
  locked_at?: string | null
  updated_at?: string | null
  acceptance_json?: Record<string, unknown> | null
  draft_json?: Record<string, unknown> | null
  snapshot_json?: Record<string, unknown> | null
  [key: string]: unknown
}

export type EstimateCustomerSendEstimateRow = {
  id: string
  job_id: string
  customer_id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  setting_set_id_used?: string | null
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

export type EstimateJobSettingsRow = {
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
  trim_paint_gallons?: number | null
  trim_paint_quarts?: number | null
  trim_paint_qty?: number | null
  trim_paint_uom?: string | null
}

export type QuoteSendDefaults = {
  default_template_key: string
  quote_validity_days: number
  terms_font_size?: number
  terms_text: string
  terms_sections?: QuoteTermsSections
  template_presets?: TemplatePreset[]
}

export type EstimateCustomerSendSettings = {
  default_template_key?: string | null
  quote_validity_days?: number | null
  terms_font_size?: number | null
  terms_text?: string | null
  terms_sections?: QuoteTermsSections | null
  template_presets?: TemplatePreset[] | null
  updated_at?: string | null
}

export type CustomerQuoteRoomRow = {
  id?: string | null
  room_id?: string | null
  room_name?: string | null
  mode?: string | null
  position?: number | null
  length_in?: number | null
  width_in?: number | null
  [key: string]: unknown
}

export type CustomerQuoteSegmentRow = {
  id?: string | null
  wall_scope_id?: string | null
  ceiling_scope_id?: string | null
  active?: CustomerQuoteIncludeFlag | null
  position?: number | null
  [key: string]: unknown
}

export type CustomerQuotePaintScopeRow = {
  id?: string | null
  room_id?: string | null
  mode?: string | null
  active?: CustomerQuoteIncludeFlag | null
  include?: CustomerQuoteIncludeFlag | null
  paint_product_id?: string | null
  paint_product_label?: string | null
  notes?: string | null
  scope_notes?: string | null
  walls_prep_override?: string | null
  ceiling_prep_override?: string | null
  paint_coats?: number | null
  wall_coats?: number | null
  ceiling_coats?: number | null
  prime_mode?: string | null
  effective_total?: number | null
  final_total?: number | null
  raw_total?: number | null
  override_total?: number | null
  [key: string]: unknown
}

export type CustomerQuoteTrimScopeRow = {
  id?: string | null
  room_id?: string | null
  active?: CustomerQuoteIncludeFlag | null
  include?: CustomerQuoteIncludeFlag | null
  trim_type_id?: string | null
  trim_menu_id?: string | null
  scope_name?: string | null
  trim_menu_label?: string | null
  trim_family?: string | null
  paint_product_id?: string | null
  paint_product_label?: string | null
  notes?: string | null
  prep_level_override?: string | null
  override_description?: string | null
  paint_coats?: number | null
  coats?: number | null
  prime_mode?: string | null
  effective_total?: number | null
  final_total?: number | null
  raw_total?: number | null
  override_total?: number | null
  [key: string]: unknown
}

export type CustomerQuoteDoorScopeRow = {
  id?: string | null
  room_id?: string | null
  active?: CustomerQuoteIncludeFlag | null
  include?: CustomerQuoteIncludeFlag | null
  door_type_id?: string | null
  scope_name?: string | null
  paint_product_id?: string | null
  paint_product_label?: string | null
  notes?: string | null
  paint_coats?: number | null
  coats?: number | null
  prime_mode?: string | null
  effective_total?: number | null
  final_total?: number | null
  raw_total?: number | null
  override_total?: number | null
  [key: string]: unknown
}

export type CustomerQuoteDrywallScopeRow = {
  id?: string | null
  room_id?: string | null
  active?: CustomerQuoteIncludeFlag | null
  include?: CustomerQuoteIncludeFlag | null
  repair_type?: string | null
  surface?: string | null
  unit?: string | null
  notes?: string | null
  quantity?: number | null
  raw_quantity?: number | null
  effective_quantity?: number | null
  effective_total?: number | null
  final_total?: number | null
  raw_total?: number | null
  override_total?: number | null
  calculated_total?: number | null
  [key: string]: unknown
}

export type CustomerQuoteAccessFeeRow = {
  id?: string | null
  room_id?: string | null
  active?: CustomerQuoteIncludeFlag | null
  include?: CustomerQuoteIncludeFlag | null
  access_fee_id?: string | null
  label?: string | null
  display_name?: string | null
  access_group?: string | null
  unit?: string | null
  qty?: number | null
  amount?: number | null
  catalog_amount?: number | null
  actual_cost_override?: number | null
  calculated_total?: number | null
  effective_total?: number | null
  final_total?: number | null
  raw_total?: number | null
  override_total?: number | null
  overridden?: boolean | null
  [key: string]: unknown
}

export type CustomerQuotePrejobRow = {
  id?: string | null
  room_id?: string | null
  position?: number | null
  active?: CustomerQuoteIncludeFlag | null
  include?: CustomerQuoteIncludeFlag | null
  label?: string | null
  trip_name?: string | null
  trip_num?: number | null
  trip_rate?: number | null
  manual_adjustment?: number | null
  calculated_total?: number | null
  raw_total?: number | null
  effective_total?: number | null
  final_total?: number | null
  notes?: string | null
  [key: string]: unknown
}

export type CustomerQuoteOtherRow = {
  id?: string | null
  active?: CustomerQuoteIncludeFlag | null
  include?: CustomerQuoteIncludeFlag | null
  client_description?: string | null
  location?: string | null
  qty?: number | null
  uom?: string | null
  pricing_mode?: string | null
  effective_total?: number | null
  final_total?: number | null
  raw_total?: number | null
  override_total?: number | null
  [key: string]: unknown
}

export type CustomerQuoteTrimItemRow = {
  id?: string | null
  room_id?: string | null
  active?: CustomerQuoteIncludeFlag | null
  trim_menu_id?: string | null
  trim_menu_label?: string | null
  paint_product_id?: string | null
  paint_product_label?: string | null
  notes?: string | null
  prep_level_override?: string | null
  override_description?: string | null
  coats?: number | null
  prime_mode?: string | null
  effective_total?: number | null
  final_total?: number | null
  raw_total?: number | null
  override_total?: number | null
  [key: string]: unknown
}

export type CustomerQuotePaintCatalogRow = {
  id?: string | null
  display_id?: string | null
  display_name?: string | null
  label?: string | null
  name?: string | null
  [key: string]: unknown
}

export type CustomerQuoteTrimCatalogRow = {
  id?: string | null
  label?: string | null
  family?: string | null
  [key: string]: unknown
}

export type CustomerQuoteDoorCatalogRow = {
  id?: string | null
  label?: string | null
  [key: string]: unknown
}

export type CustomerQuoteRawPaintCatalogRow = {
  id?: unknown
  display_id?: unknown
  display_name?: unknown
  label?: unknown
  name?: unknown
  [key: string]: unknown
}

export type CustomerQuoteRawTrimCatalogRow = {
  id?: unknown
  label?: unknown
  family?: unknown
  [key: string]: unknown
}

export type CustomerQuoteRawDoorCatalogRow = {
  id?: unknown
  label?: unknown
  [key: string]: unknown
}

export type CustomerQuoteRawCatalogPayload = {
  paint_products?: CustomerQuoteRawPaintCatalogRow[] | null
  trim_items?: CustomerQuoteRawTrimCatalogRow[] | null
  door_types?: CustomerQuoteRawDoorCatalogRow[] | null
  paints?: CustomerQuoteRawPaintCatalogRow[] | null
}

export type CustomerQuoteCatalogs = {
  paint_products?: CustomerQuotePaintCatalogRow[]
  trim_items?: CustomerQuoteTrimCatalogRow[]
  door_types?: CustomerQuoteDoorCatalogRow[]
  paints?: CustomerQuotePaintCatalogRow[]
}

export type CustomerQuoteJobRecord = EstimateCustomerSendJobRow & {
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
}

export type EstimateCustomerSendInputs = {
  rooms: CustomerQuoteRoomRow[]
  room_wall_scopes: CustomerQuotePaintScopeRow[]
  segments: CustomerQuoteSegmentRow[]
  wall_segments: CustomerQuoteSegmentRow[]
  ceiling_segments: CustomerQuoteSegmentRow[]
  room_ceiling_scopes: CustomerQuotePaintScopeRow[]
  ceiling_scope_segments: CustomerQuoteSegmentRow[]
  room_trim_scopes: CustomerQuoteTrimScopeRow[]
  room_door_scopes: CustomerQuoteDoorScopeRow[]
  drywall_repairs?: CustomerQuoteDrywallScopeRow[]
  access_fees: CustomerQuoteAccessFeeRow[]
  prejob: CustomerQuotePrejobRow[]
  trim_items: CustomerQuoteTrimItemRow[]
  other: CustomerQuoteOtherRow[]
  jobsettings: EstimateJobSettingsRow
  org_defaults: EstimateTemplateSettingsRow
}

export type CustomerQuoteDocumentMetadata = {
  // This flattened shape is the canonical document metadata contract. Each field
  // answers a different question without duplicating version rows under a
  // second nested object:
  // - latest_public_version: which version should drive the preview document now
  // - latest_sent_version: which version currently owns the live public link
  // - latest_draft_version: which draft should save/send mutations extend
  // - public_url: the derived live link for latest_sent_version
  // - public_versions: the authoritative persisted version history
  latest_public_version: EstimatePublicVersionRow | null
  latest_sent_version: EstimatePublicVersionRow | null
  latest_draft_version: EstimatePublicVersionRow | null
  public_url: string | null
  public_versions: EstimatePublicVersionRow[]
}

export type CustomerQuoteSourceModel = {
  estimate: EstimateCustomerSendEstimateRow
  job: CustomerQuoteJobRecord
  customer: EstimateCustomerSendCustomerRow
  company: CompanyProfile
  settings: EstimateCustomerSendSettings
  inputs: EstimateCustomerSendInputs
  catalogs: CustomerQuoteCatalogs | null
  pricing_summary: CustomerEstimatePricingSummary | null
  artifact_generation_blocked_reason?: string | null
} & CustomerQuoteDocumentMetadata

export type EstimateCustomerSendContextData = CustomerQuoteSourceModel

export type EstimateCustomerSendContextResult =
  | EstimateCustomerSendContextData
  | { error: string }

export type CustomerSendOperationalPricingSummary = CustomerEstimatePricingSummary & {
  effectiveLaborHours?: number | null
  rawLaborHours?: number | null
  supplyCost?: number | null
  paintMaterialCost?: number | null
  primerMaterialCost?: number | null
}

export type CustomerSendOperationalScopeCalculation<TRow> = {
  scopes: TRow[]
}

export type CustomerSendOperationalEstimateResponse = {
  estimate: EstimateCustomerSendEstimateRow
  inputs: EstimateCustomerSendInputs
  wall_calculations: CustomerSendOperationalScopeCalculation<CustomerQuotePaintScopeRow>
  ceiling_calculations: CustomerSendOperationalScopeCalculation<CustomerQuotePaintScopeRow>
  trim_calculations: CustomerSendOperationalScopeCalculation<CustomerQuoteTrimScopeRow>
  door_calculations: CustomerSendOperationalScopeCalculation<CustomerQuoteDoorScopeRow>
  drywall_calculations: CustomerSendOperationalScopeCalculation<CustomerQuoteDrywallScopeRow>
  pricing_summary: CustomerSendOperationalPricingSummary
}

export type CustomerSendOperationalSnapshot = {
  artifact_kind: typeof CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND
  artifact_version: typeof CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION
  source_estimate_updated_at: string
  estimate_response: CustomerSendOperationalEstimateResponse
}

export type EstimateCustomerSendRawResources = {
  estimate: EstimateCustomerSendEstimateRow
} & EstimateCustomerSendCoreResources &
  EstimateCustomerSendScopeResources &
  EstimateCustomerSendVersionResources & {
    catalogs: CustomerQuoteRawCatalogPayload | null
  }

export type EstimateCustomerSendCoreResources = {
  job: EstimateCustomerSendJobRow
  customer: EstimateCustomerSendCustomerRow
  company: CompanyProfile
  quoteDefaults: QuoteSendDefaults
  settingsRow: EstimateTemplateSettingsRow
  jobsettings: EstimateJobSettingsRow
  rollupFinalTotal: number | null
}

export type EstimateCustomerSendScopeResources = {
  rooms: CustomerQuoteRoomRow[]
  wallScopes: CustomerQuotePaintScopeRow[]
  segments: CustomerQuoteSegmentRow[]
  wallSegments: CustomerQuoteSegmentRow[]
  ceilingSegments: CustomerQuoteSegmentRow[]
  ceilingScopes: CustomerQuotePaintScopeRow[]
  ceilingScopeSegments: CustomerQuoteSegmentRow[]
  trimScopes: CustomerQuoteTrimScopeRow[]
  doorScopes: CustomerQuoteDoorScopeRow[]
  drywallRepairs?: CustomerQuoteDrywallScopeRow[]
  accessFees: CustomerQuoteAccessFeeRow[]
  prejob?: CustomerQuotePrejobRow[]
  trimItems: CustomerQuoteTrimItemRow[]
  other: CustomerQuoteOtherRow[]
}

export type EstimateCustomerSendVersionResources = {
  publicVersions: EstimatePublicVersionRow[]
}

export type EstimateCustomerSendCalculatedData = {
  quoteWallScopes: CustomerQuotePaintScopeRow[]
  quoteCeilingScopes: CustomerQuotePaintScopeRow[]
  quoteTrimScopes: CustomerQuoteTrimScopeRow[]
  quoteDoorScopes: CustomerQuoteDoorScopeRow[]
  quoteDrywallScopes?: CustomerQuoteDrywallScopeRow[]
  quoteAccessFees: CustomerQuoteAccessFeeRow[]
  quotePrejobRows: CustomerQuotePrejobRow[]
  quoteOtherRows: CustomerQuoteOtherRow[]
  pricingSummary: CustomerEstimatePricingSummary | null
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
  job: EstimateCustomerSendContextData['job']
  company: CompanyProfile
  settings: EstimateCustomerSendContextData['settings'] | null
  draft: CustomerSendDraft
  version: EstimatePublicVersionRow | null
  public_url: string | null
  document: CustomerEstimateDocument
  readiness: CustomerSendReadinessResult | null
}

export type CustomerSendMutationData = {
  public_url: string | null
  version: EstimatePublicVersionRow | null
  document: Record<string, unknown> | CustomerEstimateDocument | null
  readiness: CustomerSendReadinessResult | null
}

export type CustomerSendSubmissionData = CustomerSendMutationData & {
  mode: CustomerSendMode
  delivery_error?: string | null
}
