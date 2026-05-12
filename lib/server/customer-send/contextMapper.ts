import type {
  CustomerQuoteAccessFeeRow,
  CustomerQuoteCatalogs,
  CustomerQuoteDocumentMetadata,
  CustomerQuoteDoorCatalogRow,
  CustomerQuoteRawDoorCatalogRow,
  CustomerQuoteRawCatalogPayload,
  CustomerQuoteDoorScopeRow,
  CustomerQuoteDrywallScopeRow,
  CustomerQuoteOtherRow,
  CustomerQuotePaintCatalogRow,
  CustomerQuotePrejobRow,
  CustomerQuoteRawPaintCatalogRow,
  CustomerQuotePaintScopeRow,
  CustomerQuoteRoomRow,
  CustomerQuoteSegmentRow,
  CustomerQuoteSourceModel,
  CustomerQuoteTrimCatalogRow,
  CustomerQuoteRawTrimCatalogRow,
  CustomerQuoteTrimItemRow,
  CustomerQuoteTrimScopeRow,
  EstimateCustomerSendCalculatedData,
  EstimateCustomerSendContextData,
  EstimateCustomerSendRawResources,
  EstimatePublicVersionRow,
} from './contextTypes'
import type { CustomerSendVersionArtifactState } from './types'
import {
  deriveEstimatePublicUrl,
  selectCurrentEstimatePublicVersionRows,
} from '@/lib/customer-estimates/publicSnapshot'

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function asNullableText(value: unknown): string | null {
  const text = asText(value)
  return text === '' ? null : text
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function optionalNumberField(key: string, value: unknown) {
  const numeric = asNullableNumber(value)
  return numeric == null ? {} : { [key]: numeric }
}

function asNullableBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value == null || value === '') return null
  if (typeof value === 'number') return value !== 0
  const normalized = asText(value).toLowerCase()
  if (normalized === 'true' || normalized === 'y' || normalized === 'yes' || normalized === '1') {
    return true
  }
  if (normalized === 'false' || normalized === 'n' || normalized === 'no' || normalized === '0') {
    return false
  }
  return null
}

function asIncludeFlag(value: unknown): 'Y' | 'N' | null {
  if (value == null || value === '') return null
  return asText(value).toUpperCase() === 'N' ? 'N' : 'Y'
}

function normalizePublicVersionRow(row: EstimatePublicVersionRow): EstimatePublicVersionRow {
  return {
    id: asNullableText(row.id),
    estimate_id: asNullableText(row.estimate_id),
    customer_id: asNullableText(row.customer_id),
    version_number: asNullableNumber(row.version_number),
    status: asNullableText(row.status),
    public_token: asNullableText(row.public_token),
    created_at: asNullableText(row.created_at),
    sent_at: asNullableText(row.sent_at),
    viewed_at: asNullableText(row.viewed_at),
    accepted_at: asNullableText(row.accepted_at),
    declined_at: asNullableText(row.declined_at),
    locked_at: asNullableText(row.locked_at),
    acceptance_json:
      row.acceptance_json && typeof row.acceptance_json === 'object'
        ? row.acceptance_json
        : null,
    draft_json:
      row.draft_json && typeof row.draft_json === 'object'
        ? row.draft_json
        : null,
    snapshot_json:
      row.snapshot_json && typeof row.snapshot_json === 'object'
        ? row.snapshot_json
        : null,
  }
}

function normalizeRoomRow(row: CustomerQuoteRoomRow): CustomerQuoteRoomRow {
  return {
    id: asNullableText(row.id),
    room_id: asNullableText(row.room_id),
    room_name: asNullableText(row.room_name),
    mode: asNullableText(row.mode),
    position: asNullableNumber(row.position),
  }
}

function normalizeSegmentRow(row: CustomerQuoteSegmentRow): CustomerQuoteSegmentRow {
  return {
    id: asNullableText(row.id),
    wall_scope_id: asNullableText(row.wall_scope_id),
    ceiling_scope_id: asNullableText(row.ceiling_scope_id),
    active: asIncludeFlag(row.active),
    position: asNullableNumber(row.position),
  }
}

