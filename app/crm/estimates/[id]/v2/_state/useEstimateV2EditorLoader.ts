'use client'

import { useEffect, useEffectEvent } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { createEstimateV2Error } from '@/lib/estimator/errors'
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_JOB_MINIMUM_ENABLED,
  DEFAULT_LABOR_DAY_POLICY_ENABLED,
  DEFAULT_LABOR_RATE,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from '@/lib/estimator/defaults'
import { buildEstimateV2SavePayload, sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { asText } from '@/lib/estimator/parsing'
import { sanitizeV2WallsDrafts } from '@/lib/estimator/v2WallsSanitize'
import { sanitizeV2CeilingsDrafts } from '@/lib/estimator/v2CeilingsSanitize'
import { sanitizeV2TrimDrafts } from '@/lib/estimator/v2TrimSanitize'
import { inferTrimUnitTypeFromText } from '../_lib/estimateV2EditorNormalize'
import { recalculateEditorDraftFactors } from '../_lib/estimateV2EditorRecalculate'
import {
  normalizeCeilingScope,
  normalizeCeilingSegment,
  normalizeRoom,
  normalizeRoomFlag,
  normalizeScope,
  normalizeSegment,
  normalizeTrimScope,
} from '../_lib/estimateV2EditorNormalize'
import type {
  EstimateV2CatalogsPayload as CatalogsPayload,
  EstimateV2GetResponse as EstimateResponse,
  EstimateV2JobSettingsDraft as JobSettingsDraft,
  EstimateV2RoomFlagDraft as RoomFlagDraft,
  EstimateV2TrimTypeOption,
} from '@/types/estimator/v2'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
  Unsafe,
} from './estimateV2EditorTypes'

function buildJobSettingsDraft(
  jobsettings: Unsafe | null,
  orgDefaults: Unsafe | null,
  overrides: {
    wallPaintOverride: string
    wallPrimerOverride: string
    ceilingPaintOverride: string
    ceilingPrimerOverride: string
    trimPaintOverride: string
    trimPrimerOverride: string
  }
) {
  return {
    laborDayEnabled:
      typeof jobsettings?.labor_day_policy_enabled === 'boolean'
        ? jobsettings.labor_day_policy_enabled
        : typeof orgDefaults?.labor_day_policy_enabled === 'boolean'
          ? orgDefaults.labor_day_policy_enabled
          : DEFAULT_LABOR_DAY_POLICY_ENABLED,
    dayhours: Number(jobsettings?.dayhours ?? orgDefaults?.dayhours ?? DEFAULT_DAY_HOURS),
    roundingIncrementHours: Number(
      jobsettings?.rounding_increment_hours ??
        orgDefaults?.rounding_increment_hours ??
        DEFAULT_ROUNDING_INCREMENT_HOURS
    ),
    laborRate: Number(
      jobsettings?.override_labor_rate ?? orgDefaults?.override_labor_rate ?? DEFAULT_LABOR_RATE
    ),
    jobMinEnabled:
      typeof jobsettings?.job_minimum_enabled === 'boolean'
        ? jobsettings.job_minimum_enabled
        : typeof orgDefaults?.job_minimum_enabled === 'boolean'
          ? orgDefaults.job_minimum_enabled
          : DEFAULT_JOB_MINIMUM_ENABLED,
    jobMinAmount: Number(
      jobsettings?.job_minimum_amount ??
        orgDefaults?.job_minimum_amount ??
        DEFAULT_JOB_MINIMUM_AMOUNT
    ),
    wallPaintProductId: overrides.wallPaintOverride,
    wallPrimerProductId: overrides.wallPrimerOverride,
    ceilingPaintProductId: overrides.ceilingPaintOverride,
    ceilingPrimerProductId: overrides.ceilingPrimerOverride,
    trimPaintProductId: overrides.trimPaintOverride,
    trimPrimerProductId: overrides.trimPrimerOverride,
  } satisfies JobSettingsDraft
}

