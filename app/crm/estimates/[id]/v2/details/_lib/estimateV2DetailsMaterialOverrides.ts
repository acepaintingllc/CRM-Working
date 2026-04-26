import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'
import type { DetailsValidationIssue } from './estimateV2DetailsVm'
import { isActive } from './estimateV2DetailsShared'
import { createMaterialGroupedOverrideConflictIssue } from './estimateV2DetailsValidation'

export function wallScopeGroupKey(scope: Pick<EstimateV2WallScopeDraft, 'id' | 'colorId'>) {
  return scope.colorId || `scope:${scope.id}`
}

function compareScopeIds(left: { id: string }, right: { id: string }) {
  return left.id.localeCompare(right.id)
}

function selectDeterministicScopeId<TScope extends { id: string }>(scopes: TScope[]) {
  return [...scopes].sort(compareScopeIds)[0]?.id ?? null
}

export function resolveGroupedOverride(params: {
  label: string
  targetId: string
  scopes: Array<{ id: string }>
  valuesByScopeId: Map<string, string>
}) {
  const ownerScopeId = selectDeterministicScopeId(params.scopes)
  const persistedOverrides = params.scopes
    .map((scope) => ({
      scopeId: scope.id,
      value: params.valuesByScopeId.get(scope.id) ?? '',
    }))
    .filter((entry) => entry.value.trim())
    .sort((left, right) => left.scopeId.localeCompare(right.scopeId))
  const overrideGallons = persistedOverrides[0]?.value ?? ''
  const overrideOwnerScopeId = persistedOverrides[0]?.scopeId ?? ownerScopeId
  const uniqueValues = Array.from(new Set(persistedOverrides.map((entry) => entry.value.trim())))
  const conflictKind = uniqueValues.length === 1 ? 'duplicate' : 'conflicting'
  const errors: DetailsValidationIssue[] =
    persistedOverrides.length <= 1
      ? []
      : [
          createMaterialGroupedOverrideConflictIssue({
            label: params.label,
            targetId: params.targetId,
            conflictKind,
          }),
        ]

  return {
    overrideGallons,
    ownerScopeId: overrideOwnerScopeId,
    errors,
  }
}

export function applyWallGroupGallonOverride(
  scopes: EstimateV2WallScopeDraft[],
  groupKey: string,
  value: string,
  ownerScopeId?: string | null
) {
  return applyGroupedMaterialOverridePersistencePolicy({
    scopes,
    value,
    ownerScopeId,
    belongsToGroup: (scope) => wallScopeGroupKey(scope) === groupKey,
    getPersistedValue: (scope) => scope.overridePaintGallons,
    applyValue: (scope, overrideValue) => ({ ...scope, overridePaintGallons: overrideValue }),
  })
}

export function applyCeilingGallonOverride(
  scopes: EstimateV2CeilingScopeDraft[],
  value: string,
  ownerScopeId?: string | null
) {
  return applyGroupedMaterialOverridePersistencePolicy({
    scopes,
    value,
    ownerScopeId,
    belongsToGroup: () => true,
    getPersistedValue: (scope) => scope.overridePaintGallons,
    applyValue: (scope, overrideValue) => ({ ...scope, overridePaintGallons: overrideValue }),
  })
}

export function applyTrimGallonOverride(
  scopes: EstimateV2TrimScopeDraft[],
  value: string,
  ownerScopeId?: string | null
) {
  return applyGroupedMaterialOverridePersistencePolicy({
    scopes,
    value,
    ownerScopeId,
    belongsToGroup: () => true,
    getPersistedValue: (scope) => scope.overrideGallons,
    applyValue: (scope, overrideValue) => ({ ...scope, overrideGallons: overrideValue }),
  })
}

function selectGroupedMaterialOverrideOwner<TScope extends { id: string; include: string }>(
  params: {
    scopes: TScope[]
    ownerScopeId?: string | null
    belongsToGroup: (scope: TScope) => boolean
    getPersistedValue?: (scope: TScope) => string
  }
) {
  const activeGroupScopes = params.scopes.filter(
    (scope) => params.belongsToGroup(scope) && isActive(scope.include)
  )
  const requestedOwner = activeGroupScopes.find((scope) => scope.id === params.ownerScopeId)
  if (requestedOwner) return requestedOwner.id

  const savedOwner = params.getPersistedValue
    ? [...activeGroupScopes]
        .sort(compareScopeIds)
        .find((scope) => params.getPersistedValue?.(scope).trim())
    : null

  return savedOwner?.id ?? selectDeterministicScopeId(activeGroupScopes)
}

export function applyGroupedMaterialOverridePersistencePolicy<
  TScope extends { id: string; include: string },
>(
  params: {
    scopes: TScope[]
    value: string
    ownerScopeId?: string | null
    belongsToGroup: (scope: TScope) => boolean
    getPersistedValue?: (scope: TScope) => string
    applyValue: (scope: TScope, value: string) => TScope
  }
) {
  const ownerScopeId = selectGroupedMaterialOverrideOwner(params)
  let changed = false
  const nextScopes = params.scopes.map((scope) => {
    if (!params.belongsToGroup(scope)) return scope

    const overrideValue = isActive(scope.include) && scope.id === ownerScopeId ? params.value : ''
    if (params.getPersistedValue?.(scope) === overrideValue) return scope
    changed = true
    return params.applyValue(scope, overrideValue)
  })
  return changed ? nextScopes : params.scopes
}
