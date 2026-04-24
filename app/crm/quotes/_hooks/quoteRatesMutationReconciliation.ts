import { categoryByKey } from '@/lib/quotes/ratesFlagsForm'
import type {
  RatesFlagsActivationMutationRequest,
  RatesFlagsCreateOrUpdateMutation,
  RatesFlagsPayload,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'

function buildRowFromMutation(request: RatesFlagsCreateOrUpdateMutation): RatesFlagsRow {
  return {
    ...request.values,
    active: request.values.active === 'Y',
  } satisfies Partial<RatesFlagsRow> as RatesFlagsRow
}

export function reconcileRatesFlagsPayload(
  payload: RatesFlagsPayload,
  request: RatesFlagsCreateOrUpdateMutation | RatesFlagsActivationMutationRequest
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
  categoryKey: RatesFlagsCreateOrUpdateMutation['category'],
  rowId: string
) {
  return categoryByKey(payload.categories, categoryKey)?.rows.find((row) => row.id === rowId) ?? null
}
