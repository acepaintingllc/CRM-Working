'use client'

import { useCallback, useMemo } from 'react'
import {
  estimateV2StoreSelectors,
  useEstimateV2Store,
  type EstimateV2EditorStoreApi,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  buildCeilingScopeByRoomId,
  buildCeilingScopeEffectiveAreaById,
  buildLocalRoomEffectiveAreaByRoomId,
  buildLocalScopeEffectiveAreaById,
  buildLocalSegmentEffectiveAreaById,
  buildPaintOptionsByScope,
  buildPrimerOptionsByScope,
  buildProductLabelById,
  buildProductionRateById,
  buildRoomComplexityFactorByRoomId,
  buildRoomFlagById,
  buildRoomFlagFactorByRoomId,
  buildRoomHeightFactorByRoomId,
  buildTrimScopeByRoomId,
  buildTrimScopeMetricById,
  buildWallRoomEffectiveAreaByRoomId,
  buildWallScopeByRoomId,
  buildWallScopeEffectiveAreaById,
  buildWallSegmentEffectiveAreaById,
  sumIncludedValues,
} from '../_lib/estimateV2EditorDerived'
import {
  formatDateTime,
  inferTrimUnitTypeFromText,
  resolveRoomModeById,
} from '../_lib/estimateV2EditorNormalize'
import { getSaveStatusText } from '@/lib/estimator/v2WallsAutosave'
import { asText } from '@/lib/estimator/parsing'
import { buildEstimateV2SavePayload } from '@/lib/estimator/v2DraftPayload'
import type { EstimateV2TrimTypeOption as TrimTypeOption } from '@/types/estimator/v2'

const FALLBACK_COLOR_CODES = Array.from({ length: 6 }, (_, index) => ({
  id: `COLOR${index + 1}`,
  label: `Color ${index + 1}`,
}))

