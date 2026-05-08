import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  validateCustomerSendReadiness,
  type CustomerSendReadinessResult,
} from '@/lib/customer-send/readiness'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
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
  CustomerSendDraft,
  CustomerSendScopeKey,
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

const CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND = 'customer_send_operational_snapshot'
const CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION = 1

function readOperationalSnapshotEstimateUpdatedAt(snapshot: Record<string, unknown> | null | undefined) {
  const operational = snapshot?.operational_snapshot
  if (!operational || typeof operational !== 'object' || Array.isArray(operational)) return ''
  return asText((operational as Record<string, unknown>).source_estimate_updated_at)
}

function readOperationalSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  const operational = snapshot?.operational_snapshot
  return operational && typeof operational === 'object' && !Array.isArray(operational)
    ? (operational as Record<string, unknown>)
    : undefined
}

function asNumber(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    : []
}

function sumRows(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((sum, row) => sum + asNumber(row[key]), 0)
}

function paintMaterialCost(rows: Record<string, unknown>[]) {
  return rows.reduce(
    (sum, row) =>
      sum +
      asNumber(row.allocated_paint_material_cost ?? row.raw_paint_material_cost) +
      asNumber(row.effective_primer_gallons) * asNumber(row.primer_price_per_gal),
    0
  )
}

function countOperationalSnapshotRooms(snapshot: Record<string, unknown>) {
  const response = snapshot.estimate_response
  if (!response || typeof response !== 'object' || Array.isArray(response)) return 0
  const inputs = (response as Record<string, unknown>).inputs
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) return 0
  return rowsOf((inputs as Record<string, unknown>).rooms).length
}

function countOperationalSnapshotScopes(snapshot: Record<string, unknown>) {
  const response = snapshot.estimate_response
  if (!response || typeof response !== 'object' || Array.isArray(response)) return 0
  const estimateResponse = response as Record<string, unknown>
  return (
    rowsOf((estimateResponse.wall_calculations as Record<string, unknown> | undefined)?.scopes).length +
    rowsOf((estimateResponse.ceiling_calculations as Record<string, unknown> | undefined)?.scopes).length +
    rowsOf((estimateResponse.trim_calculations as Record<string, unknown> | undefined)?.scopes).length +
    rowsOf((estimateResponse.door_calculations as Record<string, unknown> | undefined)?.scopes).length +
    rowsOf((estimateResponse.drywall_calculations as Record<string, unknown> | undefined)?.scopes).length
  )
}

function readOperationalSnapshotPricing(snapshot: Record<string, unknown>) {
  const response = snapshot.estimate_response
  if (!response || typeof response !== 'object' || Array.isArray(response)) return {}
  const pricing = (response as Record<string, unknown>).pricing_summary
  return pricing && typeof pricing === 'object' && !Array.isArray(pricing)
    ? (pricing as Record<string, unknown>)
    : {}
}

function countContextPersistedOperationalRows(context: CustomerQuoteSourceModel) {
  const inputs = context.inputs
  return (
    rowsOf(inputs.rooms).length +
    rowsOf(inputs.room_wall_scopes).length +
    rowsOf(inputs.room_ceiling_scopes).length +
    rowsOf(inputs.room_trim_scopes).length +
    rowsOf(inputs.room_door_scopes).length +
    rowsOf(inputs.drywall_repairs).length +
    rowsOf(inputs.other).length +
    rowsOf(inputs.access_fees).length
  )
}

function validateCustomerSendOperationalSnapshot(params: {
  context: CustomerQuoteSourceModel
  document: CustomerEstimateDocument
  operationalSnapshot: Record<string, unknown>
}): ServiceResult<Record<string, unknown>> {
  const total = asNumber(params.document.total ?? params.context.pricing_summary?.finalTotal)
  if (total <= 0) return okResult(params.operationalSnapshot)

  const pricing = readOperationalSnapshotPricing(params.operationalSnapshot)
  const hasOperationalValue =
    asNumber(pricing.effectiveLaborHours) > 0 ||
    asNumber(pricing.rawLaborHours) > 0 ||
    asNumber(pricing.paintMaterialCost) > 0 ||
    asNumber(pricing.primerMaterialCost) > 0 ||
    asNumber(pricing.supplyCost) > 0 ||
    asNumber(pricing.sharedAccessCost) > 0

  if (
    hasOperationalValue ||
    countOperationalSnapshotRooms(params.operationalSnapshot) > 0 ||
    countOperationalSnapshotScopes(params.operationalSnapshot) > 0
  ) {
    return okResult(params.operationalSnapshot)
  }

  if (countContextPersistedOperationalRows(params.context) > 0) {
    return errorResult(
      'invalid_input',
      'Cannot generate public quote version because the operational estimate snapshot is empty while saved estimate rooms or scopes exist. Save or reload the quote and try again.'
    )
  }

  return okResult(params.operationalSnapshot)
}

