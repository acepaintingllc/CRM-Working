import {
  normalizeWallRollerTargetId,
  wallRollerTargetIdsMatch,
} from '@/lib/estimator/rollerIdentity'
import type { EstimateV2RollerDraft, EstimateV2RollerScope } from '@/types/estimator/v2'

export type DetailsRollerRowTarget = {
  scope: EstimateV2RollerScope
  wallColorId: string
}

export function createDetailsRollerRowTarget(params: {
  scope: EstimateV2RollerScope
  wallColorId?: string | null
}): DetailsRollerRowTarget {
  if (params.scope === 'Ceiling' || params.scope === 'Trim') {
    return { scope: params.scope, wallColorId: '' }
  }
  return {
    scope: 'Wall',
    wallColorId: normalizeWallRollerTargetId(params.wallColorId),
  }
}

export function createWallDetailsRollerRowTarget(wallGroupId: string): DetailsRollerRowTarget {
  return createDetailsRollerRowTarget({ scope: 'Wall', wallColorId: wallGroupId })
}

export function createAggregateDetailsRollerRowTarget(
  scope: Extract<EstimateV2RollerScope, 'Ceiling' | 'Trim'>
): DetailsRollerRowTarget {
  return createDetailsRollerRowTarget({ scope })
}

export function parseDetailsRollerRowId(rowId: string): DetailsRollerRowTarget {
  const normalizedRowId = rowId.trim()
  const normalizedAggregateId = normalizedRowId.toLowerCase()
  if (normalizedAggregateId === 'ceiling') {
    return createAggregateDetailsRollerRowTarget('Ceiling')
  }
  if (normalizedAggregateId === 'trim') {
    return createAggregateDetailsRollerRowTarget('Trim')
  }
  if (normalizedAggregateId.startsWith('wall:')) {
    return createWallDetailsRollerRowTarget(normalizedRowId.slice('wall:'.length))
  }
  return createWallDetailsRollerRowTarget(normalizedRowId)
}

export function detailsRollerRowId(target: DetailsRollerRowTarget) {
  if (target.scope === 'Ceiling') return 'ceiling'
  if (target.scope === 'Trim') return 'trim'
  return `wall:${normalizeWallRollerTargetId(target.wallColorId)}`
}

export function detailsRollerDraftMatchesTarget(
  roller: Pick<EstimateV2RollerDraft, 'scope' | 'wallColorId'>,
  target: DetailsRollerRowTarget
) {
  if (roller.scope !== target.scope) return false
  if (target.scope === 'Ceiling' || target.scope === 'Trim') return true
  return wallRollerTargetIdsMatch(roller.wallColorId, target.wallColorId)
}

export function findDetailsRollerDraft(params: {
  rollers: EstimateV2RollerDraft[]
  target: DetailsRollerRowTarget
}) {
  return params.rollers.find((roller) => detailsRollerDraftMatchesTarget(roller, params.target))
}

export function findDetailsRollerDraftIndex(params: {
  rollers: EstimateV2RollerDraft[]
  target: DetailsRollerRowTarget
}) {
  return params.rollers.findIndex((roller) => detailsRollerDraftMatchesTarget(roller, params.target))
}

export function findDetailsRollerDraftForRowId(params: {
  rollers: EstimateV2RollerDraft[]
  rowId: string
}) {
  return findDetailsRollerDraft({
    rollers: params.rollers,
    target: parseDetailsRollerRowId(params.rowId),
  })
}

export function findDetailsRollerDraftIndexForRowId(params: {
  rollers: EstimateV2RollerDraft[]
  rowId: string
}) {
  return findDetailsRollerDraftIndex({
    rollers: params.rollers,
    target: parseDetailsRollerRowId(params.rowId),
  })
}
