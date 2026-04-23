import {
  buildCustomerEstimateDocument,
} from '@/lib/customer-estimates/build'
import { assembleCustomerEstimateDocument } from '@/lib/customer-estimates/assemble'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import type {
  CustomerSendDraft,
  CustomerSendPublicMeta,
  EstimateCustomerSendContextData,
  EstimatePublicVersionRow,
} from './types'

export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function buildCustomerSendPublicMeta(
  version: EstimatePublicVersionRow | null | undefined,
  fallbackStatus = 'draft'
): CustomerSendPublicMeta {
  return {
    status: asText(version?.status) || fallbackStatus,
    sent_at: (version?.sent_at as string | null) ?? null,
    viewed_at: (version?.viewed_at as string | null) ?? null,
    accepted_at: (version?.accepted_at as string | null) ?? null,
    declined_at: (version?.declined_at as string | null) ?? null,
    public_token: (version?.public_token as string | null) ?? null,
  }
}

export function buildCustomerSendPublicUrl(params: {
  origin: string
  version?: EstimatePublicVersionRow | null
  fallback?: string | null
}) {
  const token = asText(params.version?.public_token)
  if (token) return `${params.origin}/quote/${token}`
  return params.fallback ?? null
}

export function resolveCustomerSendVersionState(context: EstimateCustomerSendContextData) {
  const latestDraft =
    (context.public_versions ?? []).find((row) => asText(row.status) === 'draft') ?? null
  const latestVersion = latestDraft ?? context.latest_public_version ?? null
  return {
    latestDraft,
    latestVersion,
  }
}

export function buildCustomerSendDocument(params: {
  context: EstimateCustomerSendContextData
  draft?: Partial<CustomerSendDraft>
  publicMeta?: CustomerSendPublicMeta
}): ServiceResult<CustomerEstimateDocument> {
  try {
    const document = buildCustomerDocumentFromSendContext({
      context: params.context,
      overrides: params.draft,
      publicMeta: params.publicMeta,
    })
    return okResult(document)
  } catch {
    return errorResult('server_error', 'Unable to build customer document')
  }
}

export function buildCustomerDocumentFromSendContext(params: {
  context: EstimateCustomerSendContextData
  overrides?: {
    title?: string
    intro_paragraph?: string
    closing_paragraph?: string
    quote_validity_days?: number | string | null
    deposit_language?: string
    card_fee_note?: string
  } & { scope_text_edits?: Record<string, string> }
  publicMeta?: CustomerSendPublicMeta
}) {
  const builtDocument = buildCustomerEstimateDocument({
    estimate: params.context.estimate as Record<string, unknown>,
    job: params.context.job as Record<string, unknown>,
    customer: params.context.customer as Record<string, unknown> | null | undefined,
    company: params.context.company,
    inputs: params.context.inputs,
    catalogs: params.context.catalogs as Record<string, unknown> | null,
    settings: params.context.settings as
      | {
          default_template_key?: string | null
          quote_validity_days?: number | null
          terms_text?: string | null
        }
      | undefined,
    pricingSummary: params.context.pricing_summary as { finalTotal: number | null } | null,
    overrides: params.overrides,
    publicMeta: params.publicMeta,
  })

  return assembleCustomerEstimateDocument(builtDocument)
}
