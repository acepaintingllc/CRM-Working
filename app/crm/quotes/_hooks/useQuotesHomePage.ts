'use client'

import { useMemo } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import {
  buildQuoteHomePageVm,
  type QuoteHomePageVm,
} from '../_home/quoteHomePageVm'
import { useQuoteHomePageResources } from './useQuoteHomePageResources'

export function useQuotesHomePage(
  initialData?: QuoteHomeBootstrapReadModel | null
): QuoteHomePageVm {
  const { vmState, vmResources } = useQuoteHomePageResources(initialData)

  return useMemo(
    () =>
      buildQuoteHomePageVm(vmState, vmResources, {
        includeVersionFailureInFeedback: false,
      }),
    [vmResources, vmState]
  )
}
