'use client'

import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { loadRatesFlags } from '@/lib/quotes/client'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

const emptyRatesFlags: RatesFlagsPayload = {
  source: 'db',
  seeded: false,
  template_version: null,
  categories: [],
}

export function useQuoteRatesData() {
  return useLoadableResource<RatesFlagsPayload>({
    initialData: emptyRatesFlags,
    load: () => loadRatesFlags(),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load rates and flags.',
  })
}