export function normalizePaintScopeRow(row: CustomerQuotePaintScopeRow): CustomerQuotePaintScopeRow {
  return {
    id: asNullableText(row.id),
    room_id: asNullableText(row.room_id),
    mode: asNullableText(row.mode),
    active: asIncludeFlag(row.active),
    include: asIncludeFlag(row.include),
    paint_product_id: asNullableText(row.paint_product_id),
    paint_product_label: asNullableText(row.paint_product_label),
    notes: asNullableText(row.notes),
    scope_notes: asNullableText(row.scope_notes),
    walls_prep_override: asNullableText(row.walls_prep_override),
    ceiling_prep_override: asNullableText(row.ceiling_prep_override),
    paint_coats: asNullableNumber(row.paint_coats),
    wall_coats: asNullableNumber(row.wall_coats),
    ceiling_coats: asNullableNumber(row.ceiling_coats),
    prime_mode: asNullableText(row.prime_mode),
    ...optionalNumberField('effective_paint_hours', row.effective_paint_hours),
    ...optionalNumberField('effective_primer_hours', row.effective_primer_hours),
    ...optionalNumberField('effective_paint_gallons', row.effective_paint_gallons),
    ...optionalNumberField('effective_primer_gallons', row.effective_primer_gallons),
    ...optionalNumberField('effective_supply_cost', row.effective_supply_cost),
    ...optionalNumberField('allocated_paint_material_cost', row.allocated_paint_material_cost),
    ...optionalNumberField('raw_paint_material_cost', row.raw_paint_material_cost),
    ...optionalNumberField('primer_price_per_gal', row.primer_price_per_gal),
    effective_total: asNullableNumber(row.effective_total),
    final_total: asNullableNumber(row.final_total),
    raw_total: asNullableNumber(row.raw_total),
    override_total: asNullableNumber(row.override_total),
  }
}

export function normalizeTrimScopeRow(row: CustomerQuoteTrimScopeRow): CustomerQuoteTrimScopeRow {
  return {
    id: asNullableText(row.id),
    room_id: asNullableText(row.room_id),
    active: asIncludeFlag(row.active),
    include: asIncludeFlag(row.include),
    trim_type_id: asNullableText(row.trim_type_id),
    trim_menu_id: asNullableText(row.trim_menu_id),
    scope_name: asNullableText(row.scope_name),
    trim_menu_label: asNullableText(row.trim_menu_label),
    trim_family: asNullableText(row.trim_family),
    paint_product_id: asNullableText(row.paint_product_id),
    paint_product_label: asNullableText(row.paint_product_label),
    notes: asNullableText(row.notes),
    prep_level_override: asNullableText(row.prep_level_override),
    override_description: asNullableText(row.override_description),
    paint_coats: asNullableNumber(row.paint_coats),
    coats: asNullableNumber(row.coats),
    prime_mode: asNullableText(row.prime_mode),
    ...optionalNumberField('effective_paint_hours', row.effective_paint_hours),
    ...optionalNumberField('effective_primer_hours', row.effective_primer_hours),
    ...optionalNumberField('effective_paint_gallons', row.effective_paint_gallons),
    ...optionalNumberField('effective_primer_gallons', row.effective_primer_gallons),
    ...optionalNumberField('effective_supply_cost', row.effective_supply_cost),
    ...optionalNumberField('allocated_paint_material_cost', row.allocated_paint_material_cost),
    ...optionalNumberField('raw_paint_material_cost', row.raw_paint_material_cost),
    ...optionalNumberField('primer_price_per_gal', row.primer_price_per_gal),
    effective_total: asNullableNumber(row.effective_total),
    final_total: asNullableNumber(row.final_total),
    raw_total: asNullableNumber(row.raw_total),
    override_total: asNullableNumber(row.override_total),
  }
}

