'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import { loadRatesFlags } from '@/lib/quotes/client'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

const emptyRatesFlags: RatesFlagsPayload = {
  source: 'db',
  seeded: false,
  template_version: null,
  categories: [],
}

export type QuoteRatesDataResource = {
  data: RatesFlagsPayload
  setData: Dispatch<SetStateAction<RatesFlagsPayload>>
  loading: boolean
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  refresh: () => Promise<boolean>
  attemptRefresh: (options?: {
    preserveDataOnError?: boolean
    reportError?: boolean
  }) => Promise<{
    ok: boolean
    error: string | null
    data: RatesFlagsPayload | null
  }>
}

export function useQuoteRatesData() {
  return useResource<RatesFlagsPayload>({
    initialData: emptyRatesFlags,
    load: () => loadRatesFlags(),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load rates and flags.',
    resetOnError: false,
  }) as QuoteRatesDataResource
}
