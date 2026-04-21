'use client'

import { useState } from 'react'
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_JOB_MINIMUM_ENABLED,
  DEFAULT_LABOR_DAY_POLICY_ENABLED,
  DEFAULT_LABOR_RATE,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from '@/lib/estimator/defaults'
import type {
  EstimateV2CatalogsPayload as CatalogsPayload,
  EstimateV2CustomerDraft as CustomerDraft,
  EstimateV2EstimateMeta as EstimateMeta,
  EstimateV2JobDefaultProducts as JobDefaultProducts,
  EstimateV2JobMeta as JobMeta,
  EstimateV2JobSettingsDraft as JobSettingsDraft,
  EstimateV2WallCalculationsPayload as WallCalculationsPayload,
} from '@/types/estimator/v2'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
} from './estimateV2EditorTypes'
import type { EstimateV2Error } from '@/lib/estimator/errors'

function createEmptyCatalogs(): CatalogsPayload['catalogs'] {
  return {
    paint_products: [],
    color_codes: [],
    production_rates: [],
    height_factors: [],
    room_types: [],
    room_flags: [],
    ceiling_types: [],
    trim_items: [],
  }
}

export function useEstimateV2EditorStore() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [estimate, setEstimate] = useState<EstimateMeta | null>(null)
  const [job, setJob] = useState<JobMeta | null>(null)
  const [catalogs, setCatalogs] = useState<CatalogsPayload['catalogs']>(createEmptyCatalogs)
  const [rooms, setRooms] = useState<EstimateV2EditorCollections['rooms']>([])
  const [scopes, setScopes] = useState<EstimateV2EditorCollections['scopes']>([])
  const [segments, setSegments] = useState<EstimateV2EditorCollections['segments']>([])
  const [roomFlags, setRoomFlags] = useState<EstimateV2EditorCollections['roomFlags']>([])
  const [ceilingScopes, setCeilingScopes] = useState<EstimateV2EditorCollections['ceilingScopes']>([])
  const [ceilingSegments, setCeilingSegments] = useState<EstimateV2EditorCollections['ceilingSegments']>([])
  const [trimScopes, setTrimScopes] = useState<EstimateV2EditorCollections['trimScopes']>([])
  const [wallCalculations, setWallCalculations] = useState<WallCalculationsPayload | null>(null)
  const [ceilingCalculations, setCeilingCalculations] = useState<EstimateV2EditorMetaState['ceilingCalculations']>(null)
  const [trimCalculations, setTrimCalculations] = useState<EstimateV2EditorMetaState['trimCalculations']>(null)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [error, setError] = useState<EstimateV2Error | null>(null)
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('')
  const [saveStatus, setSaveStatus] = useState<EstimateV2EditorMetaState['saveStatus']>('idle')
  const [autoSaveHint, setAutoSaveHint] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [jobDefaultsOpen, setJobDefaultsOpen] = useState(true)
  const [jobSettingsDraft, setJobSettingsDraft] = useState<JobSettingsDraft>({
    laborDayEnabled: DEFAULT_LABOR_DAY_POLICY_ENABLED,
    dayhours: DEFAULT_DAY_HOURS,
    roundingIncrementHours: DEFAULT_ROUNDING_INCREMENT_HOURS,
    laborRate: DEFAULT_LABOR_RATE,
    jobMinEnabled: DEFAULT_JOB_MINIMUM_ENABLED,
    jobMinAmount: DEFAULT_JOB_MINIMUM_AMOUNT,
    wallPaintProductId: '',
    wallPrimerProductId: '',
    ceilingPaintProductId: '',
    ceilingPrimerProductId: '',
    trimPaintProductId: '',
    trimPrimerProductId: '',
  })
  const [orgJobProductDefaults, setOrgJobProductDefaults] = useState<JobDefaultProducts>({
    wallPaintProductId: '',
    wallPrimerProductId: '',
    ceilingPaintProductId: '',
    ceilingPrimerProductId: '',
    trimPaintProductId: '',
    trimPrimerProductId: '',
  })
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({
    customerId: '',
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const [debugMeta, setDebugMeta] = useState<EstimateV2EditorMetaState['debugMeta']>({
    dirtySource: null,
    lastSaveTrigger: null,
    lastNormalizedDomains: [],
  })

  const collections: EstimateV2EditorCollections = {
    rooms,
    setRooms,
    scopes,
    setScopes,
    segments,
    setSegments,
    roomFlags,
    setRoomFlags,
    ceilingScopes,
    setCeilingScopes,
    ceilingSegments,
    setCeilingSegments,
    trimScopes,
    setTrimScopes,
  }

  const meta: EstimateV2EditorMetaState = {
    loading,
    setLoading,
    saving,
    setSaving,
    estimate,
    setEstimate,
    job,
    setJob,
    catalogs,
    setCatalogs,
    wallCalculations,
    setWallCalculations,
    ceilingCalculations,
    setCeilingCalculations,
    trimCalculations,
    setTrimCalculations,
    selectedRoomId,
    setSelectedRoomId,
    error,
    setError,
    validationIssues,
    setValidationIssues,
    lastSavedSnapshot,
    setLastSavedSnapshot,
    saveStatus,
    setSaveStatus,
    autoSaveHint,
    setAutoSaveHint,
    settingsOpen,
    setSettingsOpen,
    jobDefaultsOpen,
    setJobDefaultsOpen,
    jobSettingsDraft,
    setJobSettingsDraft,
    orgJobProductDefaults,
    setOrgJobProductDefaults,
    customerDraft,
    setCustomerDraft,
    debugMeta,
    setDebugMeta,
  }

  return {
    collections,
    meta,
    state: {
      loading,
      saving,
      estimate,
      job,
      catalogs,
      rooms,
      scopes,
      segments,
      roomFlags,
      ceilingScopes,
      ceilingSegments,
      trimScopes,
      selectedRoomId,
      error,
      validationIssues,
      saveStatus,
      settingsOpen,
      jobDefaultsOpen,
      jobSettingsDraft,
      orgJobProductDefaults,
      customerDraft,
      debugMeta,
    },
  }
}
