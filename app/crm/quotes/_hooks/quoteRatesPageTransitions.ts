'use client'

import type {
  QuoteRatesNavigationState,
  QuoteRatesPendingTransition,
} from './quoteRatesPageState'
import { applyNavigationIntent } from './quoteRatesPageNavigation'

type TransitionExecutorParams = {
  intent: QuoteRatesPendingTransition
  navigation: QuoteRatesNavigationState
  selectedId: string
  applyNavigation: (navigation: QuoteRatesNavigationState, preferredId?: string) => boolean
  applySelection: (selectedId: string) => boolean
  startCreate: () => boolean
  startDuplicate: () => boolean
  performReload: (keepId?: string) => Promise<boolean>
  archiveOrReactivate: (nextActive: boolean) => Promise<boolean>
}

export function executeQuoteRatesTransition(params: TransitionExecutorParams) {
  const {
    intent,
    navigation,
    selectedId,
    applyNavigation,
    applySelection,
    startCreate,
    startDuplicate,
    performReload,
    archiveOrReactivate,
  } = params

  switch (intent.type) {
    case 'setActiveTab':
    case 'setRateSection':
    case 'setRateCategory':
    case 'setFlagsSection':
    case 'setRoomDefaultsSection':
      return applyNavigation(applyNavigationIntent(navigation, intent))
    case 'setStatusFilter':
    case 'setSearch':
      return applyNavigation(applyNavigationIntent(navigation, intent), selectedId || undefined)
    case 'setSelectedId':
      return applySelection(intent.selectedId)
    case 'startCreate':
      return startCreate()
    case 'startDuplicate':
      return startDuplicate()
    case 'reload':
      return performReload(intent.keepId)
    case 'archiveOrReactivate':
      return archiveOrReactivate(intent.nextActive)
    default:
      return false
  }
}
