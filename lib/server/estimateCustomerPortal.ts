import {
  deriveEstimateCustomerSendCalculatedData,
} from '@/lib/server/customer-send/contextCalculations'
import {
  loadEstimateCustomerSendResources,
} from '@/lib/server/customer-send/contextLoader'
import {
  loadEstimateCustomerSendEstimate,
  loadEstimateCustomerSendVersionResources,
} from '@/lib/server/customer-send/contextRepository'
import { loadCompanyProfileSettings } from '@/lib/server/settings/companyProfileStore'
import {
  buildPersistedArtifactCustomerSendContext,
  mapCustomerQuoteSourceModel,
} from '@/lib/server/customer-send/contextMapper'
import {
  readCustomerSendVersionArtifactState,
} from '@/lib/server/customer-send/types'
import {
  didCustomerSendArtifactInputsChange,
  mergeCustomerSendDraftInput,
  sanitizeCustomerSendDraft,
} from '@/lib/server/customer-send/draft'
import {
  buildCustomerDocumentFromSendContext,
} from '@/lib/server/customer-send/document'
import type {
  EstimateCustomerSendContextResult,
  EstimateCustomerSendEstimateRow,
  EstimatePublicVersionRow,
} from '@/lib/server/customer-send/types'
import { selectCurrentEstimatePublicVersionRows } from '@/lib/customer-estimates/publicSnapshot'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export async function loadEstimateCustomerSendContext(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  allowPersistedArtifactPreview?: boolean
  draftSource?: Record<string, unknown> | null
  operation?: 'read' | 'save' | 'send' | 'test'
}): Promise<EstimateCustomerSendContextResult> {
  if (params.allowPersistedArtifactPreview) {
    const artifactOnlyContext = await loadPersistedArtifactOnlyCustomerSendContext(params)
    if (artifactOnlyContext && 'error' in artifactOnlyContext) return artifactOnlyContext
    if (artifactOnlyContext) return artifactOnlyContext
  }

  const resources = await loadEstimateCustomerSendResources(params)
  if ('error' in resources) return resources

  const calculated = await deriveEstimateCustomerSendCalculatedData(resources, {
    requestOrigin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
  })
  if (!calculated.ok) {
    return { error: calculated.message }
  }

  return mapCustomerQuoteSourceModel({
    origin: params.origin,
    resources,
    calculated: calculated.data,
  })
}

export { buildCustomerDocumentFromSendContext }

async function loadPersistedArtifactOnlyCustomerSendContext(params: {
  origin: string
  orgId: string
  estimateId: string
  draftSource?: Record<string, unknown> | null
  operation?: 'read' | 'save' | 'send' | 'test'
}): Promise<EstimateCustomerSendContextResult | null> {
  const estimate = await loadEstimateCustomerSendEstimate({
    orgId: params.orgId,
    estimateId: params.estimateId,
  })
  if ('error' in estimate) return estimate

  const versions = await loadEstimateCustomerSendVersionResources({
    orgId: params.orgId,
    estimateId: params.estimateId,
  })
  if ('error' in versions) return versions

  const { latestVersion } = selectCurrentEstimatePublicVersionRows(
    versions.publicVersions ?? []
  )
  const artifactState = readCustomerSendVersionArtifactState(latestVersion)
  if (artifactState.kind !== 'canonical' || !latestVersion) return null

  const companyProfile = await loadCompanyProfileSettings(params.orgId).catch(() => null)
  if (companyProfile && !asText(latestVersion.public_token)) {
    const artifactCompany = artifactState.document.company
    const companyChanged = (['business_name', 'main_phone', 'business_email'] as const).some(
      (field) => !asText(artifactCompany[field]) && !!asText(companyProfile[field])
    )

    if (companyChanged) return null
  }

  if (
    operationRequiresLiveCustomerSendContext({
      operation: params.operation ?? 'read',
      draftSource: params.draftSource,
      artifactDraftInput: artifactState.draftInput,
    })
  ) {
    return null
  }

  return buildPersistedArtifactCustomerSendContext({
    origin: params.origin,
    estimate: estimate as EstimateCustomerSendEstimateRow,
    publicVersions: versions.publicVersions as EstimatePublicVersionRow[],
    artifactState,
  })
}

function operationRequiresLiveCustomerSendContext(params: {
  operation: 'read' | 'save' | 'send' | 'test'
  draftSource?: Record<string, unknown> | null
  artifactDraftInput: Record<string, unknown>
}) {
  if (params.operation === 'read' || params.operation === 'send') return false

  const currentDraft = sanitizeCustomerSendDraft(params.artifactDraftInput)
  const nextDraft = mergeCustomerSendDraftInput({
    baseDraft: currentDraft,
    body: params.draftSource ?? {},
  })

  return didCustomerSendArtifactInputsChange({
    currentDraft,
    nextDraft,
  })
}
