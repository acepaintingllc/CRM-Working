'use client'

import { useQuoteAdminIntentGuard } from './useQuoteAdminIntentGuard'

export type QuoteProductPendingTransition =
  | { type: 'setSelectedId'; selectedId: string | null }
  | { type: 'setActiveFamily'; nextFamily: import('@/lib/quotes/productsForm').ProductFamily }
  | { type: 'setStatusFilter'; status: string }
  | { type: 'setSearch'; search: string }
  | { type: 'startCreate' }

type Options = {
  hasUnsavedChanges: boolean
  getHasUnsavedChanges: () => boolean
  applyTransition: (
    transition: QuoteProductPendingTransition
  ) => boolean | Promise<boolean>
}

export function useQuoteProductsDiscardGuard({
  hasUnsavedChanges,
  getHasUnsavedChanges,
  applyTransition,
}: Options) {
  const guard = useQuoteAdminIntentGuard<QuoteProductPendingTransition>({
    hasUnsavedChanges,
    getHasUnsavedChanges,
    getIntentType: (intent) => intent.type,
  })

  function requestTransition<TResult>(
    intent: QuoteProductPendingTransition,
    changed: boolean,
    run?: () => TResult | Promise<TResult>
  ) {
    return guard.requestIntent(intent, {
      changed,
      run: run ?? (() => applyTransition(intent) as TResult | Promise<TResult>),
    })
  }

  return {
    requestTransition,
    confirmDiscard: () => guard.confirmDiscard(applyTransition),
    cancelDiscard: guard.cancelDiscard,
    discardVm: {
      isOpen: guard.discardVm.isOpen,
      status: guard.discardVm.status,
      transitionType: guard.discardVm.intentType as QuoteProductPendingTransition['type'] | null,
    },
  }
}