function hasCustomerSendOperationalSourceDrift(params: {
  context: CustomerQuoteSourceModel
  snapshot: Record<string, unknown> | null | undefined
}) {
  const persistedUpdatedAt = readOperationalSnapshotEstimateUpdatedAt(params.snapshot)
  const currentUpdatedAt = asText(params.context.estimate.updated_at)
  if (!currentUpdatedAt) return false
  return !persistedUpdatedAt || persistedUpdatedAt !== currentUpdatedAt
}

async function buildCustomerSendOperationalSnapshot(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  context: CustomerQuoteSourceModel
}): Promise<ServiceResult<Record<string, unknown>>> {
  const inputs = params.context.inputs
  const wallRows = rowsOf(inputs.room_wall_scopes)
  const ceilingRows = rowsOf(inputs.room_ceiling_scopes)
  const trimRows = rowsOf(inputs.room_trim_scopes)
  const doorRows = rowsOf(inputs.room_door_scopes)
  const drywallRows = rowsOf(inputs.drywall_repairs)
  const otherRows = rowsOf(inputs.other)
  const accessRows = rowsOf(inputs.access_fees)
  const paintRows = [...wallRows, ...ceilingRows, ...trimRows, ...doorRows]
  const allScopeRows = [...paintRows, ...drywallRows, ...otherRows]
  const laborHours =
    sumRows(allScopeRows, 'effective_paint_hours') +
    sumRows(allScopeRows, 'effective_primer_hours')
  const supplyCost = sumRows(allScopeRows, 'effective_supply_cost')

  return okResult({
    artifact_kind: CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND,
    artifact_version: CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION,
    source_estimate_updated_at: asText(params.context.estimate.updated_at),
    estimate_response: {
      estimate: params.context.estimate,
      inputs,
      wall_calculations: { scopes: wallRows },
      ceiling_calculations: { scopes: ceilingRows },
      trim_calculations: { scopes: trimRows },
      door_calculations: { scopes: doorRows },
      drywall_calculations: { scopes: drywallRows },
      pricing_summary: {
        ...(params.context.pricing_summary ?? {}),
        finalTotal: asNumber(params.context.pricing_summary?.finalTotal),
        effectiveLaborHours: laborHours,
        rawLaborHours: laborHours,
        supplyCost,
        paintMaterialCost: paintMaterialCost(paintRows),
        primerMaterialCost: 0,
        sharedAccessCost: sumRows(accessRows, 'effective_total'),
      },
    },
  })
}

