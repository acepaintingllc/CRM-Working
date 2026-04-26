'use client'

import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { createStore } from 'zustand/vanilla'
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_JOB_MINIMUM_ENABLED,
  DEFAULT_LABOR_DAY_POLICY_ENABLED,
  DEFAULT_LABOR_RATE,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from '@/lib/estimator/defaults'
import type {
  EstimateV2CatalogsPayload,
  EstimateV2CustomerDraft,
  EstimateV2JobDefaultProducts,
  EstimateV2JobSettingsDraft,
} from '@/types/estimator/v2'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorDebugMeta,
  EstimateV2EditorMetaState,
  EstimateV2StateUpdater,
} from '@/app/crm/estimates/[id]/v2/_state/estimateV2EditorTypes'

type EstimateV2CollectionsState = Omit<
  EstimateV2EditorCollections,
  | 'rollers'
  | 'setRooms'
  | 'setScopes'
  | 'setSegments'
  | 'setRoomFlags'
  | 'setCeilingScopes'
  | 'setCeilingSegments'
  | 'setTrimScopes'
  | 'setRollers'
> & {
  rollers?: EstimateV2EditorCollections['rollers']
}

type EstimateV2MetaFields = Omit<
  EstimateV2EditorMetaState,
  | 'pricingSummary'
  | 'setLoading'
  | 'setSaving'
  | 'setEstimate'
  | 'setJob'
  | 'setCatalogs'
  | 'setWallCalculations'
  | 'setCeilingCalculations'
  | 'setTrimCalculations'
  | 'setPricingSummary'
  | 'setSelectedRoomId'
  | 'setError'
  | 'setValidationIssues'
  | 'setLastSavedSnapshot'
  | 'setSaveStatus'
  | 'setAutoSaveHint'
  | 'setSettingsOpen'
  | 'setJobDefaultsOpen'
  | 'setJobSettingsDraft'
  | 'setOrgJobProductDefaults'
  | 'setCustomerDraft'
  | 'setDebugMeta'
> & {
  pricingSummary?: EstimateV2EditorMetaState['pricingSummary']
}

export type EstimateV2EditorStoreState = {
  collections: EstimateV2CollectionsState
  meta: EstimateV2MetaFields
}

export type EstimateV2EditorViewState = EstimateV2CollectionsState &
  Pick<
    EstimateV2MetaFields,
    | 'loading'
    | 'saving'
    | 'estimate'
    | 'job'
    | 'catalogs'
    | 'selectedRoomId'
    | 'pricingSummary'
    | 'error'
    | 'validationIssues'
    | 'saveStatus'
    | 'settingsOpen'
    | 'jobDefaultsOpen'
    | 'jobSettingsDraft'
    | 'orgJobProductDefaults'
    | 'customerDraft'
    | 'debugMeta'
  >

export type EstimateV2EffectiveJobProductDefaults = EstimateV2JobDefaultProducts

type EstimateV2CollectionSetters = Pick<
  EstimateV2EditorCollections,
  | 'setRooms'
  | 'setScopes'
  | 'setSegments'
  | 'setRoomFlags'
  | 'setCeilingScopes'
  | 'setCeilingSegments'
  | 'setTrimScopes'
  | 'setRollers'
>

type EstimateV2MetaSetters = Pick<
  EstimateV2EditorMetaState,
  | 'setLoading'
  | 'setSaving'
  | 'setEstimate'
  | 'setJob'
  | 'setCatalogs'
  | 'setWallCalculations'
  | 'setCeilingCalculations'
  | 'setTrimCalculations'
  | 'setPricingSummary'
  | 'setSelectedRoomId'
  | 'setError'
  | 'setValidationIssues'
  | 'setLastSavedSnapshot'
  | 'setSaveStatus'
  | 'setAutoSaveHint'
  | 'setSettingsOpen'
  | 'setJobDefaultsOpen'
  | 'setJobSettingsDraft'
  | 'setOrgJobProductDefaults'
  | 'setCustomerDraft'
  | 'setDebugMeta'
>

export type EstimateV2EditorStoreActions = EstimateV2CollectionSetters &
  EstimateV2MetaSetters & {
    setCollections: (value: EstimateV2StateUpdater<EstimateV2CollectionsState>) => void
    setMeta: (value: EstimateV2StateUpdater<EstimateV2MetaFields>) => void
    reset: () => void
  }

export type EstimateV2EditorStore = EstimateV2EditorStoreState & EstimateV2EditorStoreActions
export type EstimateV2EditorStoreApi = ReturnType<typeof createEstimateV2Store>

