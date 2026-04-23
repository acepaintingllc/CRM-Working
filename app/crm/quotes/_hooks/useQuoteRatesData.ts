'use client'

import { useResource } from '@/app/crm/_hooks/useResource'
import { loadRatesFlags } from '@/lib/quotes/client'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

const emptyRatesFlags: RatesFlagsPayload = {
  source: 'db',
  seeded: false,
  template_version: null,
  categories: [],
}

export function useQuoteRatesData() {
  return useResource<RatesFlagsPayload>({
    initialData: emptyRatesFlags,
    load: () => loadRatesFlags(),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load rates and flags.',
    resetOnError: false,
  })
}
