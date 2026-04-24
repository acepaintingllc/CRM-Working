'use client'

import { valueFromRatesFlagsRow } from '@/lib/quotes/ratesFlagsForm'
import { useQuoteRatesPageController } from './quoteRatesPageController'
import {
  buildQuoteRatesPageVm,
  type QuoteRatesDiscardVm,
  type QuoteRatesEditorVm,
  type QuoteRatesFiltersVm,
  type QuoteRatesTableVm,
} from './quoteRatesPageVm'

export {
  FLAGS_SECTIONS,
  RATE_SECTIONS,
  RATE_SUBGROUPS,
  ROOM_DEFAULTS_SECTIONS,
  type FlagsSectionKey,
  type RateSectionKey,
  type RoomDefaultsSectionKey,
  type StatusFilter,
} from './quoteRatesPageConfig'

export type {
  QuoteRatesDiscardVm,
  QuoteRatesEditorVm,
  QuoteRatesFiltersVm,
  QuoteRatesTableVm,
}
export type { QuoteRatesActions } from './quoteRatesPageController'

export function useQuoteRatesPage() {
  const controller = useQuoteRatesPageController()
  const pageVm = buildQuoteRatesPageVm({
    resource: controller.resource,
    workflowState: controller.workflowState,
    derived: controller.derived,
  })

  return {
    resource: controller.resource,
    valueFromRow: valueFromRatesFlagsRow,
    uiState: pageVm.uiState,
    filtersVm: pageVm.filtersVm,
    workflowVm: pageVm.workflowVm,
    tableVm: pageVm.tableVm,
    editorVm: pageVm.editorVm,
    discardVm: pageVm.discardVm,
    actions: controller.actions,
  }
}