export function normalizeDoorScopeRow(row: CustomerQuoteDoorScopeRow): CustomerQuoteDoorScopeRow {
  return {
    id: asNullableText(row.id),
    room_id: asNullableText(row.room_id),
    active: asIncludeFlag(row.active),
    include: asIncludeFlag(row.include),
    door_type_id: asNullableText(row.door_type_id),
    scope_name: asNullableText(row.scope_name),
    paint_product_id: asNullableText(row.paint_product_id),
    paint_product_label: asNullableText(row.paint_product_label),
    notes: asNullableText(row.notes),
    paint_coats: asNullableNumber(row.paint_coats),
    coats: asNullableNumber(row.coats),
    prime_mode: asNullableText(row.prime_mode),
    ...optionalNumberField('effective_paint_hours', row.effective_paint_hours),
    ...optionalNumberField('effective_primer_hours', row.effective_primer_hours),
    ...optionalNumberField('effective_paint_gallons', row.effective_paint_gallons),
    ...optionalNumberField('effective_primer_gallons', row.effective_primer_gallons),
    ...optionalNumberField('effective_supply_cost', row.effective_supply_cost),
    ...optionalNumberField('allocated_paint_material_cost', row.allocated_paint_material_cost),
    ...optionalNumberField('raw_paint_material_cost', row.raw_paint_material_cost),
    ...optionalNumberField('primer_price_per_gal', row.primer_price_per_gal),
    effective_total: asNullableNumber(row.effective_total),
    final_total: asNullableNumber(row.final_total),
    raw_total: asNullableNumber(row.raw_total),
    override_total: asNullableNumber(row.override_total),
  }
}

export function normalizeDrywallScopeRow(row: CustomerQuoteDrywallScopeRow): CustomerQuoteDrywallScopeRow {
  return {
    id: asNullableText(row.id),
    room_id: asNullableText(row.room_id),
    active: asIncludeFlag(row.active),
    include: asIncludeFlag(row.include),
    repair_type: asNullableText(row.repair_type),
    surface: asNullableText(row.surface),
    unit: asNullableText(row.unit),
    notes: asNullableText(row.notes),
    quantity: asNullableNumber(row.quantity),
    raw_quantity: asNullableNumber(row.raw_quantity),
    effective_quantity: asNullableNumber(row.effective_quantity),
    effective_total: asNullableNumber(row.effective_total),
    final_total: asNullableNumber(row.final_total),
    raw_total: asNullableNumber(row.raw_total),
    override_total: asNullableNumber(row.override_total),
    calculated_total: asNullableNumber(row.calculated_total),
  }
}

function normalizeAccessFeeRow(row: CustomerQuoteAccessFeeRow): CustomerQuoteAccessFeeRow {
  return {
    id: asNullableText(row.id),
    room_id: asNullableText(row.room_id),
    active: asIncludeFlag(row.active),
    include: asIncludeFlag(row.include),
    access_fee_id: asNullableText(row.access_fee_id),
    label: asNullableText(row.label),
    display_name: asNullableText(row.display_name),
    access_group: asNullableText(row.access_group),
    unit: asNullableText(row.unit),
    qty: asNullableNumber(row.qty),
    amount: asNullableNumber(row.amount),
    catalog_amount: asNullableNumber(row.catalog_amount),
    actual_cost_override: asNullableNumber(row.actual_cost_override),
    calculated_total: asNullableNumber(row.calculated_total),
    effective_total: asNullableNumber(row.effective_total),
    final_total: asNullableNumber(row.final_total),
    raw_total: asNullableNumber(row.raw_total),
    override_total: asNullableNumber(row.override_total),
    overridden: asNullableBoolean(row.overridden),
  }
}

export function normalizePrejobRow(row: CustomerQuotePrejobRow): CustomerQuotePrejobRow {
  const effectiveTotal = asNullableNumber(row.effective_total)
  const label = asNullableText(row.label)
  const tripName = asNullableText(row.trip_name) ?? label
  return {
    id: asNullableText(row.id),
    room_id: asNullableText(row.room_id),
    position: asNullableNumber(row.position),
    active: asIncludeFlag(row.active),
    include: asIncludeFlag(row.include),
    label,
    trip_name: tripName,
    trip_num: asNullableNumber(row.trip_num),
    trip_rate: asNullableNumber(row.trip_rate),
    manual_adjustment: asNullableNumber(row.manual_adjustment),
    calculated_total: asNullableNumber(row.calculated_total),
    raw_total: asNullableNumber(row.raw_total),
    effective_total: effectiveTotal,
    final_total: asNullableNumber(row.final_total) ?? effectiveTotal,
    notes: asNullableText(row.notes),
  }
}

