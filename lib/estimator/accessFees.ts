import { asNullableNumber } from './parsing.ts'
import type { EstimateV2AccessFeeOption } from '@/types/estimator/v2Catalogs'
import type { EstimateV2AccessFeeDraft, EstimateV2TrimScopeDraft } from '@/types/estimator/v2Scopes'

export type AccessFeeCalculationRow = {
  id: string
  roomId: string
  accessFeeId: string
  label: string
  group: EstimateV2AccessFeeOption['access_group'] | null
  catalogAmount: number
  quantity: number
  calculatedTotal: number
  total: number
  overridden: boolean
  notes: string
  position: number
}

export type AccessFeeCalculationResult = {
  rows: AccessFeeCalculationRow[]
  total: number
}

export type AccessFeeScopeKey = 'walls' | 'ceilings' | 'trim' | 'doors' | 'drywall' | 'other'

export type AccessFeeAllocationScope = {
  key: AccessFeeScopeKey
  eligible: boolean
  preAccessSubtotal: number
}

export type AccessFeeAllocationResult = {
  allocations: Record<AccessFeeScopeKey, number>
  unallocated: number
  warning: string | null
}

const ACCESS_FEE_ALLOCATION_WARNING =
  'Access fees are present but no eligible active scope subtotal exists for allocation.'

function normalizeAccessFeeId(value: string) {
  return value.trim().toUpperCase()
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function asNullableOverrideNumber(value: unknown) {
  if (typeof value === 'string' && value.trim() === '') return null
  return asNullableNumber(value)
}

export function calculateAccessFeeRows({
  drafts,
  catalog,
}: {
  drafts: EstimateV2AccessFeeDraft[]
  catalog: EstimateV2AccessFeeOption[]
}): AccessFeeCalculationResult {
  const catalogById = new Map(
    catalog.map((option) => [normalizeAccessFeeId(option.id), option]),
  )

  const rows = drafts.flatMap((draft): AccessFeeCalculationRow[] => {
    const accessFeeId = normalizeAccessFeeId(draft.accessFeeId)
    if (!accessFeeId) return []

    const catalogOption = catalogById.get(accessFeeId)
    const parsedQuantity = asNullableNumber(draft.qty)
    const quantity = parsedQuantity == null ? 1 : parsedQuantity < 0 ? 1 : parsedQuantity
    const catalogAmount = asNullableNumber(catalogOption?.amount) ?? 0
    const calculatedTotal = roundCurrency(catalogAmount * quantity)
    const overrideTotal = asNullableOverrideNumber(draft.actualCostOverride)
    const overridden = quantity > 0 && overrideTotal != null
    const total = quantity > 0 ? roundCurrency(overridden ? overrideTotal : calculatedTotal) : 0

    return [{
      id: draft.id,
      roomId: draft.roomId,
      accessFeeId,
      label: catalogOption?.label ?? accessFeeId,
      group: catalogOption?.access_group ?? null,
      catalogAmount,
      quantity,
      calculatedTotal,
      total,
      overridden,
      notes: draft.notes,
      position: draft.position,
    }]
  })

  return {
    rows,
    total: roundCurrency(rows.reduce((sum, row) => sum + row.total, 0)),
  }
}

export function hasCrownTrimAccessEligibility(
  trimScopes: Array<Pick<EstimateV2TrimScopeDraft, 'include' | 'trimFamily' | 'trimTypeId'>>
) {
  return trimScopes.some((scope) => {
    if (scope.include !== 'Y') return false

    const trimText = `${scope.trimFamily} ${scope.trimTypeId}`
    return /crown/i.test(trimText)
  })
}

export function allocateAccessFeesByEligibleScope({
  accessFeeTotal,
  scopes,
}: {
  accessFeeTotal: number
  scopes: AccessFeeAllocationScope[]
}): AccessFeeAllocationResult {
  const total = roundCurrency(accessFeeTotal)
  const allocations: Record<AccessFeeScopeKey, number> = {
    walls: 0,
    ceilings: 0,
    trim: 0,
    doors: 0,
    drywall: 0,
    other: 0,
  }

  if (total <= 0) {
    return { allocations, unallocated: 0, warning: null }
  }

  const eligibleScopeSubtotals = new Map<AccessFeeScopeKey, number>()
  scopes.forEach((scope) => {
    if (!scope.eligible || scope.preAccessSubtotal <= 0) return

    eligibleScopeSubtotals.set(
      scope.key,
      (eligibleScopeSubtotals.get(scope.key) ?? 0) + scope.preAccessSubtotal,
    )
  })
  const eligibleScopes = Array.from(
    eligibleScopeSubtotals,
    ([key, preAccessSubtotal]) => ({ key, preAccessSubtotal }),
  )
  const eligibleSubtotal = eligibleScopes.reduce((sum, scope) => sum + scope.preAccessSubtotal, 0)

  if (eligibleScopes.length === 0 || eligibleSubtotal <= 0) {
    return {
      allocations,
      unallocated: total,
      warning: ACCESS_FEE_ALLOCATION_WARNING,
    }
  }

  let allocated = 0
  eligibleScopes.forEach((scope, index) => {
    const isLast = index === eligibleScopes.length - 1
    const amount = isLast
      ? roundCurrency(total - allocated)
      : roundCurrency(total * (scope.preAccessSubtotal / eligibleSubtotal))

    allocations[scope.key] = amount
    allocated = roundCurrency(allocated + amount)
  })

  return {
    allocations,
    unallocated: roundCurrency(total - allocated),
    warning: null,
  }
}
