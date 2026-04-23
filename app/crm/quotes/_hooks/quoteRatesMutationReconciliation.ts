'use client'

import type {
  RatesFlagsActivationMutationRequest,
  RatesFlagsCreateOrUpdateMutation,
  RatesFlagsPayload,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'

type MutationRequest = RatesFlagsCreateOrUpdateMutation | RatesFlagsActivationMutationRequest

export function reconcileRatesFlagsPayload(
  payload: RatesFlagsPayload,
  request: MutationRequest
) {
  void request
  return payload
}

export function findReconciledRatesRow(
  payload: RatesFlagsPayload,
  categoryKey: string,
  rowId: string
): RatesFlagsRow | null {
  const category = payload.categories.find((item) => item.key === categoryKey) ?? null
  return category?.rows.find((row) => row.id === rowId) ?? null
}
