'use client'

import { useQuoteDefaultsPageController } from './quoteDefaultsPageController'
import { buildQuoteDefaultsPageVm } from './quoteDefaultsPageVm'

export function useQuoteDefaultsPage() {
  const controller = useQuoteDefaultsPageController()
  const pageVm = buildQuoteDefaultsPageVm(controller.resource)

  return {
    ...pageVm,
    actions: controller.actions,
  }
}