async function saveCustomerSendDraftVersionForCurrentContext(params: {
  origin: string
  orgId: string
  estimateId: string
  customerId: string
  userId: string
  draft: CustomerSendDraft
  document: CustomerEstimateDocument
  latestDraft: EstimatePublicVersionRow | null
  latestVersion: EstimatePublicVersionRow | null
  context: CustomerQuoteSourceModel
  existingOperationalSnapshot?: Record<string, unknown>
}) {
  const operationalSnapshot = params.existingOperationalSnapshot
    ? okResult(params.existingOperationalSnapshot)
    : await buildCustomerSendOperationalSnapshot({
        origin: params.origin,
        orgId: params.orgId,
        userId: params.userId,
        estimateId: params.estimateId,
        context: params.context,
      })
  if (!operationalSnapshot.ok) return operationalSnapshot
  const validatedOperationalSnapshot = validateCustomerSendOperationalSnapshot({
    context: params.context,
    document: params.document,
    operationalSnapshot: operationalSnapshot.data,
  })
  if (!validatedOperationalSnapshot.ok) return validatedOperationalSnapshot

  return saveCustomerSendDraftVersion({
    orgId: params.orgId,
    estimateId: params.estimateId,
    customerId: params.customerId,
    userId: params.userId,
    draft: params.draft,
    document: params.document,
    operationalSnapshot: validatedOperationalSnapshot.data,
    latestDraft: params.latestDraft,
    latestVersion: params.latestVersion,
  })
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

function hasCustomerSendDocumentContextDrift(params: {
  context: CustomerQuoteSourceModel
  document: CustomerSendPageData['document']
}) {
  const currentCompany = params.context.company
  const documentCompany = params.document.company
  const companyFields: Array<keyof typeof currentCompany> = [
    'business_name',
    'main_phone',
    'business_email',
  ]

  return companyFields.some(
    (field) => !asText(documentCompany[field]) && !!asText(currentCompany[field])
  )
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
  origin: string
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
      const persistedPreview = buildPersistedPreviewResponse({
        context: params.context,
        version: latestDraft,
        artifactState,
      })
      if (!persistedPreview.ok) return persistedPreview
      const hasOperationalDrift = hasCustomerSendOperationalSourceDrift({
        context: params.context,
        snapshot: artifactState.snapshot,
      })
      if (
        !hasOperationalDrift &&
        (asText(latestDraft.public_token) ||
          !hasCustomerSendDocumentContextDrift({
          context: params.context,
          document: persistedPreview.data.document,
        }))
      ) {
        return persistedPreview
      }

      const normalizedDraft = normalizeCustomerSendDraftScopeText({
        context: params.context,
        draft: persistedPreview.data.draft,
      })
      if (!normalizedDraft.ok) return normalizedDraft

      const document = buildCustomerSendDocument({
        context: params.context,
        draft: normalizedDraft.data,
        publicMeta: buildCustomerSendPublicMeta(latestDraft, 'draft'),
      })
      if (!document.ok) return document

      const savedVersion = await saveCustomerSendDraftVersionForCurrentContext({
        origin: params.origin,
        orgId: params.orgId,
        estimateId: params.estimateId,
        customerId: asText(params.context.estimate.customer_id),
        userId: params.userId,
        draft: normalizedDraft.data,
        document: document.data,
        latestDraft,
        latestVersion: versionState.latestVersion,
        context: params.context,
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
  }

  const draftState = await resolveCustomerSendDraftState({
    orgId: params.orgId,
    context: params.context,
    versionState,
  })
  if (!draftState.ok) return draftState
  if (
    draftState.data.persistedPreview &&
    !hasCustomerSendOperationalSourceDrift({
      context: params.context,
      snapshot: draftState.data.latestDraft?.snapshot_json,
    })
  ) {
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

  const savedVersion = await saveCustomerSendDraftVersionForCurrentContext({
    origin: params.origin,
    orgId: params.orgId,
    estimateId: params.estimateId,
    customerId: asText(params.context.estimate.customer_id),
    userId: params.userId,
    draft: draftState.data.baseDraft,
    document: document.data,
    latestDraft: draftState.data.latestDraft,
    latestVersion: draftState.data.latestVersion,
    context: params.context,
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
  origin: string
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
      !hasCustomerSendOperationalSourceDrift({
        context: params.context,
        snapshot: previewState.data.latestDraft?.snapshot_json,
      }) &&
      !didCustomerSendArtifactInputsChange({
        currentDraft: persistedPreview.draft,
        nextDraft: mergedDraft,
      })

    if (shouldReusePersistedDocument) {
      const version = await saveCustomerSendDraftVersionForCurrentContext({
        origin: params.origin,
        orgId: params.orgId,
        estimateId: params.estimateId,
        customerId: asText(params.context.estimate.customer_id),
        userId: params.userId,
        draft: mergedDraft,
        document: persistedPreview.document,
        latestDraft: previewState.data.latestDraft,
        latestVersion: previewState.data.latestVersion,
        context: params.context,
        existingOperationalSnapshot: readOperationalSnapshot(
          previewState.data.latestDraft?.snapshot_json
        ),
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
    !hasCustomerSendOperationalSourceDrift({
      context: params.context,
      snapshot: draftState.data.latestDraft?.snapshot_json,
    }) &&
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

  const version = await saveCustomerSendDraftVersionForCurrentContext({
    origin: params.origin,
    orgId: params.orgId,
    estimateId: params.estimateId,
    customerId: asText(params.context.estimate.customer_id),
    userId: params.userId,
    draft: normalizedDraft.data,
    document: document.data,
    latestDraft: draftState.data.latestDraft,
    latestVersion: draftState.data.latestVersion,
    context: params.context,
    existingOperationalSnapshot:
      persistedPreview &&
      !hasCustomerSendOperationalSourceDrift({
        context: params.context,
        snapshot: draftState.data.latestDraft?.snapshot_json,
      }) &&
      !didCustomerSendArtifactInputsChange({
        currentDraft: persistedPreview.draft,
        nextDraft: normalizedDraft.data,
      })
        ? readOperationalSnapshot(draftState.data.latestDraft?.snapshot_json)
        : undefined,
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

function normalizeScopeTextForComparison(value: string) {
  return asText(value)
    .toLowerCase()
    .replace(/\bwith\b/g, 'using')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

function stripGeneratedProductClause(value: string) {
  return value
    .replace(/,\s*using\s+[^.,;!?]+(?=\s*(?:,\s*with\b|[.,;!?]?$))/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

function matchesPersistedGeneratedScopeText(value: string, documentText: string) {
  const normalizedValue = normalizeScopeTextForComparison(value)
  const normalizedDocument = normalizeScopeTextForComparison(documentText)

  return (
    normalizedValue === normalizedDocument ||
    normalizedValue === stripGeneratedProductClause(normalizedDocument)
  )
}

function normalizeCustomerSendDraftScopeTextFromDocument(params: {
  draft: CustomerSendDraft
  document: CustomerSendPageData['document']
}) {
  const persistedTextByKey = new Map<CustomerSendScopeKey, string>(
    params.document.scopes.map((section) => [section.key, section.text])
  )
  const scopeTextEdits = { ...params.draft.scope_text_edits }

  for (const [key, value] of Object.entries(scopeTextEdits) as Array<[CustomerSendScopeKey, string]>) {
    const text = asText(value)
    const persistedText = asText(persistedTextByKey.get(key))
    if (text && persistedText && matchesPersistedGeneratedScopeText(text, persistedText)) {
      scopeTextEdits[key] = ''
    }
  }

  return {
    ...params.draft,
    scope_text_edits: scopeTextEdits,
  }
}

async function resolveCustomerSendSendVersion(params: {
  origin: string
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
  if (
    hasCustomerSendOperationalSourceDrift({
      context: params.context,
      snapshot: previewState.data.latestDraft.snapshot_json,
    })
  ) {
    return errorResult(
      'invalid_input',
      'Save draft before sending. Current quote data differs from the persisted preview artifact.'
    )
  }

  const mergedDraft = mergeCustomerSendDraftInput({
    baseDraft: persistedPreview.draft,
    body: params.draftSource,
  })
  const normalizedDraft = normalizeCustomerSendDraftScopeTextFromDocument({
    draft: mergedDraft,
    document: persistedPreview.document,
  })

  if (
    didCustomerSendArtifactInputsChange({
      currentDraft: persistedPreview.draft,
      nextDraft: normalizedDraft,
    })
  ) {
    return errorResult(
      'invalid_input',
      'Save draft before sending. Document-impacting send fields differ from the persisted preview artifact.'
    )
  }

  if (draftsMatch(persistedPreview.draft, normalizedDraft)) {
    return okResult({
      document: persistedPreview.document,
      draft: persistedPreview.draft,
      readiness: persistedPreview.readiness,
      version: previewState.data.latestDraft,
    })
  }

  const version = await saveCustomerSendDraftVersionForCurrentContext({
    origin: params.origin,
    orgId: params.orgId,
    estimateId: params.estimateId,
    customerId: asText(params.context.estimate.customer_id),
    userId: params.userId,
    draft: normalizedDraft,
    document: persistedPreview.document,
    latestDraft: previewState.data.latestDraft,
    latestVersion: previewState.data.latestVersion,
    context: params.context,
    existingOperationalSnapshot: readOperationalSnapshot(
      previewState.data.latestDraft?.snapshot_json
    ),
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
    origin: params.origin,
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
          origin: params.origin,
          orgId: params.orgId,
          userId: params.userId,
          estimateId: params.estimateId,
          context: params.context,
          draftSource: params.body ?? {},
        })
      : await persistCustomerSendDraftVersion({
          origin: params.origin,
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
