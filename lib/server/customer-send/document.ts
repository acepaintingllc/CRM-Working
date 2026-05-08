import {
  buildCustomerEstimateDocument,
  type CustomerEstimateTypedInput,
} from '@/lib/customer-estimates/build'
import { assembleCustomerEstimateDocument } from '@/lib/customer-estimates/assemble'
import {
  deriveEstimatePublicUrl,
  selectCurrentEstimatePublicVersionRows,
} from '@/lib/customer-estimates/publicSnapshot'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import type {
  CustomerQuoteSourceModel,
  CustomerSendDraft,
  CustomerSendPublicMeta,
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
    sent_at: version?.sent_at ?? null,
    viewed_at: version?.viewed_at ?? null,
    accepted_at: version?.accepted_at ?? null,
    declined_at: version?.declined_at ?? null,
    public_token: version?.public_token ?? null,
  }
}

export function buildCustomerSendPublicUrl(params: {
  origin: string
  version?: EstimatePublicVersionRow | null
  fallback?: string | null
}) {
  const publicUrl = deriveEstimatePublicUrl(params.origin, asText(params.version?.public_token))
  if (publicUrl) return publicUrl
  return params.fallback ?? null
}

export function resolveCustomerSendVersionState(context: CustomerQuoteSourceModel) {
  const { draftVersion, latestVersion } = selectCurrentEstimatePublicVersionRows(
    context.public_versions ?? []
  )
  return {
    latestDraft: draftVersion,
    latestVersion,
  }
}

export function buildCustomerSendDocument(params: {
  context: CustomerQuoteSourceModel
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
  context: CustomerQuoteSourceModel
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
  const estimateInput: CustomerEstimateTypedInput = {
    estimate: params.context.estimate,
    job: params.context.job,
    customer: params.context.customer,
    company: params.context.company,
    inputs: params.context.inputs,
    catalogs: params.context.catalogs,
    settings: params.context.settings,
    pricingSummary: params.context.pricing_summary,
    overrides: params.overrides,
    publicMeta: params.publicMeta,
  }
  const builtDocument = buildCustomerEstimateDocument(estimateInput)

  return assembleCustomerEstimateDocument(builtDocument)
}