function createEmptyCatalogs(): EstimateV2CatalogsPayload['catalogs'] {
  return {
    paint_products: [],
    color_codes: [],
    production_rates: [],
    height_factors: [],
    room_types: [],
    room_flags: [],
    ceiling_types: [],
    trim_items: [],
    condition_modifiers: [],
  }
}

function createDefaultJobSettingsDraft(): EstimateV2JobSettingsDraft {
  return {
    laborDayEnabled: DEFAULT_LABOR_DAY_POLICY_ENABLED,
    dayhours: DEFAULT_DAY_HOURS,
    roundingIncrementHours: DEFAULT_ROUNDING_INCREMENT_HOURS,
    laborRate: DEFAULT_LABOR_RATE,
    jobMinEnabled: DEFAULT_JOB_MINIMUM_ENABLED,
    jobMinAmount: DEFAULT_JOB_MINIMUM_AMOUNT,
    crewSize: 1,
    wallPaintProductId: '',
    wallPrimerProductId: '',
    ceilingPaintProductId: '',
    ceilingPrimerProductId: '',
    trimPaintProductId: '',
    trimPrimerProductId: '',
  }
}

function createDefaultOrgJobProductDefaults(): EstimateV2JobDefaultProducts {
  return {
    wallPaintProductId: '',
    wallPrimerProductId: '',
    ceilingPaintProductId: '',
    ceilingPrimerProductId: '',
    trimPaintProductId: '',
    trimPrimerProductId: '',
  }
}

function createDefaultCustomerDraft(): EstimateV2CustomerDraft {
  return {
    customerId: '',
    name: '',
    email: '',
    phone: '',
    address: '',
  }
}

function createDefaultDebugMeta(): EstimateV2EditorDebugMeta {
  return {
    dirtySource: null,
    lastSaveTrigger: null,
    lastNormalizedDomains: [],
  }
}

export function createEstimateV2EditorInitialState(): EstimateV2EditorStoreState {
  return {
    collections: {
      rooms: [],
      scopes: [],
      segments: [],
      roomFlags: [],
      ceilingScopes: [],
      ceilingSegments: [],
      trimScopes: [],
      rollers: [],
    },
    meta: {
      loading: true,
      saving: false,
      estimate: null,
      job: null,
      catalogs: createEmptyCatalogs(),
      wallCalculations: null,
      ceilingCalculations: null,
      trimCalculations: null,
      pricingSummary: null,
      selectedRoomId: '',
      error: null,
      validationIssues: [],
      lastSavedSnapshot: null,
      saveStatus: 'idle',
      autoSaveHint: null,
      settingsOpen: false,
      jobDefaultsOpen: true,
      jobSettingsDraft: createDefaultJobSettingsDraft(),
      orgJobProductDefaults: createDefaultOrgJobProductDefaults(),
      customerDraft: createDefaultCustomerDraft(),
      debugMeta: createDefaultDebugMeta(),
    },
  }
}

function resolveUpdater<T>(current: T, next: EstimateV2StateUpdater<T>) {
  return typeof next === 'function' ? (next as (prev: T) => T)(current) : next
}

