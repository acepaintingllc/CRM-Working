import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  validateCustomerSendReadiness,
  type CustomerSendReadinessResult,
} from '@/lib/customer-send/readiness'
import {
  didCustomerSendArtifactInputsChange,
  mergeCustomerSendDraftInput,
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
import {
  saveCustomerSendDraftVersion,
  upgradeCustomerSendLegacyVersionSnapshot,
} from './repository'
import type {
  CustomerQuoteSourceModel,
  CustomerSendCopy,
  CustomerSendMutationData,
  CustomerSendPageData,
  CustomerSendSubmissionData,
  CustomerSendVersionArtifactState,
  EstimatePublicVersionRow,
} from './types'
import {
  readCustomerSendVersionArtifactState,
  readCustomerSendVersionDraftInput,
} from './types'

type ResolvedCustomerSendPreview = {
  document: CustomerSendPageData['document']
  draft: CustomerSendPageData['draft']
  readiness: CustomerSendReadinessResult
  version: EstimatePublicVersionRow | null
}

function readArtifactGenerationBlockedReason(
  context: CustomerQuoteSourceModel
): string | null {
  const reason = (context as Record<string, unknown>).artifact_generation_blocked_reason
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null
}

function buildDraftDocumentPublicMeta(context: CustomerQuoteSourceModel) {
  const { latestDraft } = resolveCustomerSendVersionState(context)
  return buildCustomerSendPublicMeta(latestDraft, 'draft')
}

function buildCustomerSendReadiness(params: {
  context: CustomerQuoteSourceModel
  document: CustomerSendPageData['document']
}) {
  return validateCustomerSendReadiness({
    estimate: params.context.estimate,
    job: params.context.job,
    customer: params.context.customer ?? null,
    company: params.context.company,
    inputs: params.context.inputs,
    catalogs: params.context.catalogs,
    settings: params.context.settings ?? undefined,
    pricingSummary: params.context.pricing_summary ?? null,
    document: params.document,
  })
}

function buildResolvedCustomerSendPageData(params: {
  origin: string
  context: CustomerQuoteSourceModel
  resolved: ResolvedCustomerSendPreview
}): ServiceResult<CustomerSendPageData> {
  return okResult({
    job: params.context.job,
    company: params.context.company,
    settings: params.context.settings ?? null,
    draft: params.resolved.draft,
    version: params.resolved.version,
    public_url: buildCustomerSendPublicUrl({
      origin: params.origin,
      version: params.resolved.version,
      fallback: params.context.public_url,
    }),
    document: params.resolved.document,
    readiness: params.resolved.readiness,
  })
}

type PersistedCustomerSendDraft = {
  document: CustomerSendMutationData['document']
  draft: CustomerSendPageData['draft']
  readiness: CustomerSendReadinessResult
  version: EstimatePublicVersionRow
}

type ResolvedCustomerSendDraftState = {
  persistedPreview: ResolvedCustomerSendPreview | null
  baseDraft: CustomerSendPageData['draft']
  latestDraft: EstimatePublicVersionRow | null
  latestVersion: EstimatePublicVersionRow | null
}

type ResolvedCustomerSendPersistedPreviewState = {
  persistedPreview: ResolvedCustomerSendPreview | null
  latestDraft: EstimatePublicVersionRow | null
  latestVersion: EstimatePublicVersionRow | null
}

function readPersistedArtifactFailure(
  artifactState: Extract<CustomerSendVersionArtifactState, { kind: 'invalid' | 'missing' | 'legacy' }>
) {
  return errorResult(
    'server_error',
    artifactState.kind === 'missing'
      ? 'Customer send preview snapshot is missing'
      : artifactState.kind === 'legacy'
        ? 'Customer send preview snapshot requires canonical upgrade'
        : artifactState.message
  )
}

function buildPersistedPreviewResponse(params: {
  context: CustomerQuoteSourceModel
  version: EstimatePublicVersionRow
  artifactState: Extract<CustomerSendVersionArtifactState, { kind: 'canonical' }>
}): ServiceResult<ResolvedCustomerSendPreview> {
  const persistedDraft = sanitizeCustomerSendDraft(params.artifactState.draftInput)

  return okResult({
    document: params.artifactState.document,
    draft: persistedDraft,
    readiness: buildCustomerSendReadiness({
      context: params.context,
      document: params.artifactState.document,
    }),
    version: params.version,
  })
}

async function resolveCustomerSendPersistedPreviewState(params: {
  orgId: string
  context: CustomerQuoteSourceModel
  versionState?: ReturnType<typeof resolveCustomerSendVersionState>
  allowLegacyUpgrade?: boolean
}): Promise<ServiceResult<ResolvedCustomerSendPersistedPreviewState>> {
  let { latestDraft, latestVersion } =
    params.versionState ?? resolveCustomerSendVersionState(params.context)
  let persistedPreview: ServiceResult<ResolvedCustomerSendPreview> | null = null

  if (latestDraft) {
    const artifactState = readCustomerSendVersionArtifactState(latestDraft)
    if (artifactState.kind === 'legacy') {
      if (params.allowLegacyUpgrade === false) {
        return errorResult(
          'invalid_input',
          'Save draft before sending. Customer-visible preview artifact requires canonical preview.'
        )
      }

      const upgradedVersion = await upgradeCustomerSendLegacyVersionSnapshot({
        orgId: params.orgId,
        version: latestDraft,
        document: artifactState.document,
        draft: sanitizeCustomerSendDraft(artifactState.draftInput),
      })
      if (!upgradedVersion.ok) return upgradedVersion

      latestDraft = upgradedVersion.data
      if (asText(latestVersion?.id) === asText(latestDraft.id)) {
        latestVersion = upgradedVersion.data
      }
    }

    const resolvedArtifactState = readCustomerSendVersionArtifactState(latestDraft)
    if (resolvedArtifactState.kind === 'canonical') {
      persistedPreview = buildPersistedPreviewResponse({
        context: params.context,
        version: latestDraft,
        artifactState: resolvedArtifactState,
      })
    } else {
      return readPersistedArtifactFailure(resolvedArtifactState)
    }
  }

  if (persistedPreview && !persistedPreview.ok) return persistedPreview

  return okResult({
    persistedPreview: persistedPreview?.ok ? persistedPreview.data : null,
    latestDraft,
    latestVersion,
  })
}

async function resolveCustomerSendDraftState(params: {
  orgId: string
  context: CustomerQuoteSourceModel
  versionState?: ReturnType<typeof resolveCustomerSendVersionState>
}): Promise<ServiceResult<ResolvedCustomerSendDraftState>> {
  const previewState = await resolveCustomerSendPersistedPreviewState(params)
  if (!previewState.ok) return previewState

  const baseDraftSource =
    previewState.data.persistedPreview
      ? previewState.data.persistedPreview.draft
      : sanitizeCustomerSendDraft(readCustomerSendVersionDraftInput(previewState.data.latestVersion))
  const normalizedBaseDraft = normalizeCustomerSendDraftScopeText({
    context: params.context,
    draft: baseDraftSource,
  })
  if (!normalizedBaseDraft.ok) return normalizedBaseDraft

  return okResult({
    persistedPreview: previewState.data.persistedPreview,
    baseDraft: normalizedBaseDraft.data,
    latestDraft: previewState.data.latestDraft,
    latestVersion: previewState.data.latestVersion,
  })
}

async function ensureCustomerSendPreviewVersion(params: {
  orgId: string
  userId: string
  estimateId: string
  context: CustomerQuoteSourceModel
}): Promise<ServiceResult<ResolvedCustomerSendPreview>> {
  const versionState = resolveCustomerSendVersionState(params.context)
  const { latestDraft } = versionState
  if (latestDraft) {
    const artifactState = readCustomerSendVersionArtifactState(latestDraft)
    if (artifactState.kind === 'canonical') {
      return buildPersistedPreviewResponse({
        context: params.context,
        version: latestDraft,
        artifactState,
      })
    }
  }

  const draftState = await resolveCustomerSendDraftState({
    orgId: params.orgId,
    context: params.context,
    versionState,
  })
  if (!draftState.ok) return draftState
  if (draftState.data.persistedPreview) {
    return okResult(draftState.data.persistedPreview)
  }
  const blockedReason = readArtifactGenerationBlockedReason(params.context)
  if (blockedReason) {
    return errorResult('server_error', blockedReason)
  }

  const document = buildCustomerSendDocument({
    context: params.context,
    draft: draftState.data.baseDraft,
    publicMeta: buildCustomerSendPublicMeta(draftState.data.latestDraft, 'draft'),
  })
  if (!document.ok) return document

  const savedVersion = await saveCustomerSendDraftVersion({
    orgId: params.orgId,
    estimateId: params.estimateId,
    customerId: asText(params.context.estimate.customer_id),
    userId: params.userId,
    draft: draftState.data.baseDraft,
    document: document.data,
    latestDraft: draftState.data.latestDraft,
    latestVersion: draftState.data.latestVersion,
  })
  if (!savedVersion.ok) return savedVersion

  const savedArtifact = readCustomerSendVersionArtifactState(savedVersion.data)
  if (savedArtifact.kind !== 'canonical') {
    return readPersistedArtifactFailure(savedArtifact)
  }

  return buildPersistedPreviewResponse({
    context: params.context,
    version: savedVersion.data,
    artifactState: savedArtifact,
  })
}

async function persistCustomerSendDraftVersion(params: {
  orgId: string
  userId: string
  estimateId: string
  context: CustomerQuoteSourceModel
  draftSource: Record<string, unknown>
}): Promise<ServiceResult<PersistedCustomerSendDraft>> {
  const previewState = await resolveCustomerSendPersistedPreviewState({
    orgId: params.orgId,
    context: params.context,
    allowLegacyUpgrade: false,
  })
  if (!previewState.ok) return previewState

  if (previewState.data.persistedPreview) {
    const persistedPreview = previewState.data.persistedPreview
    const mergedDraft = mergeCustomerSendDraftInput({
      baseDraft: persistedPreview.draft,
      body: params.draftSource,
    })

    const shouldReusePersistedDocument =
      !didCustomerSendArtifactInputsChange({
        currentDraft: persistedPreview.draft,
        nextDraft: mergedDraft,
      })

    if (shouldReusePersistedDocument) {
      const version = await saveCustomerSendDraftVersion({
        orgId: params.orgId,
        estimateId: params.estimateId,
        customerId: asText(params.context.estimate.customer_id),
        userId: params.userId,
        draft: mergedDraft,
        document: persistedPreview.document,
        latestDraft: previewState.data.latestDraft,
        latestVersion: previewState.data.latestVersion,
      })
      if (!version.ok) return version

      const persistedArtifact = readCustomerSendVersionArtifactState(version.data)
      if (persistedArtifact.kind !== 'canonical') {
        return readPersistedArtifactFailure(persistedArtifact)
      }

      const persistedDraft = sanitizeCustomerSendDraft(persistedArtifact.draftInput)

      return okResult({
        document: persistedArtifact.document,
        draft: persistedDraft,
        readiness: buildCustomerSendReadiness({
          context: params.context,
          document: persistedArtifact.document,
        }),
        version: version.data,
      })
    }
  }

  const draftState = await resolveCustomerSendDraftState({
    orgId: params.orgId,
    context: params.context,
  })
  if (!draftState.ok) return draftState
  const blockedReason = readArtifactGenerationBlockedReason(params.context)
  if (blockedReason) {
    return errorResult('server_error', blockedReason)
  }

  const normalizedDraft = normalizeCustomerSendDraftScopeText({
    context: params.context,
    draft: mergeCustomerSendDraftInput({
      baseDraft: draftState.data.baseDraft,
      body: params.draftSource,
    }),
  })
  if (!normalizedDraft.ok) return normalizedDraft

  const persistedPreview = draftState.data.persistedPreview
  const document =
    persistedPreview &&
    !didCustomerSendArtifactInputsChange({
      currentDraft: persistedPreview.draft,
      nextDraft: normalizedDraft.data,
    })
      ? okResult(persistedPreview.document)
      : buildCustomerSendDocument({
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
    document: document.data,
    latestDraft: draftState.data.latestDraft,
    latestVersion: draftState.data.latestVersion,
  })
  if (!version.ok) return version

  const persistedArtifact = readCustomerSendVersionArtifactState(version.data)
  if (persistedArtifact.kind !== 'canonical') {
    return readPersistedArtifactFailure(persistedArtifact)
  }

  const persistedDraft = sanitizeCustomerSendDraft(persistedArtifact.draftInput)

  return okResult({
    document: persistedArtifact.document,
    draft: persistedDraft,
    readiness: buildCustomerSendReadiness({
      context: params.context,
      document: persistedArtifact.document,
    }),
    version: version.data,
  })
}

function draftsMatch(left: CustomerSendPageData['draft'], right: CustomerSendPageData['draft']) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function resolveCustomerSendSendVersion(params: {
  orgId: string
  userId: string
  estimateId: string
  context: CustomerQuoteSourceModel
  draftSource: Record<string, unknown>
}): Promise<ServiceResult<PersistedCustomerSendDraft>> {
  const previewState = await resolveCustomerSendPersistedPreviewState({
    orgId: params.orgId,
    context: params.context,
  })
  if (!previewState.ok) return previewState

  const persistedPreview = previewState.data.persistedPreview
  if (!persistedPreview || !previewState.data.latestDraft) {
    return errorResult(
      'invalid_input',
      'Save draft before sending. Customer-visible preview artifact is missing.'
    )
  }

  const mergedDraft = mergeCustomerSendDraftInput({
    baseDraft: persistedPreview.draft,
    body: params.draftSource,
  })

  if (
    didCustomerSendArtifactInputsChange({
      currentDraft: persistedPreview.draft,
      nextDraft: mergedDraft,
    })
  ) {
    return errorResult(
      'invalid_input',
      'Save draft before sending. Document-impacting send fields differ from the persisted preview artifact.'
    )
  }

  if (draftsMatch(persistedPreview.draft, mergedDraft)) {
    return okResult({
      document: persistedPreview.document,
      draft: persistedPreview.draft,
      readiness: persistedPreview.readiness,
      version: previewState.data.latestDraft,
    })
  }

  const version = await saveCustomerSendDraftVersion({
    orgId: params.orgId,
    estimateId: params.estimateId,
    customerId: asText(params.context.estimate.customer_id),
    userId: params.userId,
    draft: mergedDraft,
    document: persistedPreview.document,
    latestDraft: previewState.data.latestDraft,
    latestVersion: previewState.data.latestVersion,
  })
  if (!version.ok) return version

  const persistedArtifact = readCustomerSendVersionArtifactState(version.data)
  if (persistedArtifact.kind !== 'canonical') {
    return readPersistedArtifactFailure(persistedArtifact)
  }

  const persistedDraft = sanitizeCustomerSendDraft(persistedArtifact.draftInput)

  return okResult({
    document: persistedArtifact.document,
    draft: persistedDraft,
    readiness: buildCustomerSendReadiness({
      context: params.context,
      document: persistedArtifact.document,
    }),
    version: version.data,
  })
}

export async function loadCustomerSendPageData(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  context: CustomerQuoteSourceModel
}): Promise<ServiceResult<CustomerSendPageData>> {
  const preview = await ensureCustomerSendPreviewVersion(params)
  if (!preview.ok) return preview

  return buildResolvedCustomerSendPageData({
    origin: params.origin,
    context: params.context,
    resolved: preview.data,
  })
}

