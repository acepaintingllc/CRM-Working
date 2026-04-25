import { categoryByKey } from '@/lib/quotes/ratesFlagsForm'
import type {
  RatesFlagsCreateOrUpdateRequest,
  RatesFlagsEditableCategoryKey,
  RatesFlagsMutationRequestByCategory,
  RatesFlagsPayload,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'

export type RatesFlagsMutationVerification =
  | { ok: true; data: RatesFlagsPayload; error: null }
  | { ok: false; data: RatesFlagsPayload | null; error: string | null }

export type RatesFlagsMutationReconciliation =
  | {
      kind: 'server_verified'
      payload: RatesFlagsPayload
      verificationError: null
    }
  | {
      kind: 'local_fallback'
      payload: RatesFlagsPayload
      verificationError: string | null
    }

function buildRowFromMutation(
  request: RatesFlagsCreateOrUpdateRequest<RatesFlagsEditableCategoryKey>
): RatesFlagsRow {
  return {
    ...request.values,
    active: request.values.active === 'Y',
  } satisfies Partial<RatesFlagsRow> as RatesFlagsRow
}

function reconcileActivationRows(
  rows: RatesFlagsRow[],
  request: Extract<
    RatesFlagsMutationRequestByCategory<RatesFlagsEditableCategoryKey>,
    { action: 'archive' | 'reactivate' }
  >
) {
  return rows.map((row) =>
    row.id === request.rowId ? { ...row, active: request.action === 'reactivate' } : row
  )
}

function reconcileCreateOrUpdateRows(
  rows: RatesFlagsRow[],
  request: RatesFlagsCreateOrUpdateRequest<RatesFlagsEditableCategoryKey>
) {
  const nextRow = buildRowFromMutation(request)

  if (request.action === 'create') {
    return [nextRow, ...rows.filter((row) => row.id !== nextRow.id)]
  }

  const originalId = 'original_id' in request ? request.original_id : nextRow.id
  const reconciledRows = rows.reduce<RatesFlagsRow[]>((acc, row) => {
    if (row.id === originalId) {
      acc.push(nextRow)
      return acc
    }
    if (row.id === nextRow.id) {
      return acc
    }
    acc.push(row)
    return acc
  }, [])

  if (!reconciledRows.some((row) => row.id === nextRow.id)) {
    reconciledRows.unshift(nextRow)
  }

  return reconciledRows
}

export function reconcileRatesFlagsPayload(
  payload: RatesFlagsPayload,
  request: RatesFlagsMutationRequestByCategory<RatesFlagsEditableCategoryKey>
) {
  return {
    ...payload,
    categories: payload.categories.map((category) => {
      if (category.key !== request.category) {
        return category
      }

      if (request.action === 'archive' || request.action === 'reactivate') {
        return {
          ...category,
          rows: reconcileActivationRows(category.rows, request),
        }
      }

      return {
        ...category,
        rows: reconcileCreateOrUpdateRows(category.rows, request),
      }
    }),
  }
}

export function findReconciledRatesRow(
  payload: RatesFlagsPayload,
  categoryKey: RatesFlagsEditableCategoryKey,
  rowId: string
) {
  return categoryByKey(payload.categories, categoryKey)?.rows.find((row) => row.id === rowId) ?? null
}

export function decideRatesFlagsMutationReconciliation(params: {
  currentPayload: RatesFlagsPayload
  request: RatesFlagsMutationRequestByCategory<RatesFlagsEditableCategoryKey>
  verification: RatesFlagsMutationVerification
}): RatesFlagsMutationReconciliation {
  const { currentPayload, request, verification } = params

  if (verification.ok) {
    return {
      kind: 'server_verified',
      payload: verification.data,
      verificationError: null,
    }
  }

  return {
    kind: 'local_fallback',
    payload: reconcileRatesFlagsPayload(currentPayload, request),
    verificationError: verification.error,
  }
}
