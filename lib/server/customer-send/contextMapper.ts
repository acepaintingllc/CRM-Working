import type {
  EstimateCustomerSendCalculatedData,
  EstimateCustomerSendContextData,
  EstimateCustomerSendRawResources,
  EstimatePublicVersionRow,
} from './contextTypes'

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

export function selectEstimateCustomerSendVersions(
  publicVersions: EstimatePublicVersionRow[]
): {
  latestDraftVersion: EstimatePublicVersionRow | null
  latestSentVersion: EstimatePublicVersionRow | null
  previewVersion: EstimatePublicVersionRow | null
} {
  const latestDraftVersion =
    publicVersions.find((row) => asText(row.status) === 'draft') ?? null
  const latestSentVersion =
    publicVersions.find(
      (row) =>
        asText(row.status) !== 'draft' && asText(row.public_token) !== ''
    ) ?? null
  const previewVersion = latestDraftVersion ?? latestSentVersion ?? publicVersions[0] ?? null

  return {
    latestDraftVersion,
    latestSentVersion,
    previewVersion,
  }
}

export function buildEstimateCustomerSendContext(params: {
  origin: string
  resources: EstimateCustomerSendRawResources
  calculated: EstimateCustomerSendCalculatedData
}): EstimateCustomerSendContextData {
  const { latestDraftVersion, latestSentVersion, previewVersion } =
    selectEstimateCustomerSendVersions(params.resources.publicVersions)
  const publicUrl = latestSentVersion?.public_token
    ? `${params.origin}/quote/${latestSentVersion.public_token}`
    : null

  return {
    estimate: params.resources.estimate,
    job: {
      ...params.resources.job,
      customer_name: params.resources.customer.name ?? '',
      customer_email: params.resources.customer.email ?? '',
      customer_phone: params.resources.customer.phone ?? '',
      customer_address: params.resources.customer.address ?? '',
    },
    customer: params.resources.customer,
    company: params.resources.company,
    settings: {
      default_template_key: params.resources.quoteDefaults.default_template_key,
      quote_validity_days: params.resources.quoteDefaults.quote_validity_days,
      terms_text: params.resources.quoteDefaults.terms_text,
      updated_at: null,
    },
    inputs: {
      rooms: params.resources.rooms,
      room_wall_scopes: params.calculated.quoteWallScopes,
      segments: params.resources.segments,
      wall_segments: params.resources.wallSegments,
      ceiling_segments: params.resources.ceilingSegments,
      room_ceiling_scopes: params.calculated.quoteCeilingScopes,
      ceiling_scope_segments: params.resources.ceilingScopeSegments,
      room_trim_scopes: params.calculated.quoteTrimScopes,
      trim_items: params.resources.trimItems,
      other: params.resources.other,
      jobsettings: params.resources.jobsettings,
    },
    catalogs: params.resources.catalogs,
    pricing_summary: params.calculated.pricingSummary,
    latest_public_version: previewVersion,
    latest_sent_version: latestSentVersion,
    latest_draft_version: latestDraftVersion,
    public_url: publicUrl,
    public_versions: params.resources.publicVersions,
  }
}