export function useEstimateV2DerivedState(params: { store: EstimateV2EditorStoreApi }) {
  const { store } = params
  const collections = useEstimateV2Store(store, estimateV2StoreSelectors.collections)
  const meta = useEstimateV2Store(store, estimateV2StoreSelectors.meta)

  const wallProductionRates = useMemo(
    () =>
      (meta.catalogs.production_rates ?? []).filter(
        (option) => asText(option?.scope_id).toUpperCase() === 'WALLS'
      ),
    [meta.catalogs.production_rates]
  )
  const trimProductionRates = useMemo(
    () =>
      (meta.catalogs.production_rates ?? []).filter(
        (option) => asText(option?.scope_id).toUpperCase() === 'TRIM'
      ),
    [meta.catalogs.production_rates]
  )
  const wallProductionRateById = useMemo(
    () => buildProductionRateById(wallProductionRates),
    [wallProductionRates]
  )
  const trimTypeOptions = useMemo<TrimTypeOption[]>(
    () =>
      trimProductionRates.map((rate) => ({
        id: rate.id,
        label: rate.label || rate.id,
        family: rate.surface_type || null,
        category: rate.condition || rate.surface_type || null,
        unit_type: inferTrimUnitTypeFromText(
          `${rate.id} ${rate.label} ${rate.surface_type} ${rate.condition}`
        ),
        helper_allowed: false,
        default_production_rate_id: rate.id,
      })),
    [trimProductionRates]
  )
  const roomFlagById = useMemo(
    () => buildRoomFlagById(meta.catalogs.room_flags),
    [meta.catalogs.room_flags]
  )
  const roomModeById = useMemo(
    () =>
      resolveRoomModeById({
        rooms: collections.rooms,
        wallScopes: collections.scopes,
        ceilingScopes: collections.ceilingScopes,
      }),
    [collections.ceilingScopes, collections.rooms, collections.scopes]
  )
  const selectedRoom =
    collections.rooms.find((room) => room.roomId === meta.selectedRoomId) ?? null
  const roomScopeByRoomId = useMemo(
    () => buildWallScopeByRoomId(collections.scopes),
    [collections.scopes]
  )
  const roomCeilingScopeByRoomId = useMemo(
    () => buildCeilingScopeByRoomId(collections.ceilingScopes),
    [collections.ceilingScopes]
  )
  const roomTrimScopeByRoomId = useMemo(
    () => buildTrimScopeByRoomId(collections.trimScopes),
    [collections.trimScopes]
  )
  const selectedRoomScopes = useMemo(
    () => roomScopeByRoomId.get(meta.selectedRoomId) ?? [],
    [meta.selectedRoomId, roomScopeByRoomId]
  )
  const selectedRoomCeilingScopes = useMemo(
    () => roomCeilingScopeByRoomId.get(meta.selectedRoomId) ?? [],
    [meta.selectedRoomId, roomCeilingScopeByRoomId]
  )
  const selectedRoomTrimScopes = useMemo(
    () => roomTrimScopeByRoomId.get(meta.selectedRoomId) ?? [],
    [meta.selectedRoomId, roomTrimScopeByRoomId]
  )
  const firstScope = selectedRoomScopes[0] ?? null
  const firstCeilingScope = selectedRoomCeilingScopes[0] ?? null
  const firstTrimScope = selectedRoomTrimScopes[0] ?? null
  const wallsIncluded = selectedRoomScopes.some((scope) => scope.include === 'Y')
  const ceilingsIncluded = selectedRoomCeilingScopes.some((scope) => scope.include === 'Y')
  const trimsIncluded = selectedRoomTrimScopes.some((scope) => scope.include === 'Y')
  const jobTrimsIncluded = collections.trimScopes.some((scope) => scope.include === 'Y')
  const selectedRoomResolvedMode = selectedRoom
    ? roomModeById.get(selectedRoom.roomId) ?? 'RECT'
    : 'RECT'
  const selectedRoomGeometryMode = selectedRoomResolvedMode

  const roomComplexityFactorByRoomId = useMemo(
    () => buildRoomComplexityFactorByRoomId(collections.rooms, wallProductionRateById),
    [collections.rooms, wallProductionRateById]
  )
  const roomWallFlagFactorByRoomId = useMemo(
    () => buildRoomFlagFactorByRoomId(collections.rooms, collections.roomFlags, roomFlagById, 'wall_factor'),
    [collections.roomFlags, collections.rooms, roomFlagById]
  )
  const roomCeilingFlagFactorByRoomId = useMemo(
    () => buildRoomFlagFactorByRoomId(collections.rooms, collections.roomFlags, roomFlagById, 'ceil_factor'),
    [collections.roomFlags, collections.rooms, roomFlagById]
  )
  const roomTrimFlagFactorByRoomId = useMemo(
    () => buildRoomFlagFactorByRoomId(collections.rooms, collections.roomFlags, roomFlagById, 'trim_factor'),
    [collections.roomFlags, collections.rooms, roomFlagById]
  )
  const roomHeightFactorByRoomId = useMemo(
    () => buildRoomHeightFactorByRoomId(collections.rooms, meta.catalogs.height_factors),
    [collections.rooms, meta.catalogs.height_factors]
  )

  const ceilingScopeEffectiveAreaById = useMemo(
    () => buildCeilingScopeEffectiveAreaById(meta.ceilingCalculations),
    [meta.ceilingCalculations]
  )
  const trimScopeEffectiveMeasurementById = useMemo(
    () => buildTrimScopeMetricById(meta.trimCalculations, 'effective_measurement'),
    [meta.trimCalculations]
  )
  const trimScopeEffectiveTotalById = useMemo(
    () => buildTrimScopeMetricById(meta.trimCalculations, 'effective_total'),
    [meta.trimCalculations]
  )
  const scopeEffectiveAreaById = useMemo(
    () => buildWallScopeEffectiveAreaById(meta.wallCalculations),
    [meta.wallCalculations]
  )
  const segmentEffectiveAreaById = useMemo(
    () => buildWallSegmentEffectiveAreaById(meta.wallCalculations),
    [meta.wallCalculations]
  )
  const roomEffectiveAreaByRoomId = useMemo(
    () => buildWallRoomEffectiveAreaByRoomId(meta.wallCalculations),
    [meta.wallCalculations]
  )
  const localSegmentEffectiveAreaById = useMemo(
    () => buildLocalSegmentEffectiveAreaById(collections.segments),
    [collections.segments]
  )
  const localScopeEffectiveAreaById = useMemo(
    () => buildLocalScopeEffectiveAreaById(collections.scopes, collections.segments),
    [collections.scopes, collections.segments]
  )
  const localRoomEffectiveAreaByRoomId = useMemo(
    () =>
      buildLocalRoomEffectiveAreaByRoomId(
        collections.rooms,
        collections.scopes,
        localScopeEffectiveAreaById
      ),
    [collections.rooms, collections.scopes, localScopeEffectiveAreaById]
  )
  const currentPayload = useMemo(
    () =>
      buildEstimateV2SavePayload(
        collections.rooms,
        collections.scopes,
        collections.segments,
        collections.roomFlags,
        collections.ceilingScopes,
        collections.ceilingSegments,
        collections.trimScopes
      ),
    [
      collections.ceilingScopes,
      collections.ceilingSegments,
      collections.roomFlags,
      collections.rooms,
      collections.scopes,
      collections.segments,
      collections.trimScopes,
    ]
  )
  const currentSnapshot = useMemo(() => JSON.stringify(currentPayload), [currentPayload])
  const dirty = !meta.loading && currentSnapshot !== meta.lastSavedSnapshot
  const hasServerCalculations = (meta.wallCalculations?.room_totals?.length ?? 0) > 0
  const useLocalPreviewCalculations = dirty || !hasServerCalculations
  const displayedSegmentEffectiveAreaById = useMemo(
    () => (useLocalPreviewCalculations ? localSegmentEffectiveAreaById : segmentEffectiveAreaById),
    [localSegmentEffectiveAreaById, segmentEffectiveAreaById, useLocalPreviewCalculations]
  )
  const displayedScopeEffectiveAreaById = useMemo(
    () => (useLocalPreviewCalculations ? localScopeEffectiveAreaById : scopeEffectiveAreaById),
    [localScopeEffectiveAreaById, scopeEffectiveAreaById, useLocalPreviewCalculations]
  )
  const displayedRoomEffectiveAreaByRoomId = useMemo(
    () => (useLocalPreviewCalculations ? localRoomEffectiveAreaByRoomId : roomEffectiveAreaByRoomId),
    [localRoomEffectiveAreaByRoomId, roomEffectiveAreaByRoomId, useLocalPreviewCalculations]
  )
  const selectedCeilingEffectiveSqFt = useMemo(
    () => sumIncludedValues(selectedRoomCeilingScopes, ceilingScopeEffectiveAreaById),
    [ceilingScopeEffectiveAreaById, selectedRoomCeilingScopes]
  )
  const selectedTrimSubtotal = useMemo(
    () => sumIncludedValues(selectedRoomTrimScopes, trimScopeEffectiveTotalById),
    [selectedRoomTrimScopes, trimScopeEffectiveTotalById]
  )
  const selectedTrimMeasurement = useMemo(
    () => sumIncludedValues(selectedRoomTrimScopes, trimScopeEffectiveMeasurementById),
    [selectedRoomTrimScopes, trimScopeEffectiveMeasurementById]
  )
  const totalEffectiveAreaSqFt = useMemo(
    () =>
      collections.rooms.reduce(
        (sum, room) => sum + (displayedRoomEffectiveAreaByRoomId.get(room.roomId) ?? 0),
        0
      ),
    [collections.rooms, displayedRoomEffectiveAreaByRoomId]
  )
  const selectedRoomEffectiveSqFt = useMemo(
    () =>
      selectedRoom ? displayedRoomEffectiveAreaByRoomId.get(selectedRoom.roomId) ?? null : null,
    [displayedRoomEffectiveAreaByRoomId, selectedRoom]
  )
  const selectedScopeEffectiveSqFt = useMemo(
    () => (firstScope ? displayedScopeEffectiveAreaById.get(firstScope.id) ?? null : null),
    [displayedScopeEffectiveAreaById, firstScope]
  )
  const activeRoomFlagCount = useMemo(
    () =>
      selectedRoom
        ? collections.roomFlags.filter((flag) => flag.roomId === selectedRoom.roomId).length
        : 0,
    [collections.roomFlags, selectedRoom]
  )
  const selectedRoomIssueCount = useMemo(
    () =>
      selectedRoom
        ? meta.validationIssues.filter((issue) => issue.startsWith(`${selectedRoom.roomId}:`)).length
        : 0,
    [meta.validationIssues, selectedRoom]
  )
  const colorCodeOptions =
    meta.catalogs.color_codes.length > 0 ? meta.catalogs.color_codes : FALLBACK_COLOR_CODES
  const defaultColorCodeId = colorCodeOptions[0]?.id ?? ''
  const productLabelById = useMemo(
    () => buildProductLabelById(meta.catalogs.paint_products),
    [meta.catalogs.paint_products]
  )
  const allPaintProducts = useMemo(
    () => meta.catalogs.paint_products.filter((product) => product.type.toLowerCase() !== 'primer'),
    [meta.catalogs.paint_products]
  )
  const allPrimerProducts = useMemo(
    () => meta.catalogs.paint_products.filter((product) => product.type.toLowerCase().includes('primer')),
    [meta.catalogs.paint_products]
  )
  const paintOptions = allPaintProducts
  const wallPaintOptions = useMemo(
    () => buildPaintOptionsByScope(meta.catalogs.paint_products, 'Walls'),
    [meta.catalogs.paint_products]
  )
  const ceilingPaintOptions = useMemo(
    () => buildPaintOptionsByScope(meta.catalogs.paint_products, 'Ceilings'),
    [meta.catalogs.paint_products]
  )
  const trimPaintOptions = useMemo(
    () => buildPaintOptionsByScope(meta.catalogs.paint_products, 'Trim'),
    [meta.catalogs.paint_products]
  )
  const wallPrimerOptions = useMemo(
    () => buildPrimerOptionsByScope(meta.catalogs.paint_products, 'Walls'),
    [meta.catalogs.paint_products]
  )
  const ceilingPrimerOptions = useMemo(
    () => buildPrimerOptionsByScope(meta.catalogs.paint_products, 'Ceilings'),
    [meta.catalogs.paint_products]
  )
  const trimPrimerOptions = useMemo(
    () => buildPrimerOptionsByScope(meta.catalogs.paint_products, 'Trim'),
    [meta.catalogs.paint_products]
  )
  const roomTypeOptions = useMemo(
    () =>
      meta.catalogs.room_types.length > 0
        ? meta.catalogs.room_types
        : selectedRoom?.roomTypeId
          ? [{ id: selectedRoom.roomTypeId, label: selectedRoom.roomTypeId }]
          : [],
    [meta.catalogs.room_types, selectedRoom]
  )
  const calculationsStale = dirty

  const paintLabelForId = useCallback(
    (paintProductId: string) => productLabelById.get(paintProductId) ?? paintProductId,
    [productLabelById]
  )
  const primerLabelForId = useCallback(
    (primerProductId: string) => productLabelById.get(primerProductId) ?? primerProductId,
    [productLabelById]
  )
  const defaultProductLabel = useCallback(
    (productId: string, labelForId: (value: string) => string, fallback: string) => {
      const resolvedId = asText(productId)
      if (!resolvedId) return fallback
      return labelForId(resolvedId) || resolvedId
    },
    []
  )
  const scopeProductStateLabel = useCallback(
    (productId: string, defaultProductId: string, labelForId: (value: string) => string) => {
      const selectedId = asText(productId)
      const defaultId = asText(defaultProductId)
      if (!selectedId || selectedId === defaultId) {
        return defaultProductLabel(defaultId, labelForId, 'No Default')
      }
      return labelForId(selectedId) || selectedId
    },
    [defaultProductLabel]
  )
  const effectiveJobProductDefaults = useMemo(
    () => ({
      wallPaintProductId:
        meta.jobSettingsDraft.wallPaintProductId || meta.orgJobProductDefaults.wallPaintProductId,
      wallPrimerProductId:
        meta.jobSettingsDraft.wallPrimerProductId || meta.orgJobProductDefaults.wallPrimerProductId,
      ceilingPaintProductId:
        meta.jobSettingsDraft.ceilingPaintProductId ||
        meta.orgJobProductDefaults.ceilingPaintProductId,
      ceilingPrimerProductId:
        meta.jobSettingsDraft.ceilingPrimerProductId ||
        meta.orgJobProductDefaults.ceilingPrimerProductId,
      trimPaintProductId:
        meta.jobSettingsDraft.trimPaintProductId || meta.orgJobProductDefaults.trimPaintProductId,
      trimPrimerProductId:
        meta.jobSettingsDraft.trimPrimerProductId || meta.orgJobProductDefaults.trimPrimerProductId,
    }),
    [meta.jobSettingsDraft, meta.orgJobProductDefaults]
  )

  const orgWallPaintLabel = defaultProductLabel(
    meta.orgJobProductDefaults.wallPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const orgWallPrimerLabel = defaultProductLabel(
    meta.orgJobProductDefaults.wallPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const orgCeilingPaintLabel = defaultProductLabel(
    meta.orgJobProductDefaults.ceilingPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const orgCeilingPrimerLabel = defaultProductLabel(
    meta.orgJobProductDefaults.ceilingPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const orgTrimPaintLabel = defaultProductLabel(
    meta.orgJobProductDefaults.trimPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const orgTrimPrimerLabel = defaultProductLabel(
    meta.orgJobProductDefaults.trimPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const effectiveWallPaintLabel = defaultProductLabel(
    effectiveJobProductDefaults.wallPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const effectiveWallPrimerLabel = defaultProductLabel(
    effectiveJobProductDefaults.wallPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const effectiveCeilingPaintLabel = defaultProductLabel(
    effectiveJobProductDefaults.ceilingPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const effectiveCeilingPrimerLabel = defaultProductLabel(
    effectiveJobProductDefaults.ceilingPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const effectiveTrimPaintLabel = defaultProductLabel(
    effectiveJobProductDefaults.trimPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const effectiveTrimPrimerLabel = defaultProductLabel(
    effectiveJobProductDefaults.trimPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const wallPaintLabel = firstScope
    ? scopeProductStateLabel(
        firstScope.paintProductId,
        effectiveJobProductDefaults.wallPaintProductId,
        paintLabelForId
      )
    : effectiveWallPaintLabel
  const wallPrimerLabel = firstScope
    ? scopeProductStateLabel(
        firstScope.primerProductId,
        effectiveJobProductDefaults.wallPrimerProductId,
        primerLabelForId
      )
    : effectiveWallPrimerLabel
  const ceilingPaintLabel = firstCeilingScope
    ? scopeProductStateLabel(
        firstCeilingScope.paintProductId,
        effectiveJobProductDefaults.ceilingPaintProductId,
        paintLabelForId
      )
    : effectiveCeilingPaintLabel
  const ceilingPrimerLabel = firstCeilingScope
    ? scopeProductStateLabel(
        firstCeilingScope.primerProductId,
        effectiveJobProductDefaults.ceilingPrimerProductId,
        primerLabelForId
      )
    : effectiveCeilingPrimerLabel
  const trimPaintLabel = firstTrimScope
    ? scopeProductStateLabel(
        firstTrimScope.paintProductId,
        effectiveJobProductDefaults.trimPaintProductId,
        paintLabelForId
      )
    : effectiveTrimPaintLabel
  const trimPrimerLabel = firstTrimScope
    ? scopeProductStateLabel(
        firstTrimScope.primerProductId,
        effectiveJobProductDefaults.trimPrimerProductId,
        primerLabelForId
      )
    : effectiveTrimPrimerLabel

  const saveStatusText = useMemo(
    () =>
      getSaveStatusText({
        saving: meta.saving,
        saveStatus: meta.saveStatus,
        dirty,
        autoSaveHint: meta.autoSaveHint,
        error: meta.error?.message ?? null,
        updatedAt: meta.estimate?.updated_at ?? null,
        formatDateTime,
      }),
    [dirty, meta.autoSaveHint, meta.error?.message, meta.estimate?.updated_at, meta.saveStatus, meta.saving]
  )
  const saveStatusColor =
    meta.saveStatus === 'error'
      ? '#fecaca'
      : dirty || meta.saveStatus === 'blocked'
        ? '#f9e2b7'
        : 'var(--v2-ink-3)'

  return {
    wallProductionRates,
    trimProductionRates,
    wallProductionRateById,
    trimTypeOptions,
    roomFlagById,
    roomModeById,
    selectedRoom,
    roomScopeByRoomId,
    roomCeilingScopeByRoomId,
    roomTrimScopeByRoomId,
    selectedRoomScopes,
    selectedRoomCeilingScopes,
    selectedRoomTrimScopes,
    firstScope,
    firstCeilingScope,
    firstTrimScope,
    wallsIncluded,
    ceilingsIncluded,
    trimsIncluded,
    jobTrimsIncluded,
    selectedRoomResolvedMode,
    selectedRoomGeometryMode,
    roomComplexityFactorByRoomId,
    roomWallFlagFactorByRoomId,
    roomCeilingFlagFactorByRoomId,
    roomTrimFlagFactorByRoomId,
    roomHeightFactorByRoomId,
    displayedSegmentEffectiveAreaById,
    displayedScopeEffectiveAreaById,
    displayedRoomEffectiveAreaByRoomId,
    selectedCeilingEffectiveSqFt,
    trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById,
    totalEffectiveAreaSqFt,
    selectedRoomEffectiveSqFt,
    selectedScopeEffectiveSqFt,
    activeRoomFlagCount,
    selectedRoomIssueCount,
    colorCodeOptions,
    defaultColorCodeId,
    productLabelById,
    allPaintProducts,
    allPrimerProducts,
    paintOptions,
    wallPaintOptions,
    ceilingPaintOptions,
    trimPaintOptions,
    wallPrimerOptions,
    ceilingPrimerOptions,
    trimPrimerOptions,
    roomTypeOptions,
    calculationsStale,
    wallPaintLabel,
    wallPrimerLabel,
    ceilingPaintLabel,
    ceilingPrimerLabel,
    trimPaintLabel,
    trimPrimerLabel,
    selectedTrimSubtotal,
    selectedTrimMeasurement,
    saveStatusText,
    saveStatusColor,
    orgWallPaintLabel,
    orgWallPrimerLabel,
    orgCeilingPaintLabel,
    orgCeilingPrimerLabel,
    orgTrimPaintLabel,
    orgTrimPrimerLabel,
    effectiveWallPaintLabel,
    effectiveWallPrimerLabel,
    effectiveCeilingPaintLabel,
    effectiveCeilingPrimerLabel,
    effectiveTrimPaintLabel,
    effectiveTrimPrimerLabel,
    dirty,
    currentSnapshot,
    currentPayload,
    useLocalPreviewCalculations,
  }
}