function normalizeOtherRow(row: CustomerQuoteOtherRow): CustomerQuoteOtherRow {
  return {
    id: asNullableText(row.id),
    active: asIncludeFlag(row.active),
    include: asIncludeFlag(row.include),
    client_description: asNullableText(row.client_description),
    location: asNullableText(row.location),
    qty: asNullableNumber(row.qty),
    uom: asNullableText(row.uom),
    pricing_mode: asNullableText(row.pricing_mode),
    effective_total: asNullableNumber(row.effective_total),
    final_total: asNullableNumber(row.final_total),
    raw_total: asNullableNumber(row.raw_total),
    override_total: asNullableNumber(row.override_total),
  }
}

function normalizeTrimItemRow(row: CustomerQuoteTrimItemRow): CustomerQuoteTrimItemRow {
  return {
    id: asNullableText(row.id),
    room_id: asNullableText(row.room_id),
    active: asIncludeFlag(row.active),
    trim_menu_id: asNullableText(row.trim_menu_id),
    trim_menu_label: asNullableText(row.trim_menu_label),
    paint_product_id: asNullableText(row.paint_product_id),
    paint_product_label: asNullableText(row.paint_product_label),
    notes: asNullableText(row.notes),
    prep_level_override: asNullableText(row.prep_level_override),
    override_description: asNullableText(row.override_description),
    coats: asNullableNumber(row.coats),
    prime_mode: asNullableText(row.prime_mode),
    effective_total: asNullableNumber(row.effective_total),
    final_total: asNullableNumber(row.final_total),
    raw_total: asNullableNumber(row.raw_total),
    override_total: asNullableNumber(row.override_total),
  }
}

function normalizePaintCatalogRow(row: CustomerQuoteRawPaintCatalogRow): CustomerQuotePaintCatalogRow {
  return {
    id: asNullableText(row.id),
    display_id: asNullableText(row.display_id),
    display_name: asNullableText(row.display_name),
    label: asNullableText(row.label),
    name: asNullableText(row.name),
  }
}

function normalizeTrimCatalogRow(row: CustomerQuoteRawTrimCatalogRow): CustomerQuoteTrimCatalogRow {
  return {
    id: asNullableText(row.id),
    label: asNullableText(row.label),
    family: asNullableText(row.family),
  }
}

function normalizeDoorCatalogRow(row: CustomerQuoteRawDoorCatalogRow): CustomerQuoteDoorCatalogRow {
  return {
    id: asNullableText(row.id),
    label: asNullableText(row.label),
  }
}

function normalizeCatalogs(
  catalogs: CustomerQuoteRawCatalogPayload | null
): CustomerQuoteCatalogs | null {
  if (!catalogs) return null
  const paintProducts = catalogs.paint_products ?? catalogs.paints ?? []
  const trimItems = catalogs.trim_items ?? []
  const doorTypes = catalogs.door_types ?? []

  return {
    paint_products: paintProducts.map(normalizePaintCatalogRow),
    trim_items: trimItems.map(normalizeTrimCatalogRow),
    door_types: doorTypes.map(normalizeDoorCatalogRow),
  }
}

function buildArtifactFallbackTemplateSettings(quoteValidityDays: number) {
  return {
    default_template_key: 'default',
    quote_validity_days: quoteValidityDays,
    terms_text: '',
    walls_paint_id: null,
    walls_primer_id: null,
    ceiling_paint_id: null,
    ceiling_primer_id: null,
    trim_paint_id: null,
    trim_primer_id: null,
    labor_day_policy_enabled: true,
    dayhours: 8,
    rounding_increment_hours: 4,
    override_labor_rate: 0,
    job_minimum_enabled: false,
    job_minimum_amount: 0,
    standard_door_deduction_sf: 21,
    standard_window_deduction_sf: 15,
    baseboard_opening_deduction_lf: 3,
  }
}

