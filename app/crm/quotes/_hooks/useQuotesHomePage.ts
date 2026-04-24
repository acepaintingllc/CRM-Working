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
  const pageResources = useQuoteHomePageResources(initialData)

  return useMemo(
    () =>
      buildQuoteHomePageVm(pageResources.vmState, pageResources.vmResources, {
        includeVersionFailureInFeedback: false,
      }),
    [pageResources.vmResources, pageResources.vmState]
  )
}
