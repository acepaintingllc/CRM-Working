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
          rows: category.rows.map((row) =>
            row.id === request.rowId ? { ...row, active: request.action === 'reactivate' } : row
          ),
        }
      }

      const nextRow = buildRowFromMutation(request)
      const originalId = 'original_id' in request ? request.original_id : nextRow.id

      const updatedRows =
        request.action === 'create'
          ? [nextRow, ...category.rows.filter((row) => row.id !== nextRow.id)]
          : (() => {
              const rows = category.rows.reduce<RatesFlagsRow[]>((acc, row) => {
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

              if (!rows.some((row) => row.id === nextRow.id)) {
                rows.unshift(nextRow)
              }

              return rows
            })()

      return {
        ...category,
        rows: updatedRows,
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