export function useEstimateV2EditorLoader(params: {
  estimateId?: string
  collections: EstimateV2EditorCollections
  meta: EstimateV2EditorMetaState
}) {
  const { estimateId, collections, meta } = params

  const loadWorkspace = useEffectEvent(async (activeRef: { current: boolean }) => {
    try {
      meta.setLoading(true)
      meta.setError(null)
      meta.setValidationIssues([])

      const [estimateRes, catalogsRes] = await Promise.all([
        authedFetch(`/api/quotes/${estimateId}`, { cache: 'no-store' }),
        authedFetch(`/api/quotes/${estimateId}/catalogs?v2=1`, { cache: 'no-store' }),
      ])

      const estimatePayload = (await estimateRes.json().catch(() => null)) as
        | EstimateResponse
        | { error?: string }
        | null
      const catalogsPayload = (await catalogsRes.json().catch(() => null)) as
        | CatalogsPayload
        | { error?: string }
        | null

      if (!activeRef.current) return

      if (!estimateRes.ok || !estimatePayload || !('estimate' in estimatePayload)) {
        const message =
          (estimatePayload as { error?: string } | null)?.error ?? estimateRes.statusText
        console.error('Estimate V2 editor load failed', {
          estimateId,
          operation: 'loadEstimate',
          status: estimateRes.status,
          message,
        })
        meta.setError(createEstimateV2Error(message, { retryable: true }))
        meta.setLoading(false)
        return
      }

      meta.setEstimate(estimatePayload.estimate)

      const nextCatalogs =
        catalogsRes.ok && catalogsPayload && 'catalogs' in catalogsPayload
          ? {
              ...meta.catalogs,
              ...catalogsPayload.catalogs,
              production_rates:
                catalogsPayload.catalogs.production_rates ?? meta.catalogs.production_rates,
            }
          : meta.catalogs
      const nextTrimTypeOptions: EstimateV2TrimTypeOption[] = (
        nextCatalogs.production_rates ?? []
      )
        .filter((option) => asText(option?.scope_id).toUpperCase() === 'TRIM')
        .map((rate) => ({
          id: rate.id,
          label: rate.label || rate.id,
          family: rate.surface_type || null,
          category: rate.condition || rate.surface_type || null,
          unit_type: inferTrimUnitTypeFromText(
            `${rate.id} ${rate.label} ${rate.surface_type} ${rate.condition}`
          ),
          helper_allowed: false,
          default_production_rate_id: rate.id,
        }))
      meta.setCatalogs(nextCatalogs)
      if (!catalogsRes.ok) {
        const message =
          (catalogsPayload as { error?: string } | null)?.error ?? catalogsRes.statusText
        console.error('Estimate V2 editor catalogs load failed', {
          estimateId,
          operation: 'loadCatalogs',
          status: catalogsRes.status,
          message,
        })
        meta.setError(createEstimateV2Error(message, { retryable: true }))
      }

      const jobRes = await authedFetch(`/api/jobs/${estimatePayload.estimate.job_id}`, {
        cache: 'no-store',
      })
      const jobPayload = (await jobRes.json().catch(() => null)) as
        | { job?: typeof meta.job }
        | { error?: string }
        | null
      if (!activeRef.current) return
      if (jobRes.ok && jobPayload && 'job' in jobPayload && jobPayload.job) {
        meta.setJob(jobPayload.job)
        meta.setCustomerDraft({
          customerId: jobPayload.job.customer_id ?? '',
          name: jobPayload.job.customer_name ?? '',
          email: jobPayload.job.customer_email ?? '',
          phone: jobPayload.job.customer_phone ?? '',
          address: jobPayload.job.customer_address ?? '',
        })
      }

      const js = estimatePayload.inputs?.jobsettings ?? null
      const orgDefaults = (estimatePayload.inputs?.org_defaults ?? null) as Unsafe | null
      const orgWallDefault = asText(orgDefaults?.walls_paint_id)
      const orgWallPrimerDefault = asText(orgDefaults?.walls_primer_id)
      const orgCeilingDefault = asText(orgDefaults?.ceiling_paint_id)
      const orgCeilingPrimerDefault = asText(orgDefaults?.ceiling_primer_id)
      const orgTrimDefault = asText(orgDefaults?.trim_paint_id)
      const orgTrimPrimerDefault = asText(orgDefaults?.trim_primer_id)
      const wallPaintOverride = asText(js?.walls_paint_id ?? js?.wall_paint_id)
      const wallPrimerOverride = asText(js?.walls_primer_id ?? js?.primer_id)
      const ceilingPaintOverride = asText(js?.ceiling_paint_id)
      const ceilingPrimerOverride = asText(js?.ceiling_primer_id ?? js?.primer_id)
      const trimPaintOverride = asText(js?.trim_paint_id)
      const trimPrimerOverride = asText(js?.trim_primer_id ?? js?.primer_id)
      const normalizedWallDefault = wallPaintOverride || orgWallDefault
      const normalizedWallPrimerDefault = wallPrimerOverride || orgWallPrimerDefault
      const normalizedCeilingDefault = ceilingPaintOverride || orgCeilingDefault
      const normalizedCeilingPrimerDefault = ceilingPrimerOverride || orgCeilingPrimerDefault
      const normalizedTrimDefault = trimPaintOverride || orgTrimDefault
      const normalizedTrimPrimerDefault = trimPrimerOverride || orgTrimPrimerDefault

      meta.setOrgJobProductDefaults({
        wallPaintProductId: orgWallDefault,
        wallPrimerProductId: orgWallPrimerDefault,
        ceilingPaintProductId: orgCeilingDefault,
        ceilingPrimerProductId: orgCeilingPrimerDefault,
        trimPaintProductId: orgTrimDefault,
        trimPrimerProductId: orgTrimPrimerDefault,
      })
      meta.setJobSettingsDraft(
        buildJobSettingsDraft(js, orgDefaults, {
          wallPaintOverride,
          wallPrimerOverride,
          ceilingPaintOverride,
          ceilingPrimerOverride,
          trimPaintOverride,
          trimPrimerOverride,
        })
      )

      const normalizedRooms = sortByPosition((estimatePayload.inputs.rooms ?? []).map(normalizeRoom))
      const loadedScopes = sortByPosition(
        (estimatePayload.inputs.room_wall_scopes ?? []).map(normalizeScope)
      )
      const loadedSegments = sortByPosition(
        (estimatePayload.inputs.wall_segments ?? []).map(normalizeSegment)
      )
      const sanitizedWalls = sanitizeV2WallsDrafts({
        rooms: normalizedRooms,
        scopes: loadedScopes,
        segments: loadedSegments,
      })
      const wallScopesWithoutDefaults = sanitizedWalls.scopes.map((scope) => ({
        ...scope,
        paintProductId:
          scope.paintProductId === normalizedWallDefault ? '' : scope.paintProductId,
        primerProductId:
          scope.primerProductId === normalizedWallPrimerDefault ? '' : scope.primerProductId,
      }))
      const normalizedRoomFlags = sortByPosition(
        (estimatePayload.inputs.room_flags ?? [])
          .map(normalizeRoomFlag)
          .filter((flag): flag is RoomFlagDraft => flag != null)
      )

      const normalizedCeilingScopes = sortByPosition(
        (estimatePayload.inputs.room_ceiling_scopes ?? []).map(normalizeCeilingScope)
      )
      const normalizedCeilingSegments = sortByPosition(
        (estimatePayload.inputs.ceiling_scope_segments ?? []).map(normalizeCeilingSegment)
      )
      const sanitizedCeilings = sanitizeV2CeilingsDrafts({
        rooms: normalizedRooms.map((room) => ({
          roomId: room.roomId,
          lengthIn: room.lengthIn,
          widthIn: room.widthIn,
          position: room.position,
        })),
        ceilingScopes: normalizedCeilingScopes,
        ceilingSegments: normalizedCeilingSegments,
      })
      const ceilingScopesWithoutDefaults = sanitizedCeilings.ceilingScopes.map((scope) => ({
        ...scope,
        paintProductId:
          scope.paintProductId === normalizedCeilingDefault ? '' : scope.paintProductId,
        primerProductId:
          scope.primerProductId === normalizedCeilingPrimerDefault
            ? ''
            : scope.primerProductId,
      }))

      const normalizedTrimScopes = sortByPosition(
        (estimatePayload.inputs.room_trim_scopes ?? []).map(normalizeTrimScope)
      )
      const sanitizedTrim = sanitizeV2TrimDrafts({
        rooms: normalizedRooms.map((room) => ({
          roomId: room.roomId,
          mode: 'RECT' as const,
          position: room.position,
        })),
        trimScopes: normalizedTrimScopes,
      })
      const trimScopesWithoutDefaults = sanitizedTrim.trimScopes.map((scope) => ({
        ...scope,
        paintProductId:
          scope.paintProductId === normalizedTrimDefault ? '' : scope.paintProductId,
        primerProductId:
          scope.primerProductId === normalizedTrimPrimerDefault ? '' : scope.primerProductId,
      }))

      const recalculated = recalculateEditorDraftFactors({
        rooms: normalizedRooms,
        wallScopes: wallScopesWithoutDefaults,
        ceilingScopes: ceilingScopesWithoutDefaults,
        trimScopes: trimScopesWithoutDefaults,
        roomFlags: normalizedRoomFlags,
        catalogs: nextCatalogs,
        trimTypeOptions: nextTrimTypeOptions,
      })

      collections.setRooms(normalizedRooms)
      collections.setScopes(recalculated.wallScopes)
      collections.setSegments(sanitizedWalls.segments)
      collections.setRoomFlags(normalizedRoomFlags)
      collections.setCeilingScopes(recalculated.ceilingScopes)
      collections.setCeilingSegments(sanitizedCeilings.ceilingSegments)
      collections.setTrimScopes(recalculated.trimScopes)
      meta.setWallCalculations(estimatePayload.wall_calculations ?? null)
      meta.setCeilingCalculations(estimatePayload.ceiling_calculations ?? null)
      meta.setTrimCalculations(estimatePayload.trim_calculations ?? null)
      meta.setSelectedRoomId((current) => {
        if (current && normalizedRooms.some((room) => room.roomId === current)) return current
        return normalizedRooms[0]?.roomId ?? ''
      })

      const initialSnapshot = JSON.stringify(
        buildEstimateV2SavePayload(
          normalizedRooms,
          recalculated.wallScopes,
          sanitizedWalls.segments,
          normalizedRoomFlags,
          recalculated.ceilingScopes,
          sanitizedCeilings.ceilingSegments,
          recalculated.trimScopes
        )
      )
      meta.setLastSavedSnapshot(initialSnapshot)
      meta.setSaveStatus('saved')
      meta.setAutoSaveHint(null)
      meta.setDebugMeta({
        dirtySource: 'load',
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      })
      meta.setLoading(false)
    } catch (error) {
      if (!activeRef.current) return
      console.error('Estimate V2 editor load crashed', {
        estimateId,
        operation: 'loadWorkspace',
        error,
      })
      meta.setError(
        createEstimateV2Error('Failed to fetch estimate workspace', { retryable: true })
      )
      meta.setLoading(false)
    }
  })

  const handleBeforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
    const currentSnapshot = JSON.stringify(
      buildEstimateV2SavePayload(
        collections.rooms,
        collections.scopes,
        collections.segments,
        collections.roomFlags,
        collections.ceilingScopes,
        collections.ceilingSegments,
        collections.trimScopes
      )
    )
    if (meta.loading || currentSnapshot === meta.lastSavedSnapshot) return
    event.preventDefault()
    event.returnValue = ''
  })

  useEffect(() => {
    if (!estimateId) return
    const activeRef = { current: true }
    void loadWorkspace(activeRef)
    return () => {
      activeRef.current = false
    }
  }, [estimateId])

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])
}
