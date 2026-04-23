'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import { mutateRatesFlags } from '@/lib/quotes/client'
import {
  areRatesFlagsDraftSnapshotsEqual,
  createRatesFlagsDraftSnapshot,
  valueFromRatesFlagsRow,
} from '@/lib/quotes/ratesFlagsForm'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsCreateOrUpdateMutation,
  RatesFlagsDraft,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsRow,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'
import { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import {
  DEFAULT_QUOTE_RATES_NAVIGATION,
  getDefaultRateCategory,
  getFilteredRows,
  getNextSelectedId,
  resolveActiveCategory,
  type QuoteRatesNavigationState,
} from './quoteRatesPageController'
import { useQuoteRatesData } from './useQuoteRatesData'
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

type QuoteRatesEditorState = {
  selectedId: string
  isCreating: boolean
  draft: RatesFlagsDraft | null
  draftActive: boolean
  cleanSnapshot: ReturnType<typeof createRatesFlagsDraftSnapshot>
  cleanDraftActive: boolean
}

type QuoteRatesPendingTransition =
  | { type: 'setActiveTab'; activeTab: RatesFlagsTab }
  | { type: 'setRateSection'; rateSection: import('./quoteRatesPageConfig').RateSectionKey }
  | { type: 'setRateCategory'; rateCategory: string }
  | { type: 'setFlagsSection'; flagsSection: import('./quoteRatesPageConfig').FlagsSectionKey }
  | {
      type: 'setRoomDefaultsSection'
      roomDefaultsSection: import('./quoteRatesPageConfig').RoomDefaultsSectionKey
    }
  | { type: 'setStatusFilter'; statusFilter: import('./quoteRatesPageConfig').StatusFilter }
  | { type: 'setSearch'; search: string }
  | { type: 'setSelectedId'; selectedId: string }
  | { type: 'startCreate' }
  | { type: 'startDuplicate' }
  | { type: 'reload'; keepId?: string }
  | { type: 'archiveOrReactivate'; nextActive: boolean }

type QuoteRatesDiscardState = {
  status: 'idle' | 'confirming' | 'applying'
  pending: QuoteRatesPendingTransition | null
}

function emptyEditorState(): QuoteRatesEditorState {
  return {
    selectedId: '',
    isCreating: false,
    draft: null,
    draftActive: true,
    cleanSnapshot: createRatesFlagsDraftSnapshot(null),
    cleanDraftActive: true,
  }
}

function buildEditorStateFromSelection(args: {
  category: RatesFlagsCategory | null
  selectedId: string
}): QuoteRatesEditorState {
  if (!args.category || !args.selectedId) return emptyEditorState()

  const selectedRow = args.category.rows.find((row) => row.id === args.selectedId) ?? null
  if (!selectedRow) return emptyEditorState()

  const adapter = getRatesFlagsDraftAdapter(args.category.key as RatesFlagsEditableCategoryKey)
  const draft = adapter.rowToDraft(
    args.category as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
    selectedRow
  )

  return {
    selectedId: selectedRow.id,
    isCreating: false,
    draft,
    draftActive: selectedRow.active,
    cleanSnapshot: createRatesFlagsDraftSnapshot(draft),
    cleanDraftActive: selectedRow.active,
  }
}

export type QuoteRatesFiltersVm = {
  search: string
  statusFilter: import('./quoteRatesPageConfig').StatusFilter
  activeTab: RatesFlagsTab
  rateSection: import('./quoteRatesPageConfig').RateSectionKey
  rateCategory: import('@/types/estimator/ratesFlags').RatesFlagsCategoryKey
  flagsSection: import('./quoteRatesPageConfig').FlagsSectionKey
  roomDefaultsSection: import('./quoteRatesPageConfig').RoomDefaultsSectionKey
}

export type QuoteRatesTableVm = {
  activeCategory: RatesFlagsCategory | null
  filteredRows: RatesFlagsRow[]
  selectedRow: RatesFlagsRow | null
  selectedId: string
  isCreating: boolean
  canDuplicate: boolean
  canArchiveToggle: boolean
}

export type QuoteRatesEditorVm = {
  draft: RatesFlagsDraft | null
  draftActive: boolean
  isDirty: boolean
  saving: boolean
  activeCategory: RatesFlagsCategory | null
  selectedRow: RatesFlagsRow | null
  isCreating: boolean
  inlineValidation: string | null
  canSave: boolean
  formatDraftValue: (fieldKey: string) => string
}

export type QuoteRatesDiscardVm = {
  status: 'idle' | 'confirming' | 'applying'
  isOpen: boolean
  transitionType:
    | 'setActiveTab'
    | 'setRateSection'
    | 'setRateCategory'
    | 'setFlagsSection'
    | 'setRoomDefaultsSection'
    | 'setStatusFilter'
    | 'setSearch'
    | 'setSelectedId'
    | 'startCreate'
    | 'startDuplicate'
    | 'reload'
    | 'archiveOrReactivate'
    | null
}

export type QuoteRatesActions = {
  setActiveTab: (activeTab: RatesFlagsTab) => boolean | Promise<boolean>
  setRateSection: (
    rateSection: import('./quoteRatesPageConfig').RateSectionKey
  ) => boolean | Promise<boolean>
  setRateCategory: (rateCategory: string) => boolean | Promise<boolean>
  setFlagsSection: (
    flagsSection: import('./quoteRatesPageConfig').FlagsSectionKey
  ) => boolean | Promise<boolean>
  setRoomDefaultsSection: (
    roomDefaultsSection: import('./quoteRatesPageConfig').RoomDefaultsSectionKey
  ) => boolean | Promise<boolean>
  setStatusFilter: (
    statusFilter: import('./quoteRatesPageConfig').StatusFilter
  ) => boolean | Promise<boolean>
  setSearch: (search: string) => boolean | Promise<boolean>
  setSelectedId: (selectedId: string) => boolean | Promise<boolean>
  setDraftActive: (nextActive: boolean) => void
  reload: (keepId?: string) => Promise<boolean> | boolean
  saveCurrent: () => Promise<void>
  archiveOrReactivate: (nextActive: boolean) => Promise<boolean> | boolean
  startCreate: () => boolean | Promise<boolean>
  startDuplicate: () => boolean | Promise<boolean>
  cancelEdit: () => void
  confirmDiscard: () => Promise<boolean> | boolean
  cancelDiscard: () => void
  updateDraftValue: (fieldKey: string, rawInput: string) => void
}

export function useQuoteRatesPage() {
  const resource = useQuoteRatesData()
  const feedback = useDenseQuoteAdminFeedback()

  const [navigation, setNavigation] = useState<QuoteRatesNavigationState>(
    DEFAULT_QUOTE_RATES_NAVIGATION
  )
  const [editor, setEditor] = useState<QuoteRatesEditorState>(emptyEditorState)
  const [discard, setDiscard] = useState<QuoteRatesDiscardState>({
    status: 'idle',
    pending: null,
  })

  const pendingRefreshSelectionRef = useRef<string | undefined>(undefined)
  const forceRehydrateRef = useRef(false)

  const activeCategory = useMemo(
    () => resolveActiveCategory(resource.data, navigation),
    [navigation, resource.data]
  )

  const filteredRows = useMemo(
    () =>
      getFilteredRows(activeCategory, {
        search: navigation.search,
        statusFilter: navigation.statusFilter,
      }),
    [activeCategory, navigation.search, navigation.statusFilter]
  )

  const selectedRow = useMemo(() => {
    if (!activeCategory || !editor.selectedId) return null
    return activeCategory.rows.find((row) => row.id === editor.selectedId) ?? null
  }, [activeCategory, editor.selectedId])

  const adapter = useMemo(
    () =>
      activeCategory
        ? getRatesFlagsDraftAdapter(activeCategory.key as RatesFlagsEditableCategoryKey)
        : null,
    [activeCategory]
  )

  const validationResult =
    activeCategory && adapter && editor.draft
      ? adapter.validateDraft(
          activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
          editor.draft as never
        )
      : null
  const validationError = validationResult && !validationResult.ok ? validationResult.error : null
  const draftSnapshot = useMemo(() => createRatesFlagsDraftSnapshot(editor.draft), [editor.draft])
  const isDirty = useMemo(
    () =>
      !areRatesFlagsDraftSnapshotsEqual(draftSnapshot, editor.cleanSnapshot) ||
      editor.draftActive !== editor.cleanDraftActive,
    [draftSnapshot, editor.cleanDraftActive, editor.cleanSnapshot, editor.draftActive]
  )

  const isDirtyRef = useRef(isDirty)
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    const category = resolveActiveCategory(resource.data, navigation)
    const rows = getFilteredRows(category, {
      search: navigation.search,
      statusFilter: navigation.statusFilter,
    })
    const preferredId = pendingRefreshSelectionRef.current
    const force = forceRehydrateRef.current
    const nextSelectedId = getNextSelectedId(rows, preferredId ?? editor.selectedId)

    if (!(editor.isCreating && !force)) {
      if (!category || !nextSelectedId) {
        isDirtyRef.current = false
        setEditor(emptyEditorState())
      } else if (force || editor.selectedId !== nextSelectedId || !editor.draft) {
        isDirtyRef.current = false
        setEditor(buildEditorStateFromSelection({ category, selectedId: nextSelectedId }))
      }
    }

    pendingRefreshSelectionRef.current = undefined
    forceRehydrateRef.current = false
  }, [navigation, resource.data])

  function setNavigationAndSelection(nextNavigation: QuoteRatesNavigationState, preferredId?: string) {
    const nextCategory = resolveActiveCategory(resource.data, nextNavigation)
    const nextFilteredRows = getFilteredRows(nextCategory, {
      search: nextNavigation.search,
      statusFilter: nextNavigation.statusFilter,
    })
    const nextSelectedId = getNextSelectedId(nextFilteredRows, preferredId)

    setNavigation(nextNavigation)
    isDirtyRef.current = false
    setEditor(buildEditorStateFromSelection({ category: nextCategory, selectedId: nextSelectedId }))
  }

  function beginCreate() {
    if (!activeCategory || !adapter) return false
    const draft = adapter.createEmptyDraft(
      activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>
    )
    isDirtyRef.current = false
    setEditor({
      selectedId: '',
      isCreating: true,
      draft,
      draftActive: true,
      cleanSnapshot: createRatesFlagsDraftSnapshot(draft),
      cleanDraftActive: true,
    })
    feedback.clearFeedback()
    return true
  }

  function beginDuplicate() {
    if (!activeCategory || !adapter || !selectedRow) return false
    const duplicateDraft = adapter.withDuplicateId(
      adapter.rowToDraft(
        activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
        selectedRow
      ) as never,
      selectedRow.id
    )
    isDirtyRef.current = false
    setEditor({
      selectedId: '',
      isCreating: true,
      draft: duplicateDraft,
      draftActive: selectedRow.active,
      cleanSnapshot: createRatesFlagsDraftSnapshot(duplicateDraft),
      cleanDraftActive: selectedRow.active,
    })
    feedback.clearFeedback()
    return true
  }

  function cancelEdit() {
    isDirtyRef.current = false
    if (activeCategory && selectedRow) {
      setEditor(buildEditorStateFromSelection({ category: activeCategory, selectedId: selectedRow.id }))
    } else {
      setEditor(emptyEditorState())
    }
    setDiscard({ status: 'idle', pending: null })
    feedback.clearFeedback()
  }

  async function performReload(keepId?: string) {
    pendingRefreshSelectionRef.current = keepId ?? editor.selectedId ?? undefined
    forceRehydrateRef.current = true
    const ok = await resource.refresh()
    if (!ok) {
      pendingRefreshSelectionRef.current = undefined
      forceRehydrateRef.current = false
    }
    return ok
  }

  async function persistMutation(request: RatesFlagsCreateOrUpdateMutation | { action: 'archive' | 'reactivate'; category: RatesFlagsEditableCategoryKey; rowId: string }) {
    feedback.beginAction()
    try {
      await mutateRatesFlags(request as never)
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

  async function archiveToggle(nextActive: boolean) {
    if (!activeCategory || !selectedRow) return false
    const activeAdapter = getRatesFlagsDraftAdapter(
      activeCategory.key as RatesFlagsEditableCategoryKey
    )
    const request = activeAdapter.toArchiveRequest({
      action: nextActive ? 'reactivate' : 'archive',
      rowId: selectedRow.id,
    })
    const ok = await persistMutation(request)
    if (!ok) return false
    const reloaded = await performReload(selectedRow.id)
    if (!reloaded) return false
    feedback.setSuccessNotice(nextActive ? 'Reactivated row.' : 'Archived row.')
    return true
  }

  function applyTransition(intent: QuoteRatesPendingTransition) {
    switch (intent.type) {
      case 'setActiveTab':
        setNavigationAndSelection({
          ...navigation,
          activeTab: intent.activeTab,
        })
        return true
      case 'setRateSection': {
        const rateCategory = getDefaultRateCategory(intent.rateSection)
        setNavigationAndSelection({
          ...navigation,
          activeTab: 'rates',
          rateSection: intent.rateSection,
          rateCategory,
        })
        return true
      }
      case 'setRateCategory':
        setNavigationAndSelection({
          ...navigation,
          activeTab: 'rates',
          rateCategory: intent.rateCategory as QuoteRatesNavigationState['rateCategory'],
        })
        return true
      case 'setFlagsSection':
        setNavigationAndSelection({
          ...navigation,
          activeTab: 'flags',
          flagsSection: intent.flagsSection,
        })
        return true
      case 'setRoomDefaultsSection':
        setNavigationAndSelection({
          ...navigation,
          activeTab: 'room_defaults',
          roomDefaultsSection: intent.roomDefaultsSection,
        })
        return true
      case 'setStatusFilter':
        setNavigationAndSelection(
          {
            ...navigation,
            statusFilter: intent.statusFilter,
          },
          editor.selectedId
        )
        return true
      case 'setSearch':
        setNavigationAndSelection(
          {
            ...navigation,
            search: intent.search,
          },
          editor.selectedId
        )
        return true
      case 'setSelectedId':
        isDirtyRef.current = false
        setEditor(buildEditorStateFromSelection({ category: activeCategory, selectedId: intent.selectedId }))
        return true
      case 'startCreate':
        return beginCreate()
      case 'startDuplicate':
        return beginDuplicate()
      case 'reload':
        return performReload(intent.keepId)
      case 'archiveOrReactivate':
        return archiveToggle(intent.nextActive)
      default:
        return false
    }
  }

  function requestTransition(
    intent: QuoteRatesPendingTransition,
    changed: boolean
  ): boolean | Promise<boolean> {
    if (!changed) return true

    if (isDirtyRef.current) {
      setDiscard((current) =>
        current.pending
          ? current
          : {
              status: 'confirming',
              pending: intent,
            }
      )
      return false
    }

    return applyTransition(intent)
  }

  async function saveCurrent() {
    if (!activeCategory || !adapter || !editor.draft || !validationResult?.ok) return

    const request = adapter.toMutationRequest({
      action: editor.isCreating ? 'create' : 'update',
      draft: editor.draft as never,
      draftActive: editor.draftActive,
      originalId: editor.isCreating ? undefined : selectedRow?.id,
    }) as RatesFlagsCreateOrUpdateMutation
    const keepId =
      typeof editor.draft.id === 'string' && editor.draft.id ? editor.draft.id : editor.selectedId

    const ok = await persistMutation(request)
    if (!ok) return

    const reloaded = await performReload(keepId || undefined)
    if (!reloaded) return

    feedback.setSuccessNotice(`${editor.isCreating ? 'Created' : 'Saved'} ${activeCategory.label}.`)
  }

  async function confirmDiscard() {
    if (!discard.pending || discard.status === 'applying') return false

    setDiscard({
      status: 'applying',
      pending: discard.pending,
    })

    try {
      const result = await applyTransition(discard.pending)
      setDiscard({
        status: 'idle',
        pending: null,
      })
      return result
    } catch (error) {
      setDiscard({
        status: 'idle',
        pending: null,
      })
      throw error
    }
  }

  const hasData = resource.data.categories.length > 0 || (!resource.loading && !resource.error)
  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData,
    loadError: resource.error,
    actionError: feedback.actionError,
    validationError,
    notice: feedback.notice,
    canRetry: !resource.loading,
    canSave:
      Boolean(activeCategory) &&
      !feedback.saving &&
      !resource.error &&
      Boolean(validationResult?.ok),
    canArchiveToggle:
      Boolean(selectedRow) &&
      !editor.isCreating &&
      !feedback.saving &&
      !resource.loading &&
      !resource.error,
    canDuplicate: Boolean(selectedRow) && !feedback.saving && !resource.loading && !resource.error,
  })

  return {
    resource,
    valueFromRow: valueFromRatesFlagsRow,
    uiState,
    filtersVm: {
      search: navigation.search,
      statusFilter: navigation.statusFilter,
      activeTab: navigation.activeTab,
      rateSection: navigation.rateSection,
      rateCategory: navigation.rateCategory,
      flagsSection: navigation.flagsSection,
      roomDefaultsSection: navigation.roomDefaultsSection,
    } satisfies QuoteRatesFiltersVm,
    tableVm: {
      activeCategory,
      filteredRows,
      selectedRow,
      selectedId: editor.selectedId,
      isCreating: editor.isCreating,
      canDuplicate: uiState.canDuplicate,
      canArchiveToggle: uiState.canArchiveToggle,
    } satisfies QuoteRatesTableVm,
    editorVm: {
      draft: editor.draft,
      draftActive: editor.draftActive,
      isDirty,
      saving: feedback.saving,
      activeCategory,
      selectedRow,
      isCreating: editor.isCreating,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      formatDraftValue: activeCategory
        ? (fieldKey: string) =>
            editor.draft && adapter
              ? adapter.formatDraftValue(
                  activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
                  editor.draft as never,
                  fieldKey
                )
              : ''
        : () => '',
    } satisfies QuoteRatesEditorVm,
    actions: {
      setActiveTab: (activeTab) =>
        requestTransition({ type: 'setActiveTab', activeTab }, activeTab !== navigation.activeTab),
      setRateSection: (rateSection) =>
        requestTransition(
          { type: 'setRateSection', rateSection },
          rateSection !== navigation.rateSection
        ),
      setRateCategory: (rateCategory) =>
        requestTransition(
          { type: 'setRateCategory', rateCategory },
          rateCategory !== navigation.rateCategory
        ),
      setFlagsSection: (flagsSection) =>
        requestTransition(
          { type: 'setFlagsSection', flagsSection },
          flagsSection !== navigation.flagsSection
        ),
      setRoomDefaultsSection: (roomDefaultsSection) =>
        requestTransition(
          { type: 'setRoomDefaultsSection', roomDefaultsSection },
          roomDefaultsSection !== navigation.roomDefaultsSection
        ),
      setStatusFilter: (statusFilter) =>
        requestTransition(
          { type: 'setStatusFilter', statusFilter },
          statusFilter !== navigation.statusFilter
        ),
      setSearch: (search) =>
        requestTransition({ type: 'setSearch', search }, search !== navigation.search),
      setSelectedId: (selectedId) =>
        requestTransition({ type: 'setSelectedId', selectedId }, selectedId !== editor.selectedId),
      setDraftActive: (nextActive: boolean) => {
        isDirtyRef.current = true
        setEditor((current) => ({
          ...current,
          draftActive: nextActive,
        }))
      },
      reload: (keepId?: string) => requestTransition({ type: 'reload', keepId }, true),
      saveCurrent,
      archiveOrReactivate: (nextActive: boolean) =>
        requestTransition({ type: 'archiveOrReactivate', nextActive }, true),
      startCreate: () => requestTransition({ type: 'startCreate' }, true),
      startDuplicate: () => requestTransition({ type: 'startDuplicate' }, true),
      cancelEdit,
      confirmDiscard,
      cancelDiscard: () =>
        setDiscard({
          status: 'idle',
          pending: null,
        }),
      updateDraftValue: (fieldKey: string, rawInput: string) => {
        if (!activeCategory || !adapter) return
        isDirtyRef.current = true
        setEditor((current) => ({
          ...current,
          draft: current.draft
            ? adapter.updateDraftField(
                activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
                current.draft as never,
                fieldKey,
                rawInput
              )
            : current.draft,
        }))
      },
    } satisfies QuoteRatesActions,
    discardVm: {
      isOpen: discard.status === 'confirming' && Boolean(discard.pending),
      status: discard.status,
      transitionType: discard.pending?.type ?? null,
    } satisfies QuoteRatesDiscardVm,
  }
}