export function selectEstimateCustomerSendVersions(
  publicVersions: EstimatePublicVersionRow[]
): {
  latestDraftVersion: EstimatePublicVersionRow | null
  latestSentVersion: EstimatePublicVersionRow | null
  previewVersion: EstimatePublicVersionRow | null
} {
  const { draftVersion, sentVersion, latestVersion } =
    selectCurrentEstimatePublicVersionRows(publicVersions)

  return {
    latestDraftVersion: draftVersion,
    latestSentVersion: sentVersion,
    previewVersion: latestVersion,
  }
}

function buildCustomerQuoteDocumentMetadata(params: {
  origin: string
  publicVersions: EstimatePublicVersionRow[]
}): CustomerQuoteDocumentMetadata {
  const { latestDraftVersion, latestSentVersion, previewVersion } =
    selectEstimateCustomerSendVersions(params.publicVersions)
  const publicUrl = deriveEstimatePublicUrl(
    params.origin,
    asText(latestSentVersion?.public_token)
  )

  return {
    latest_public_version: previewVersion,
    latest_sent_version: latestSentVersion,
    latest_draft_version: latestDraftVersion,
    public_url: publicUrl,
    public_versions: params.publicVersions,
  }
}

export function mapCustomerQuoteSourceModel(params: {
  origin: string
  resources: EstimateCustomerSendRawResources
  calculated: EstimateCustomerSendCalculatedData
}): CustomerQuoteSourceModel {
  const publicVersions = params.resources.publicVersions.map(normalizePublicVersionRow)
  const documentMetadata = buildCustomerQuoteDocumentMetadata({
    origin: params.origin,
    publicVersions,
  })

  return {
    estimate: params.resources.estimate,
    job: {
      ...params.resources.job,
      customer_name: asNullableText(params.resources.customer.name) ?? '',
      customer_email: asNullableText(params.resources.customer.email) ?? '',
      customer_phone: asNullableText(params.resources.customer.phone) ?? '',
      customer_address: asNullableText(params.resources.customer.address) ?? '',
    },
    customer: {
      ...params.resources.customer,
      name: asNullableText(params.resources.customer.name) ?? '',
      email: asNullableText(params.resources.customer.email) ?? '',
      phone: asNullableText(params.resources.customer.phone) ?? '',
      address: asNullableText(params.resources.customer.address) ?? '',
      street: asNullableText(params.resources.customer.street),
      city: asNullableText(params.resources.customer.city),
      state: asNullableText(params.resources.customer.state),
      zip: asNullableText(params.resources.customer.zip),
    },
    company: params.resources.company,
    settings: {
      default_template_key: params.resources.quoteDefaults.default_template_key,
      quote_validity_days: params.resources.quoteDefaults.quote_validity_days,
      terms_text: params.resources.quoteDefaults.terms_text,
      terms_sections: params.resources.quoteDefaults.terms_sections,
      template_presets: params.resources.quoteDefaults.template_presets,
      updated_at: null,
    },
    inputs: {
      rooms: params.resources.rooms.map(normalizeRoomRow),
      room_wall_scopes: params.calculated.quoteWallScopes.map(normalizePaintScopeRow),
      segments: params.resources.segments.map(normalizeSegmentRow),
      wall_segments: params.resources.wallSegments.map(normalizeSegmentRow),
      ceiling_segments: params.resources.ceilingSegments.map(normalizeSegmentRow),
      room_ceiling_scopes: params.calculated.quoteCeilingScopes.map(normalizePaintScopeRow),
      ceiling_scope_segments: params.resources.ceilingScopeSegments.map(normalizeSegmentRow),
      room_trim_scopes: params.calculated.quoteTrimScopes.map(normalizeTrimScopeRow),
      room_door_scopes: params.calculated.quoteDoorScopes.map(normalizeDoorScopeRow),
      drywall_repairs: (params.calculated.quoteDrywallScopes ?? []).map(normalizeDrywallScopeRow),
      access_fees: params.calculated.quoteAccessFees.map(normalizeAccessFeeRow),
      prejob: params.calculated.quotePrejobRows.map(normalizePrejobRow),
      trim_items: params.resources.trimItems.map(normalizeTrimItemRow),
      other: params.calculated.quoteOtherRows.map(normalizeOtherRow),
      jobsettings: params.resources.jobsettings,
      org_defaults: params.resources.settingsRow,
    },
    catalogs: normalizeCatalogs(params.resources.catalogs),
    pricing_summary:
      params.calculated.pricingSummary ??
      (params.resources.rollupFinalTotal == null
        ? null
        : { finalTotal: params.resources.rollupFinalTotal }),
    ...documentMetadata,
  }
}

