export type CustomerVisibleAllocationScopeKey =
  | 'walls'
  | 'ceilings'
  | 'trim'
  | 'doors'
  | 'drywall'
  | 'cabinets'
  | 'other'

export type CustomerVisibleAllocationRow = {
  id: string
  key: CustomerVisibleAllocationScopeKey
  roomId: string | null
  sourceKind: 'walls' | 'ceilings' | 'trim' | 'doors' | 'drywall' | 'cabinets' | 'other'
  preFeePrice: number
  included: boolean
}

export type HiddenCustomerFeeKind =
  | 'access_fee'
  | 'prejob_trip'
  | 'job_minimum_adjustment'
  | 'labor_rounding_adjustment'
  | 'internal_manual_adjustment'

export type HiddenCustomerFee = {
  id: string
  kind: HiddenCustomerFeeKind
  roomId: string | null
  amount: number
  preferredScopeKey?: CustomerVisibleAllocationScopeKey | null
  source?: Record<string, unknown>
}

export type HiddenFeeAllocationResult = {
  sectionAdjustments: Record<CustomerVisibleAllocationScopeKey, number>
  fallbackAdditionalWorkAmount: number
  allocations: Array<{
    feeId: string
    feeKind: HiddenCustomerFeeKind
    targetRowId: string | null
    targetSectionKey: CustomerVisibleAllocationScopeKey
    amount: number
  }>
}

const scopeKeys: CustomerVisibleAllocationScopeKey[] = [
  'walls',
  'ceilings',
  'trim',
  'doors',
  'drywall',
  'cabinets',
  'other',
]

function emptySectionAdjustments(): Record<CustomerVisibleAllocationScopeKey, number> {
  return {
    walls: 0,
    ceilings: 0,
    trim: 0,
    doors: 0,
    drywall: 0,
    cabinets: 0,
    other: 0,
  }
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function positiveMoney(value: number) {
  return Number.isFinite(value) && value > 0 ? round2(value) : 0
}

function normalizedRoomId(value: string | null) {
  const roomId = String(value ?? '').trim().toUpperCase()
  return roomId || null
}

function rowSortKey(row: CustomerVisibleAllocationRow) {
  return [
    scopeKeys.indexOf(row.key),
    normalizedRoomId(row.roomId) ?? '',
    row.id,
  ].join('|')
}

function sortedIncludedRows(rows: CustomerVisibleAllocationRow[]) {
  return rows
    .filter((row) => row.included && positiveMoney(row.preFeePrice) > 0)
    .map((row) => ({ ...row, roomId: normalizedRoomId(row.roomId) }))
    .sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b)))
}

function targetRowsForFee(
  fee: HiddenCustomerFee,
  rows: CustomerVisibleAllocationRow[]
) {
  const feeRoomId = normalizedRoomId(fee.roomId)
  const preferredScopeKey = fee.preferredScopeKey ?? null
  if (fee.kind === 'prejob_trip' && feeRoomId) {
    const roomDrywallMatches = rows.filter(
      (row) => row.roomId === feeRoomId && row.sourceKind === 'drywall'
    )
    if (roomDrywallMatches.length > 0) return roomDrywallMatches
  }

  const roomAndScopeMatches =
    feeRoomId && preferredScopeKey
      ? rows.filter((row) => row.roomId === feeRoomId && row.key === preferredScopeKey)
      : []
  if (roomAndScopeMatches.length > 0) return roomAndScopeMatches

  const roomMatches = feeRoomId ? rows.filter((row) => row.roomId === feeRoomId) : []
  if (roomMatches.length > 0) return roomMatches

  const scopeMatches = preferredScopeKey ? rows.filter((row) => row.key === preferredScopeKey) : []
  if (scopeMatches.length > 0) return scopeMatches

  const nonOtherRows = rows.filter((row) => row.key !== 'other')
  return nonOtherRows.length > 0 ? nonOtherRows : rows
}

function allocateAmountAcrossRows(params: {
  fee: HiddenCustomerFee
  rows: CustomerVisibleAllocationRow[]
}) {
  const amount = positiveMoney(params.fee.amount)
  if (amount <= 0 || params.rows.length === 0) return []

  const totalWeight = params.rows.reduce(
    (sum, row) => sum + Math.max(positiveMoney(row.preFeePrice), 0),
    0
  )
  if (totalWeight <= 0) return []

  let remaining = amount
  return params.rows.map((row, index) => {
    const isLast = index === params.rows.length - 1
    const allocated = isLast
      ? remaining
      : round2(amount * (positiveMoney(row.preFeePrice) / totalWeight))
    remaining = round2(remaining - allocated)
    return {
      feeId: params.fee.id,
      feeKind: params.fee.kind,
      targetRowId: row.id,
      targetSectionKey: row.key,
      amount: allocated,
    }
  }).filter((allocation) => allocation.amount > 0)
}

export function allocateHiddenCustomerFees(params: {
  rows: CustomerVisibleAllocationRow[]
  fees: HiddenCustomerFee[]
}): HiddenFeeAllocationResult {
  const sectionAdjustments = emptySectionAdjustments()
  const allocations: HiddenFeeAllocationResult['allocations'] = []
  let fallbackAdditionalWorkAmount = 0
  const rows = sortedIncludedRows(params.rows)

  for (const fee of params.fees) {
    const amount = positiveMoney(fee.amount)
    if (amount <= 0) continue

    const targetRows = targetRowsForFee(fee, rows)
    const feeAllocations = allocateAmountAcrossRows({ fee: { ...fee, amount }, rows: targetRows })

    if (feeAllocations.length === 0) {
      fallbackAdditionalWorkAmount = round2(fallbackAdditionalWorkAmount + amount)
      allocations.push({
        feeId: fee.id,
        feeKind: fee.kind,
        targetRowId: null,
        targetSectionKey: 'other',
        amount,
      })
      continue
    }

    for (const allocation of feeAllocations) {
      sectionAdjustments[allocation.targetSectionKey] = round2(
        sectionAdjustments[allocation.targetSectionKey] + allocation.amount
      )
      allocations.push(allocation)
    }
  }

  return {
    sectionAdjustments,
    fallbackAdditionalWorkAmount,
    allocations,
  }
}
