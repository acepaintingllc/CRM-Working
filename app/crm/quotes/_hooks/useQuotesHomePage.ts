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
  const { pageState, homeResource, controller, vmResources } =
    useQuoteHomePageResources(initialData)
  const {
    searchQuery,
    searchFocused,
    jobQuery,
    selectedJobId,
    selectedJob,
  } = pageState

  return useMemo(
    () =>
      buildQuoteHomePageVm(
        {
          actionWarning: controller.actionWarning,
          searchQuery,
          searchFocused,
          jobQuery,
          selectedJobId,
          selectedJob,
          visibleJobs: homeResource.jobs,
          actions: controller.actions,
        },
        vmResources,
        { includeVersionFailureInFeedback: false }
      ),
    [
      controller.actionWarning,
      controller.actions,
      searchQuery,
      searchFocused,
      jobQuery,
      selectedJobId,
      selectedJob,
      homeResource.jobs,
      vmResources,
    ]
  )
}
