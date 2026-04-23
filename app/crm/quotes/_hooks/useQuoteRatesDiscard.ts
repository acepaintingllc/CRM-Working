'use client'

import { useQuoteAdminIntentGuard } from './useQuoteAdminIntentGuard'
import type { QuoteRatesPendingTransition } from './useQuoteRatesPageControllerTypes'

export function useQuoteRatesDiscard(args: {
  isDirtyRef: { current: boolean }
  applyTransition: (intent: QuoteRatesPendingTransition) => boolean | Promise<boolean>
}) {
  const { isDirtyRef, applyTransition } = args
  const guard = useQuoteAdminIntentGuard<QuoteRatesPendingTransition>({
    hasUnsavedChanges: false,
    getHasUnsavedChanges: () => isDirtyRef.current,
    getIntentType: (intent) => intent.type,
  })

  function requestTransition(
    intent: QuoteRatesPendingTransition,
    changed: boolean
  ): boolean | Promise<boolean> {
    return guard.requestIntent(intent, {
      changed,
      run: () => applyTransition(intent),
    })
  }

  return {
    requestTransition,
    confirmDiscard: () => guard.confirmDiscard(applyTransition),
    cancelDiscard: guard.cancelDiscard,
    discardVm: {
      isOpen: guard.discardVm.isOpen,
      status: guard.discardVm.status,
      transitionType: guard.discardVm.intentType as QuoteRatesPendingTransition['type'] | null,
    },
  }
}