export function createEstimateV2Store(initialState?: Partial<EstimateV2EditorStoreState>) {
  const defaults = createEstimateV2EditorInitialState()
  const initialCollections = {
    ...defaults.collections,
    ...initialState?.collections,
  }
  const initialMeta = {
    ...defaults.meta,
    ...initialState?.meta,
  }

  return createStore<EstimateV2EditorStore>()((set) => ({
    collections: initialCollections,
    meta: initialMeta,
    setCollections: (value) =>
      set((state) => ({
        collections: resolveUpdater(state.collections, value),
      })),
    setMeta: (value) =>
      set((state) => ({
        meta: resolveUpdater(state.meta, value),
      })),
    setRooms: (value) =>
      set((state) => ({
        collections: {
          ...state.collections,
          rooms: resolveUpdater(state.collections.rooms, value),
        },
      })),
    setScopes: (value) =>
      set((state) => ({
        collections: {
          ...state.collections,
          scopes: resolveUpdater(state.collections.scopes, value),
        },
      })),
    setSegments: (value) =>
      set((state) => ({
        collections: {
          ...state.collections,
          segments: resolveUpdater(state.collections.segments, value),
        },
      })),
    setRoomFlags: (value) =>
      set((state) => ({
        collections: {
          ...state.collections,
          roomFlags: resolveUpdater(state.collections.roomFlags, value),
        },
      })),
    setCeilingScopes: (value) =>
      set((state) => ({
        collections: {
          ...state.collections,
          ceilingScopes: resolveUpdater(state.collections.ceilingScopes, value),
        },
      })),
    setCeilingSegments: (value) =>
      set((state) => ({
        collections: {
          ...state.collections,
          ceilingSegments: resolveUpdater(state.collections.ceilingSegments, value),
        },
      })),
    setTrimScopes: (value) =>
      set((state) => ({
        collections: {
          ...state.collections,
          trimScopes: resolveUpdater(state.collections.trimScopes, value),
        },
      })),
    setRollers: (value) =>
      set((state) => ({
        collections: {
          ...state.collections,
          rollers: resolveUpdater(state.collections.rollers ?? [], value),
        },
      })),
    setLoading: (value) =>
      set((state) => ({
        meta: { ...state.meta, loading: resolveUpdater(state.meta.loading, value) },
      })),
    setSaving: (value) =>
      set((state) => ({
        meta: { ...state.meta, saving: resolveUpdater(state.meta.saving, value) },
      })),
    setEstimate: (value) =>
      set((state) => ({
        meta: { ...state.meta, estimate: resolveUpdater(state.meta.estimate, value) },
      })),
    setJob: (value) =>
      set((state) => ({
        meta: { ...state.meta, job: resolveUpdater(state.meta.job, value) },
      })),
    setCatalogs: (value) =>
      set((state) => ({
        meta: { ...state.meta, catalogs: resolveUpdater(state.meta.catalogs, value) },
      })),
    setWallCalculations: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          wallCalculations: resolveUpdater(state.meta.wallCalculations, value),
        },
      })),
    setCeilingCalculations: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          ceilingCalculations: resolveUpdater(state.meta.ceilingCalculations, value),
        },
      })),
    setTrimCalculations: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          trimCalculations: resolveUpdater(state.meta.trimCalculations, value),
        },
      })),
    setPricingSummary: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          pricingSummary: resolveUpdater(state.meta.pricingSummary ?? null, value),
        },
      })),
    setSelectedRoomId: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          selectedRoomId: resolveUpdater(state.meta.selectedRoomId, value),
        },
      })),
    setError: (value) =>
      set((state) => ({
        meta: { ...state.meta, error: resolveUpdater(state.meta.error, value) },
      })),
    setValidationIssues: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          validationIssues: resolveUpdater(state.meta.validationIssues, value),
        },
      })),
    setLastSavedSnapshot: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          lastSavedSnapshot: resolveUpdater(state.meta.lastSavedSnapshot, value),
        },
      })),
    setSaveStatus: (value) =>
      set((state) => ({
        meta: { ...state.meta, saveStatus: resolveUpdater(state.meta.saveStatus, value) },
      })),
    setAutoSaveHint: (value) =>
      set((state) => ({
        meta: { ...state.meta, autoSaveHint: resolveUpdater(state.meta.autoSaveHint, value) },
      })),
    setSettingsOpen: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          settingsOpen: resolveUpdater(state.meta.settingsOpen, value),
        },
      })),
    setJobDefaultsOpen: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          jobDefaultsOpen: resolveUpdater(state.meta.jobDefaultsOpen, value),
        },
      })),
    setJobSettingsDraft: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          jobSettingsDraft: resolveUpdater(state.meta.jobSettingsDraft, value),
        },
      })),
    setOrgJobProductDefaults: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          orgJobProductDefaults: resolveUpdater(state.meta.orgJobProductDefaults, value),
        },
      })),
    setCustomerDraft: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          customerDraft: resolveUpdater(state.meta.customerDraft, value),
        },
      })),
    setDebugMeta: (value) =>
      set((state) => ({
        meta: {
          ...state.meta,
          debugMeta: resolveUpdater(state.meta.debugMeta, value),
        },
      })),
    reset: () => ({
      ...createEstimateV2EditorInitialState(),
    }),
  }))
}

export function useEstimateV2Store<T>(
  store: EstimateV2EditorStoreApi,
  selector: (state: EstimateV2EditorStore) => T
) {
  return useStore(store, useShallow(selector))
}

function selectViewState(state: EstimateV2EditorStore): EstimateV2EditorViewState {
  return {
    ...state.collections,
    loading: state.meta.loading,
    saving: state.meta.saving,
    estimate: state.meta.estimate,
    job: state.meta.job,
    catalogs: state.meta.catalogs,
    selectedRoomId: state.meta.selectedRoomId,
    error: state.meta.error,
    validationIssues: state.meta.validationIssues,
    pricingSummary: state.meta.pricingSummary ?? null,
    saveStatus: state.meta.saveStatus,
    settingsOpen: state.meta.settingsOpen,
    jobDefaultsOpen: state.meta.jobDefaultsOpen,
    jobSettingsDraft: state.meta.jobSettingsDraft,
    orgJobProductDefaults: state.meta.orgJobProductDefaults,
    customerDraft: state.meta.customerDraft,
    debugMeta: state.meta.debugMeta,
  }
}

