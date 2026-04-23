'use client'

import { createRatesFlagsDraftSnapshot } from '@/lib/quotes/ratesFlagsForm'
import type { RatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsDraft,
  RatesFlagsDraftValidationResult,
  RatesFlagsEditableCategoryKey,
  RatesFlagsRow,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'
import type {
  FlagsSectionKey,
  RateSectionKey,
  RoomDefaultsSectionKey,
  StatusFilter,
} from './quoteRatesPageConfig'
import { RATE_SUBGROUPS } from './quoteRatesPageConfig'

export type QuoteRatesNavigationState = {
  activeTab: RatesFlagsTab
  rateSection: RateSectionKey
  rateCategory: RatesFlagsCategoryKey
  flagsSection: FlagsSectionKey
  roomDefaultsSection: RoomDefaultsSectionKey
  statusFilter: StatusFilter
  search: string
}

export type QuoteRatesPendingTransition =
  | { type: 'setActiveTab'; activeTab: RatesFlagsTab }
  | { type: 'setRateSection'; rateSection: RateSectionKey }
  | { type: 'setRateCategory'; rateCategory: string }
  | { type: 'setFlagsSection'; flagsSection: FlagsSectionKey }
  | { type: 'setRoomDefaultsSection'; roomDefaultsSection: RoomDefaultsSectionKey }
  | { type: 'setStatusFilter'; statusFilter: StatusFilter }
  | { type: 'setSearch'; search: string }
  | { type: 'setSelectedId'; selectedId: string }
  | { type: 'startCreate' }
  | { type: 'startDuplicate' }
  | { type: 'reload'; keepId?: string }
  | { type: 'archiveOrReactivate'; nextActive: boolean }

export type QuoteRatesActionStatus = 'idle' | 'saving' | 'reloading' | 'archiving'
export type QuoteRatesEditorMode = 'selection' | 'create'
export type QuoteRatesDiscardStatus = 'idle' | 'confirming' | 'applying'
export type QuoteRatesDraftSnapshot = ReturnType<typeof createRatesFlagsDraftSnapshot>

export type QuoteRatesEditorSnapshot = {
  selectedId: string
  editorMode: QuoteRatesEditorMode
  draft: RatesFlagsDraft | null
  draftActive: boolean
  cleanSnapshot: QuoteRatesDraftSnapshot
  cleanDraftActive: boolean
}

export type QuoteRatesWorkflowState = {
  navigation: QuoteRatesNavigationState
  selectedId: string
  editorMode: QuoteRatesEditorMode
  draft: RatesFlagsDraft | null
  draftActive: boolean
  cleanSnapshot: QuoteRatesDraftSnapshot
  cleanDraftActive: boolean
  pendingTransition: QuoteRatesPendingTransition | null
  discardStatus: QuoteRatesDiscardStatus
  actionStatus: QuoteRatesActionStatus
  notice: string | null
  noticeTone: 'success' | 'warning' | null
  actionError: string | null
  refreshSelectionId: string | null
  forceRefreshRehydrate: boolean
}

export type QuoteRatesControllerAction =
  | {
      type: 'applyNavigation'
      navigation: QuoteRatesNavigationState
      selectedId: string
      editor: QuoteRatesEditorSnapshot
    }
  | { type: 'selectRow'; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | { type: 'startCreate'; draft: RatesFlagsDraft }
  | { type: 'startDuplicate'; draft: RatesFlagsDraft; draftActive: boolean }
  | { type: 'cancelEdit'; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | { type: 'discardCurrentChanges'; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | { type: 'setDraft'; draft: RatesFlagsDraft }
  | { type: 'setDraftActive'; draftActive: boolean }
  | { type: 'openDiscard'; intent: QuoteRatesPendingTransition }
  | { type: 'setDiscardStatus'; status: QuoteRatesDiscardStatus }
  | { type: 'clearDiscard' }
  | { type: 'beginAction'; status: QuoteRatesActionStatus }
  | { type: 'finishAction' }
  | { type: 'setNotice'; notice: string | null; tone?: 'success' | 'warning' | null }
  | { type: 'setActionError'; error: string | null }
  | { type: 'clearFeedback' }
  | { type: 'scheduleRefreshRehydrate'; selectedId: string | null; force: boolean }
  | { type: 'clearRefreshRehydrate' }
  | { type: 'commitMutation'; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | {
      type: 'reconcileFromResource'
      editor: QuoteRatesEditorSnapshot
      selectedId: string
      preserveCreateDraft: boolean
    }

const emptyDraftSnapshot = createRatesFlagsDraftSnapshot(null)

export const DEFAULT_QUOTE_RATES_NAVIGATION: QuoteRatesNavigationState = {
  activeTab: 'rates',
  rateSection: 'production',
  rateCategory: 'production_rates_walls',
  flagsSection: 'condition_modifiers',
  roomDefaultsSection: 'room_types',
  statusFilter: 'active',
  search: '',
}

export function getDefaultRateCategory(rateSection: RateSectionKey): RatesFlagsCategoryKey {
  return RATE_SUBGROUPS[rateSection][0]?.key ?? 'production_rates_walls'
}

export function emptyQuoteRatesEditorSnapshot(): QuoteRatesEditorSnapshot {
  return {
    selectedId: '',
    editorMode: 'selection',
    draft: null,
    draftActive: true,
    cleanSnapshot: emptyDraftSnapshot,
    cleanDraftActive: true,
  }
}

export function createInitialQuoteRatesWorkflowState(): QuoteRatesWorkflowState {
  return {
    navigation: DEFAULT_QUOTE_RATES_NAVIGATION,
    ...emptyQuoteRatesEditorSnapshot(),
    pendingTransition: null,
    discardStatus: 'idle',
    actionStatus: 'idle',
    notice: null,
    noticeTone: null,
    actionError: null,
    refreshSelectionId: null,
    forceRefreshRehydrate: false,
  }
}

function applyEditorSnapshot(
  state: QuoteRatesWorkflowState,
  action: { selectedId: string; editor: QuoteRatesEditorSnapshot }
) {
  return {
    ...state,
    selectedId: action.selectedId,
    editorMode: action.editor.editorMode,
    draft: action.editor.draft,
    draftActive: action.editor.draftActive,
    cleanSnapshot: action.editor.cleanSnapshot,
    cleanDraftActive: action.editor.cleanDraftActive,
  }
}

export function quoteRatesPageReducer(
  state: QuoteRatesWorkflowState,
  action: QuoteRatesControllerAction
): QuoteRatesWorkflowState {
  switch (action.type) {
    case 'applyNavigation':
      return {
        ...applyEditorSnapshot(state, action),
        navigation: action.navigation,
      }
    case 'selectRow':
    case 'cancelEdit':
    case 'discardCurrentChanges':
    case 'commitMutation':
      return applyEditorSnapshot(state, action)
    case 'startCreate':
      return {
        ...state,
        selectedId: '',
        editorMode: 'create',
        draft: action.draft,
        draftActive: true,
        cleanSnapshot: createRatesFlagsDraftSnapshot(action.draft),
        cleanDraftActive: true,
        notice: null,
        actionError: null,
      }
    case 'startDuplicate':
      return {
        ...state,
        selectedId: '',
        editorMode: 'create',
        draft: action.draft,
        draftActive: action.draftActive,
        cleanSnapshot: createRatesFlagsDraftSnapshot(action.draft),
        cleanDraftActive: action.draftActive,
        notice: null,
        actionError: null,
      }
    case 'setDraft':
      return {
        ...state,
        draft: action.draft,
      }
    case 'setDraftActive':
      return {
        ...state,
        draftActive: action.draftActive,
      }
    case 'openDiscard':
      return state.pendingTransition
        ? state
        : {
            ...state,
            pendingTransition: action.intent,
            discardStatus: 'confirming',
          }
    case 'setDiscardStatus':
      return {
        ...state,
        discardStatus: action.status,
      }
    case 'clearDiscard':
      return {
        ...state,
        pendingTransition: null,
        discardStatus: 'idle',
      }
    case 'beginAction':
      return {
        ...state,
        actionStatus: action.status,
        notice: null,
        noticeTone: null,
        actionError: null,
      }
    case 'finishAction':
      return {
        ...state,
        actionStatus: 'idle',
      }
    case 'setNotice':
      return {
        ...state,
        notice: action.notice,
        noticeTone: action.tone ?? null,
        actionError: null,
      }
    case 'setActionError':
      return {
        ...state,
        actionError: action.error,
        notice: null,
        noticeTone: null,
      }
    case 'clearFeedback':
      return {
        ...state,
        notice: null,
        noticeTone: null,
        actionError: null,
      }
    case 'scheduleRefreshRehydrate':
      return {
        ...state,
        refreshSelectionId: action.selectedId,
        forceRefreshRehydrate: action.force,
      }
    case 'clearRefreshRehydrate':
      return {
        ...state,
        refreshSelectionId: null,
        forceRefreshRehydrate: false,
      }
    case 'reconcileFromResource':
      if (action.preserveCreateDraft) {
        return {
          ...state,
          refreshSelectionId: null,
          forceRefreshRehydrate: false,
        }
      }
      return {
        ...applyEditorSnapshot(state, action),
        refreshSelectionId: null,
        forceRefreshRehydrate: false,
      }
    default:
      return state
  }
}

export function transitionNeedsDiscardReset(intent: QuoteRatesPendingTransition) {
  return intent.type === 'reload' || intent.type === 'archiveOrReactivate'
}

export type QuoteRatesDerivedState = {
  activeCategory: RatesFlagsCategory | null
  filteredRows: RatesFlagsRow[]
  selectedRow: RatesFlagsRow | null
  adapter: RatesFlagsDraftAdapter<RatesFlagsEditableCategoryKey> | null
  validationResult: RatesFlagsDraftValidationResult | null
  validationError: string | null
  isDirty: boolean
}
