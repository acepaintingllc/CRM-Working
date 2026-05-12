'use client'

import {
  areRatesFlagsDraftSnapshotsEqual,
  createRatesFlagsDraftSnapshot,
} from '@/lib/quotes/ratesFlagsForm'
import type { RatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsDraft,
  RatesFlagsDraftValidationResult,
  RatesFlagsEditableCategoryKey,
  RatesFlagsEditableCategory,
  RatesFlagsMutationRequest,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import type {
  FlagsSectionKey,
  QuoteRatesTopTab,
  RateSectionKey,
  RoomDefaultsSectionKey,
  StatusFilter,
} from './quoteRatesPageConfig'
import { RATE_SUBGROUPS } from './quoteRatesPageConfig'

export type QuoteRatesNavigationState = {
  activeTab: QuoteRatesTopTab
  rateSection: RateSectionKey
  rateCategory: RatesFlagsCategoryKey
  flagsSection: FlagsSectionKey
  roomDefaultsSection: RoomDefaultsSectionKey
  statusFilter: StatusFilter
  search: string
}

export type QuoteRatesPendingTransition =
  | { type: 'setActiveTab'; activeTab: QuoteRatesTopTab }
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
  | { type: 'activateDraft' }
  | { type: 'leavePage'; href: string }

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
  pendingMutations: RatesFlagsMutationRequest[]
}

export type QuoteRatesControllerAction =
  | {
      type: 'editorApplied'
      selectedId: string
      editor: QuoteRatesEditorSnapshot
      navigation?: QuoteRatesNavigationState
    }
  | { type: 'createStarted'; draft: RatesFlagsDraft; draftActive?: boolean }
  | { type: 'draftChanged'; draft?: RatesFlagsDraft; draftActive?: boolean }
  | {
      type: 'discardChanged'
      status: QuoteRatesDiscardStatus
      intent?: QuoteRatesPendingTransition | null
    }
  | { type: 'mutationChanged'; status: QuoteRatesActionStatus; error?: string | null }
  | { type: 'feedbackChanged'; notice: string | null; tone?: 'success' | 'warning' | null }
  | { type: 'refreshRehydrateChanged'; selectedId: string | null; force: boolean }
  | { type: 'pendingMutationsChanged'; mutations: RatesFlagsMutationRequest[] }
  | {
      type: 'resourceReconciled'
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
  const key = RATE_SUBGROUPS[rateSection][0]?.key
  if (key == null) {
    throw new Error(`No subgroups configured for rate section: ${rateSection}`)
  }
  return key
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
    pendingMutations: [],
  }
}

export function getQuoteRatesHasUnsavedChanges(state: QuoteRatesWorkflowState) {
  const draftSnapshot = createRatesFlagsDraftSnapshot(state.draft)
  return (
    state.pendingMutations.length > 0 ||
    !areRatesFlagsDraftSnapshotsEqual(draftSnapshot, state.cleanSnapshot) ||
    state.draftActive !== state.cleanDraftActive
  )
}

export function getQuoteRatesHasEditorChanges(state: QuoteRatesWorkflowState) {
  const draftSnapshot = createRatesFlagsDraftSnapshot(state.draft)
  return (
    !areRatesFlagsDraftSnapshotsEqual(draftSnapshot, state.cleanSnapshot) ||
    state.draftActive !== state.cleanDraftActive
  )
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
    case 'editorApplied':
      return {
        ...applyEditorSnapshot(state, action),
        navigation: action.navigation ?? state.navigation,
      }
    case 'createStarted':
      return {
        ...state,
        selectedId: '',
        editorMode: 'create',
        draft: action.draft,
        draftActive: action.draftActive ?? true,
        cleanSnapshot: createRatesFlagsDraftSnapshot(action.draft),
        cleanDraftActive: action.draftActive ?? true,
        notice: null,
        actionError: null,
      }
    case 'draftChanged':
      return {
        ...state,
        draft: action.draft ?? state.draft,
        draftActive: action.draftActive ?? state.draftActive,
      }
    case 'discardChanged':
      if (action.status === 'confirming') {
        return state.pendingTransition
          ? state
          : {
              ...state,
              pendingTransition: action.intent ?? null,
              discardStatus: action.status,
            }
      }
      return {
        ...state,
        discardStatus: action.status,
        pendingTransition:
          action.status === 'idle' ? null : (action.intent ?? state.pendingTransition),
      }
    case 'mutationChanged':
      return {
        ...state,
        actionStatus: action.status,
        notice: action.status === 'idle' ? (action.error ? null : state.notice) : null,
        noticeTone: action.status === 'idle' ? (action.error ? null : state.noticeTone) : null,
        actionError: action.status === 'idle' ? (action.error ?? null) : null,
      }
    case 'feedbackChanged':
      return {
        ...state,
        notice: action.notice,
        noticeTone: action.tone ?? null,
        actionError: null,
      }
    case 'refreshRehydrateChanged':
      return {
        ...state,
        refreshSelectionId: action.selectedId,
        forceRefreshRehydrate: action.force,
      }
    case 'pendingMutationsChanged':
      return {
        ...state,
        pendingMutations: action.mutations,
      }
    case 'resourceReconciled':
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
  return (
    intent.type === 'reload' ||
    intent.type === 'archiveOrReactivate' ||
    intent.type === 'activateDraft'
  )
}

export type QuoteRatesDerivedState = {
  activeCategory: RatesFlagsCategory | null
  editableActiveCategory: RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey> | null
  filteredRows: RatesFlagsRow[]
  selectedRow: RatesFlagsRow | null
  adapter: RatesFlagsDraftAdapter<RatesFlagsEditableCategoryKey> | null
  validationResult: RatesFlagsDraftValidationResult | null
  validationError: string | null
  isDirty: boolean
}