function selectCollectionsWithSetters(state: EstimateV2EditorStore): EstimateV2EditorCollections {
  return {
    rooms: state.collections.rooms,
    setRooms: state.setRooms,
    scopes: state.collections.scopes,
    setScopes: state.setScopes,
    segments: state.collections.segments,
    setSegments: state.setSegments,
    roomFlags: state.collections.roomFlags,
    setRoomFlags: state.setRoomFlags,
    ceilingScopes: state.collections.ceilingScopes,
    setCeilingScopes: state.setCeilingScopes,
    ceilingSegments: state.collections.ceilingSegments,
    setCeilingSegments: state.setCeilingSegments,
    trimScopes: state.collections.trimScopes,
    setTrimScopes: state.setTrimScopes,
    rollers: state.collections.rollers ?? [],
    setRollers: state.setRollers,
  }
}

function selectMetaWithSetters(state: EstimateV2EditorStore): EstimateV2EditorMetaState {
  return {
    loading: state.meta.loading,
    setLoading: state.setLoading,
    saving: state.meta.saving,
    setSaving: state.setSaving,
    estimate: state.meta.estimate,
    setEstimate: state.setEstimate,
    job: state.meta.job,
    setJob: state.setJob,
    catalogs: state.meta.catalogs,
    setCatalogs: state.setCatalogs,
    wallCalculations: state.meta.wallCalculations,
    setWallCalculations: state.setWallCalculations,
    ceilingCalculations: state.meta.ceilingCalculations,
    setCeilingCalculations: state.setCeilingCalculations,
    trimCalculations: state.meta.trimCalculations,
    setTrimCalculations: state.setTrimCalculations,
    pricingSummary: state.meta.pricingSummary ?? null,
    setPricingSummary: state.setPricingSummary,
    selectedRoomId: state.meta.selectedRoomId,
    setSelectedRoomId: state.setSelectedRoomId,
    error: state.meta.error,
    setError: state.setError,
    validationIssues: state.meta.validationIssues,
    setValidationIssues: state.setValidationIssues,
    lastSavedSnapshot: state.meta.lastSavedSnapshot,
    setLastSavedSnapshot: state.setLastSavedSnapshot,
    saveStatus: state.meta.saveStatus,
    setSaveStatus: state.setSaveStatus,
    autoSaveHint: state.meta.autoSaveHint,
    setAutoSaveHint: state.setAutoSaveHint,
    settingsOpen: state.meta.settingsOpen,
    setSettingsOpen: state.setSettingsOpen,
    jobDefaultsOpen: state.meta.jobDefaultsOpen,
    setJobDefaultsOpen: state.setJobDefaultsOpen,
    jobSettingsDraft: state.meta.jobSettingsDraft,
    setJobSettingsDraft: state.setJobSettingsDraft,
    orgJobProductDefaults: state.meta.orgJobProductDefaults,
    setOrgJobProductDefaults: state.setOrgJobProductDefaults,
    customerDraft: state.meta.customerDraft,
    setCustomerDraft: state.setCustomerDraft,
    debugMeta: state.meta.debugMeta,
    setDebugMeta: state.setDebugMeta,
  }
}

function selectEffectiveJobProductDefaults(
  state: EstimateV2EditorStore
): EstimateV2EffectiveJobProductDefaults {
  return {
    wallPaintProductId:
      state.meta.jobSettingsDraft.wallPaintProductId ||
      state.meta.orgJobProductDefaults.wallPaintProductId,
    wallPrimerProductId:
      state.meta.jobSettingsDraft.wallPrimerProductId ||
      state.meta.orgJobProductDefaults.wallPrimerProductId,
    ceilingPaintProductId:
      state.meta.jobSettingsDraft.ceilingPaintProductId ||
      state.meta.orgJobProductDefaults.ceilingPaintProductId,
    ceilingPrimerProductId:
      state.meta.jobSettingsDraft.ceilingPrimerProductId ||
      state.meta.orgJobProductDefaults.ceilingPrimerProductId,
    trimPaintProductId:
      state.meta.jobSettingsDraft.trimPaintProductId ||
      state.meta.orgJobProductDefaults.trimPaintProductId,
    trimPrimerProductId:
      state.meta.jobSettingsDraft.trimPrimerProductId ||
      state.meta.orgJobProductDefaults.trimPrimerProductId,
  }
}

export const estimateV2StoreSelectors = {
  collections: selectCollectionsWithSetters,
  meta: selectMetaWithSetters,
  viewState: selectViewState,
  effectiveJobProductDefaults: selectEffectiveJobProductDefaults,
  loading: (state: EstimateV2EditorStore) => state.meta.loading,
  lastSavedSnapshot: (state: EstimateV2EditorStore) => state.meta.lastSavedSnapshot,
}
