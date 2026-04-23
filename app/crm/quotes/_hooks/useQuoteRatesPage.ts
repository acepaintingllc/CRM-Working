'use client'

import {
  useQuoteRatesPageController,
} from './quoteRatesPageController'
import { buildQuoteRatesPageVm } from './quoteRatesPageVm'

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
} from './quoteRatesPageVm'

export type QuoteRatesActions = {
  setActiveTab: (activeTab: import('@/types/estimator/ratesFlags').RatesFlagsTab) => boolean | Promise<boolean>
  setRateSection: (rateSection: import('./quoteRatesPageConfig').RateSectionKey) => boolean | Promise<boolean>
  setRateCategory: (rateCategory: string) => boolean | Promise<boolean>
  setFlagsSection: (flagsSection: import('./quoteRatesPageConfig').FlagsSectionKey) => boolean | Promise<boolean>
  setRoomDefaultsSection: (roomDefaultsSection: import('./quoteRatesPageConfig').RoomDefaultsSectionKey) => boolean | Promise<boolean>
  setStatusFilter: (statusFilter: import('./quoteRatesPageConfig').StatusFilter) => boolean | Promise<boolean>
  setSearch: (search: string) => boolean | Promise<boolean>
  setSelectedId: (selectedId: string) => boolean | Promise<boolean>
  setDraftActive: ReturnType<typeof useQuoteRatesPageController>['actions']['setDraftActive']
  reload: (keepId?: string) => boolean | Promise<boolean>
  saveCurrent: ReturnType<typeof useQuoteRatesPageController>['actions']['saveCurrent']
  archiveOrReactivate: (nextActive: boolean) => boolean | Promise<boolean>
  startCreate: () => boolean | Promise<boolean>
  startDuplicate: () => boolean | Promise<boolean>
  cancelEdit: ReturnType<typeof useQuoteRatesPageController>['actions']['cancelEdit']
  confirmDiscard: ReturnType<typeof useQuoteRatesPageController>['actions']['confirmDiscard']
  cancelDiscard: ReturnType<typeof useQuoteRatesPageController>['actions']['cancelDiscard']
  updateDraftValue: ReturnType<typeof useQuoteRatesPageController>['actions']['updateDraftValue']
}

export function useQuoteRatesPage() {
  const controller = useQuoteRatesPageController()
  const { resource, workflowState, derived } = controller
  const controllerActions = controller.actions
  const pageVm = buildQuoteRatesPageVm({ resource, workflowState, derived })

  return {
    resource,
    valueFromRow: controller.valueFromRow,
    workflowVm: pageVm.workflowVm,
    uiState: pageVm.uiState,
    filtersVm: pageVm.filtersVm,
    tableVm: pageVm.tableVm,
    editorVm: pageVm.editorVm,
    actions: {
      setActiveTab: (activeTab) => controllerActions.requestTransition({ type: 'setActiveTab', activeTab }, activeTab !== workflowState.navigation.activeTab),
      setRateSection: (rateSection) =>
        controllerActions.requestTransition({ type: 'setRateSection', rateSection }, rateSection !== workflowState.navigation.rateSection),
      setRateCategory: (rateCategory) =>
        controllerActions.requestTransition({ type: 'setRateCategory', rateCategory }, rateCategory !== workflowState.navigation.rateCategory),
      setFlagsSection: (flagsSection) =>
        controllerActions.requestTransition({ type: 'setFlagsSection', flagsSection }, flagsSection !== workflowState.navigation.flagsSection),
      setRoomDefaultsSection: (roomDefaultsSection) =>
        controllerActions.requestTransition(
          { type: 'setRoomDefaultsSection', roomDefaultsSection },
          roomDefaultsSection !== workflowState.navigation.roomDefaultsSection
        ),
      setStatusFilter: (statusFilter) =>
        controllerActions.requestTransition({ type: 'setStatusFilter', statusFilter }, statusFilter !== workflowState.navigation.statusFilter),
      setSearch: (search) => controllerActions.requestTransition({ type: 'setSearch', search }, search !== workflowState.navigation.search),
      setSelectedId: (selectedId) => controllerActions.requestTransition({ type: 'setSelectedId', selectedId }, selectedId !== workflowState.selectedId),
      setDraftActive: controllerActions.setDraftActive,
      reload: (keepId?: string) => controllerActions.requestTransition({ type: 'reload', keepId }, true),
      saveCurrent: controllerActions.saveCurrent,
      archiveOrReactivate: (nextActive) =>
        controllerActions.requestTransition({ type: 'archiveOrReactivate', nextActive }, true),
      startCreate: () => controllerActions.requestTransition({ type: 'startCreate' }, true),
      startDuplicate: () => controllerActions.requestTransition({ type: 'startDuplicate' }, true),
      cancelEdit: controllerActions.cancelEdit,
      confirmDiscard: controllerActions.confirmDiscard,
      cancelDiscard: controllerActions.cancelDiscard,
      updateDraftValue: controllerActions.updateDraftValue,
    } satisfies QuoteRatesActions,
    discardVm: pageVm.discardVm,
  }
}
