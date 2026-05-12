'use client'

import { publishRatesFlagsBatch } from '@/lib/quotes/client'
import type {
  RatesFlagsEditableCategoryKey,
  RatesFlagsMutationRequest,
  RatesFlagsMutationRequestByCategory,
  RatesFlagsPayload,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import type { RatesFlagsMutationReconciliation } from './quoteRatesMutationReconciliation'
import { buildQuoteRatesMutationSnapshot } from './quoteRatesPageNavigation'
import type { QuoteRatesNavigationState } from './quoteRatesPageState'
import type { QuoteRatesDataResource } from './useQuoteRatesData'

type MutationErrorResult = {
  ok: false
  error: string
}

type MutationSuccessResult = {
  ok: true
  notice: string
  tone: 'success' | 'warning'
  selectedId: string
  editor: ReturnType<typeof buildQuoteRatesMutationSnapshot>['editor']
  reconciliation: RatesFlagsMutationReconciliation
}

type MutationResult = MutationErrorResult | MutationSuccessResult

type LocalApplyResult = {
  payload: RatesFlagsPayload
  request: RatesFlagsMutationRequest
  selectedId: string
  editor: ReturnType<typeof buildQuoteRatesMutationSnapshot>['editor']
  pendingMutations: RatesFlagsMutationRequest[]
}

function rowFromMutationValues(
  request: Extract<RatesFlagsMutationRequest, { action: 'create' | 'update' }>,
  fallback?: RatesFlagsRow
): RatesFlagsRow {
  const values = request.values as Record<string, string>
  const originalId = request.action === 'update' ? request.original_id : ''
  const id = values.id || fallback?.id || originalId
  const displayName = values.display_name || fallback?.display_name || id
  const activeValue = values.active

  return {
    ...(fallback ?? {}),
    ...values,
    id,
    display_name: displayName,
    notes: values.notes ?? fallback?.notes ?? '',
    active: activeValue ? activeValue === 'Y' : (fallback?.active ?? true),
  } as RatesFlagsRow
}

function applyLocalRatesFlagsRequest(
  payload: RatesFlagsPayload,
  request: RatesFlagsMutationRequest
): RatesFlagsPayload {
  return {
    ...payload,
    categories: payload.categories.map((category) => {
      if (category.key !== request.category) return category

      if (request.action === 'archive' || request.action === 'reactivate') {
        return {
          ...category,
          rows: category.rows.map((row) =>
            row.id === request.rowId ? { ...row, active: request.action === 'reactivate' } : row
          ),
        }
      }

      const existingIndex = category.rows.findIndex((row) =>
        request.action === 'create'
          ? row.id === request.values.id
          : row.id === request.original_id
      )
      const existingRow = existingIndex >= 0 ? category.rows[existingIndex] : undefined
      const nextRow = rowFromMutationValues(
        request as Extract<RatesFlagsMutationRequest, { action: 'create' | 'update' }>,
        existingRow
      )
      const rows = [...category.rows]

      if (existingIndex >= 0) {
        rows[existingIndex] = nextRow
      } else {
        rows.push(nextRow)
      }

      return { ...category, rows }
    }),
  }
}

function getMutationIdentity(request: RatesFlagsMutationRequest) {
  if (request.action === 'create') return `${request.category}:create:${request.values.id}`
  if (request.action === 'update') return `${request.category}:update:${request.original_id}`
  return `${request.category}:active:${request.rowId}`
}

export function mergePendingRatesFlagsMutation(
  pendingMutations: RatesFlagsMutationRequest[],
  request: RatesFlagsMutationRequest
) {
  if (request.action === 'archive' || request.action === 'reactivate') {
    const createIndex = pendingMutations.findIndex(
      (mutation) =>
        mutation.action === 'create' &&
        mutation.category === request.category &&
        mutation.values.id === request.rowId
    )
    if (createIndex >= 0) {
      const createMutation = pendingMutations[createIndex] as Extract<
        RatesFlagsMutationRequest,
        { action: 'create' }
      >
      return pendingMutations.map((mutation, index) =>
        index === createIndex
          ? ({
              ...createMutation,
              values: {
                ...createMutation.values,
                active: request.action === 'reactivate' ? 'Y' : 'N',
              },
            } as RatesFlagsMutationRequest)
          : mutation
      )
    }

    const activeIndex = pendingMutations.findIndex(
      (mutation) =>
        (mutation.action === 'archive' || mutation.action === 'reactivate') &&
        mutation.category === request.category &&
        mutation.rowId === request.rowId
    )
    if (activeIndex >= 0) {
      const existing = pendingMutations[activeIndex]
      if (
        existing &&
        (existing.action === 'archive' || existing.action === 'reactivate') &&
        existing.action !== request.action
      ) {
        return pendingMutations.filter((_, index) => index !== activeIndex)
      }
    }
  }

  if (request.action === 'update') {
    const createIndex = pendingMutations.findIndex(
      (mutation) =>
        mutation.action === 'create' &&
        mutation.category === request.category &&
        mutation.values.id === request.original_id
    )
    if (createIndex >= 0) {
      return pendingMutations.map((mutation, index) =>
        index === createIndex
          ? ({
              ...mutation,
              values: request.values,
            } as RatesFlagsMutationRequest)
          : mutation
      )
    }
  }

  const identity = getMutationIdentity(request)
  return [
    ...pendingMutations.filter((mutation) => getMutationIdentity(mutation) !== identity),
    request,
  ]
}

export function applyQuoteRatesLocalMutation(params: {
  resource: QuoteRatesDataResource
  navigation: QuoteRatesNavigationState
  pendingMutations: RatesFlagsMutationRequest[]
  request: RatesFlagsMutationRequestByCategory<RatesFlagsEditableCategoryKey>
  keepId: string
}): LocalApplyResult {
  const request = params.request as RatesFlagsMutationRequest
  const nextPayload = applyLocalRatesFlagsRequest(params.resource.data, request)
  const mutationSnapshot = buildQuoteRatesMutationSnapshot(
    nextPayload,
    params.navigation,
    params.keepId
  )
  const pendingMutations = mergePendingRatesFlagsMutation(params.pendingMutations, request)

  params.resource.setData(nextPayload)

  return {
    payload: nextPayload,
    request,
    selectedId: mutationSnapshot.selectedId,
    editor: mutationSnapshot.editor,
    pendingMutations,
  }
}

export async function publishQuoteRatesBatchMutation(params: {
  resource: QuoteRatesDataResource
  navigation: QuoteRatesNavigationState
  pendingMutations: RatesFlagsMutationRequest[]
  selectedRowId: string
}): Promise<MutationResult> {
  const { resource, navigation, pendingMutations, selectedRowId } = params

  try {
    const result = await publishRatesFlagsBatch({
      mutations: pendingMutations,
      reason: 'Rates, flags, and room defaults saved',
    })
    const nextPayload = result.data
    resource.setData(nextPayload)

    const mutationSnapshot = buildQuoteRatesMutationSnapshot(
      nextPayload,
      navigation,
      selectedRowId
    )

    return {
      ok: true,
      notice: 'Saved rates, flags, and room defaults.',
      tone: 'success',
      selectedId: mutationSnapshot.selectedId,
      editor: mutationSnapshot.editor,
      reconciliation: {
        kind: 'server_verified',
        payload: nextPayload,
        verificationError: null,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save changes.',
    }
  }
}
