'use client'

import { mutateRatesFlags } from '@/lib/quotes/client'
import type {
  RatesFlagsArchiveMutation,
  RatesFlagsCreateOrUpdateMutation,
} from '@/types/estimator/ratesFlags'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'

type Options = {
  refresh: (keepId?: string) => Promise<boolean>
  feedback: ReturnType<typeof useDenseQuoteAdminFeedback>
}

export function useQuoteRatesPersistence({ refresh, feedback }: Options) {
  async function persist(
    request: RatesFlagsCreateOrUpdateMutation | RatesFlagsArchiveMutation
  ) {
    feedback.beginAction()
    try {
      await mutateRatesFlags(request)
      return true
    } catch (mutationError) {
      feedback.setErrorMessage(
        mutationError instanceof Error ? mutationError.message : 'Failed to save changes.'
      )
      return false
    } finally {
      feedback.finishAction()
    }
  }

  async function saveMutation(params: {
    request: RatesFlagsCreateOrUpdateMutation
    keepId?: string
    notice: string
  }) {
    const ok = await persist(params.request)
    if (!ok) return false
    const reloaded = await refresh(params.keepId)
    if (!reloaded) return false
    feedback.setSuccessNotice(params.notice)
    return true
  }

  async function archiveToggle(params: {
    request: RatesFlagsArchiveMutation
  }) {
    const ok = await persist(params.request)
    if (!ok) return false
    const reloaded = await refresh(params.request.rowId)
    if (!reloaded) return false
    feedback.setSuccessNotice(
      params.request.action === 'reactivate' ? 'Reactivated row.' : 'Archived row.'
    )
    return true
  }

  return {
    saveMutation,
    archiveToggle,
  }
}
