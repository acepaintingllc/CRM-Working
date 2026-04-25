'use client'

import { useMemo } from 'react'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/quoteHomeTypes'
import {
  buildQuoteHomePageVm,
  type QuoteHomePageVm,
} from '../_home/quoteHomePageVm'
import { useQuoteHomePageResource } from './quoteHomePageResource'

export function useQuotesHomePage(
  initialData?: QuoteHomeBootstrapReadModel | null
): QuoteHomePageVm {
  const quoteHome = useQuoteHomePageResource(initialData)

  return useMemo(
    () =>
      buildQuoteHomePageVm(quoteHome.vmInput.state, quoteHome.vmInput.resources, {
        includeVersionFailureInFeedback: false,
      }),
    [quoteHome.vmInput]
  )
}