export async function saveCustomerSendDraftMutation(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  body: Record<string, unknown>
  context: CustomerQuoteSourceModel
}): Promise<ServiceResult<CustomerSendMutationData>> {
  const persisted = await persistCustomerSendDraftVersion({
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
    context: params.context,
    draftSource: params.body,
  })
  if (!persisted.ok) return persisted

  return okResult({
    version: persisted.data.version,
    public_url: buildCustomerSendPublicUrl({
      origin: params.origin,
      version: persisted.data.version,
      fallback: params.context.public_url,
    }),
    document: persisted.data.document,
    readiness: persisted.data.readiness,
  })
}

export async function submitCustomerSendMutation(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  body: Record<string, unknown> | null
  context: CustomerQuoteSourceModel
  copy: CustomerSendCopy
}): Promise<ServiceResult<CustomerSendSubmissionData>> {
  const mode = normalizeCustomerSendMode(params.body?.mode)
  const persisted =
    mode === 'send'
      ? await resolveCustomerSendSendVersion({
          orgId: params.orgId,
          userId: params.userId,
          estimateId: params.estimateId,
          context: params.context,
          draftSource: params.body ?? {},
        })
      : await persistCustomerSendDraftVersion({
          orgId: params.orgId,
          userId: params.userId,
          estimateId: params.estimateId,
          context: params.context,
          draftSource: params.body ?? {},
        })
  if (!persisted.ok) return persisted

  if (!persisted.data.draft.to_email) {
    return errorResult('invalid_input', 'Customer email is required')
  }

  if (mode === 'send' && !persisted.data.readiness) {
    return errorResult('server_error', 'Customer send preview snapshot missing')
  }

  if (mode === 'send' && persisted.data.readiness && persisted.data.readiness.blockers.length > 0) {
    return errorResult(
      'invalid_input',
      persisted.data.readiness.blockers.map((issue) => issue.message).join(' ')
    )
  }

  const delivery = await submitCustomerSendMessage({
    mode,
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    draft: persisted.data.draft,
    context: params.context,
    version: persisted.data.version,
    copy: params.copy,
  })
  if (!delivery.ok) return delivery

  return okResult({
    ...delivery.data,
    readiness: persisted.data.readiness,
  })
}