export function buildPersistedArtifactCustomerSendContext(params: {
  origin: string
  estimate: EstimateCustomerSendRawResources['estimate']
  publicVersions: EstimatePublicVersionRow[]
  artifactState: Extract<CustomerSendVersionArtifactState, { kind: 'canonical' }>
  artifactGenerationBlockedReason?: string | null
}): CustomerQuoteSourceModel {
  const publicVersions = params.publicVersions.map(normalizePublicVersionRow)
  const documentMetadata = buildCustomerQuoteDocumentMetadata({
    origin: params.origin,
    publicVersions,
  })
  const document = params.artifactState.document
  const documentCustomer = document.customer
  const documentCompany = document.company

  return {
    estimate: params.estimate,
    job: {
      id: asNullableText(params.estimate.job_id) ?? '',
      title: asNullableText(document.meta.title) ?? asNullableText(params.estimate.version_name),
      estimate_date: asNullableText(document.meta.quote_date),
      customer_name: asNullableText(documentCustomer.name) ?? '',
      customer_email: asNullableText(documentCustomer.email) ?? '',
      customer_phone: asNullableText(documentCustomer.phone) ?? '',
      customer_address: asNullableText(documentCustomer.address) ?? '',
    },
    customer: {
      id: asNullableText(params.estimate.customer_id) ?? '',
      name: asNullableText(documentCustomer.name) ?? '',
      email: asNullableText(documentCustomer.email) ?? '',
      phone: asNullableText(documentCustomer.phone) ?? '',
      address: asNullableText(documentCustomer.address) ?? '',
      street: asNullableText(documentCustomer.street),
      city: asNullableText(documentCustomer.city),
      state: asNullableText(documentCustomer.state),
      zip: asNullableText(documentCustomer.zip),
    },
    company: {
      business_name: asNullableText(documentCompany.business_name) ?? '',
      timezone: asNullableText(documentCompany.timezone) ?? 'America/Chicago',
      main_phone: asNullableText(documentCompany.main_phone) ?? '',
      business_email: asNullableText(documentCompany.business_email) ?? '',
      address: asNullableText(documentCompany.address) ?? '',
      website: asNullableText(documentCompany.website) ?? '',
      sender_signature: asNullableText(documentCompany.sender_signature) ?? '',
      logo_url: asNullableText(documentCompany.logo_url) ?? '',
    },
    settings: {
      default_template_key: null,
      quote_validity_days: document.quote_validity_days,
      terms_text: null,
      terms_sections: null,
      template_presets: null,
      updated_at: null,
    },
    inputs: {
      rooms: [],
      room_wall_scopes: [],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [],
      ceiling_scope_segments: [],
      room_trim_scopes: [],
      room_door_scopes: [],
      drywall_repairs: [],
      access_fees: [],
      prejob: [],
      trim_items: [],
      other: [],
      jobsettings: {},
      org_defaults: buildArtifactFallbackTemplateSettings(document.quote_validity_days),
    },
    catalogs: null,
    pricing_summary: { finalTotal: document.total },
    artifact_generation_blocked_reason:
      params.artifactGenerationBlockedReason ?? null,
    ...documentMetadata,
  }
}

export function buildEstimateCustomerSendContext(params: {
  origin: string
  resources: EstimateCustomerSendRawResources
  calculated: EstimateCustomerSendCalculatedData
}): EstimateCustomerSendContextData {
  return mapCustomerQuoteSourceModel(params)
}
