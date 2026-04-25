import {
  normalizeWallRollerTargetId,
  wallRollerTargetIdsMatch,
} from '@/lib/estimator/rollerIdentity'
import type { EstimateV2RollerDraft, EstimateV2RollerScope } from '@/types/estimator/v2'

export type DetailsRollerRowTarget = {
  scope: EstimateV2RollerScope
  wallColorId: string
}

export function parseDetailsRollerRowId(rowId: string): DetailsRollerRowTarget {
  if (rowId === 'ceiling') return { scope: 'Ceiling', wallColorId: '' }
  if (rowId === 'trim') return { scope: 'Trim', wallColorId: '' }
  if (rowId.startsWith('wall:')) {
    return {
      scope: 'Wall',
      wallColorId: normalizeWallRollerTargetId(rowId.slice('wall:'.length)),
    }
  }
  return { scope: 'Wall', wallColorId: normalizeWallRollerTargetId(rowId) }
}

export function detailsRollerRowId(target: DetailsRollerRowTarget) {
  if (target.scope === 'Ceiling') return 'ceiling'
  if (target.scope === 'Trim') return 'trim'
  return `wall:${target.wallColorId}`
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
