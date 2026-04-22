import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  normalizeCustomerSendDraftScopeText,
  normalizeCustomerSendMode,
  sanitizeCustomerSendDraft,
} from './draft'
import {
  buildCustomerSendDocument,
  buildCustomerSendPublicMeta,
  buildCustomerSendPublicUrl,
  resolveCustomerSendVersionState,
  asText,
} from './document'
import { submitCustomerSendMessage } from './delivery'
import { saveCustomerSendDraftVersion } from './repository'
import type {
  CustomerSendCopy,
  CustomerSendMutationData,
  CustomerSendPageData,
  CustomerSendSubmissionData,
  EstimateCustomerSendContextData,
} from './types'

function buildDraftDocumentPublicMeta(context: EstimateCustomerSendContextData) {
  const { latestDraft } = resolveCustomerSendVersionState(context)
  return buildCustomerSendPublicMeta(latestDraft, 'draft')
}

export function buildCustomerSendPageData(params: {
  origin: string
  context: EstimateCustomerSendContextData
}): ServiceResult<CustomerSendPageData> {
  const { latestVersion } = resolveCustomerSendVersionState(params.context)
  const normalizedDraft = normalizeCustomerSendDraftScopeText({
    context: params.context,
    draft: sanitizeCustomerSendDraft(
      (latestVersion?.draft_json as Record<string, unknown> | null | undefined) ?? {}
    ),
  })
  if (!normalizedDraft.ok) return normalizedDraft

  const document = buildCustomerSendDocument({
    context: params.context,
    draft: normalizedDraft.data,
    publicMeta: buildCustomerSendPublicMeta(latestVersion, 'draft'),
  })
  if (!document.ok) return document

  return okResult({
    estimate: params.context.estimate,
    job: params.context.job,
    customer:
      ((params.context as Record<string, unknown>).customer as Record<string, unknown> | null) ??
      null,
    company: params.context.company,
    settings: params.context.settings ?? null,
    inputs: params.context.inputs,
    catalogs: params.context.catalogs,
    pricing_summary:
      ((params.context as Record<string, unknown>).pricing_summary as
        | { finalTotal: number | null }
        | null
        | undefined) ?? null,
    draft: normalizedDraft.data,
    version: latestVersion,
    public_url: buildCustomerSendPublicUrl({
      origin: params.origin,
      version: latestVersion,
      fallback: params.context.public_url,
    }),
    document: document.data,
    versions: params.context.public_versions ?? [],
  })
}

export async function saveCustomerSendDraftMutation(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  body: Record<string, unknown>
  context: EstimateCustomerSendContextData
}): Promise<ServiceResult<CustomerSendMutationData>> {
  const normalizedDraft = normalizeCustomerSendDraftScopeText({
    context: params.context,
    draft: sanitizeCustomerSendDraft(params.body),
  })
  if (!normalizedDraft.ok) return normalizedDraft

  const { latestDraft, latestVersion } = resolveCustomerSendVersionState(params.context)
  const document = buildCustomerSendDocument({
    context: params.context,
    draft: normalizedDraft.data,
    publicMeta: buildDraftDocumentPublicMeta(params.context),
  })
  if (!document.ok) return document

  const version = await saveCustomerSendDraftVersion({
    orgId: params.orgId,
    estimateId: params.estimateId,
    customerId: asText(params.context.estimate.customer_id),
    userId: params.userId,
    draft: normalizedDraft.data,
    document: document.data as unknown as Record<string, unknown>,
    latestDraft,
    latestVersion,
  })
  if (!version.ok) return version

  return okResult({
    version: version.data,
    public_url: buildCustomerSendPublicUrl({
      origin: params.origin,
      version: version.data,
      fallback: params.context.public_url,
    }),
    document: (version.data.snapshot_json as Record<string, unknown> | null) ?? null,
  })
}

export async function submitCustomerSendMutation(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  body: Record<string, unknown> | null
  context: EstimateCustomerSendContextData
  copy: CustomerSendCopy
}): Promise<ServiceResult<CustomerSendSubmissionData>> {
  const mode = normalizeCustomerSendMode(params.body?.mode)
  const normalizedDraft = normalizeCustomerSendDraftScopeText({
    context: params.context,
    draft: sanitizeCustomerSendDraft(params.body),
  })
  if (!normalizedDraft.ok) return normalizedDraft
  if (!normalizedDraft.data.to_email) {
    return errorResult('invalid_input', 'Customer email is required')
  }

  const { latestDraft, latestVersion } = resolveCustomerSendVersionState(params.context)
  const document = buildCustomerSendDocument({
    context: params.context,
    draft: normalizedDraft.data,
    publicMeta: buildDraftDocumentPublicMeta(params.context),
  })
  if (!document.ok) return document

  const version = await saveCustomerSendDraftVersion({
    orgId: params.orgId,
    estimateId: params.estimateId,
    customerId: asText(params.context.estimate.customer_id),
    userId: params.userId,
    draft: normalizedDraft.data,
    document: document.data as unknown as Record<string, unknown>,
    latestDraft,
    latestVersion,
  })
  if (!version.ok) return version

  return submitCustomerSendMessage({
    mode,
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    draft: normalizedDraft.data,
    context: params.context,
    version: version.data,
    copy: params.copy,
  })
}
