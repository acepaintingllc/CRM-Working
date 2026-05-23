'use client'

import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_JOB_MINIMUM_ENABLED,
  DEFAULT_LABOR_DAY_POLICY_ENABLED,
  DEFAULT_LABOR_RATE,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from '@/lib/estimator/defaults'
import { asText } from '@/lib/estimator/parsing'
import { normalizeWallRollerTargetId } from '@/lib/estimator/rollerIdentity'
import { sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { sanitizeV2CeilingsDrafts } from '@/lib/estimator/v2CeilingsSanitize'
import { sanitizeV2TrimDrafts } from '@/lib/estimator/v2TrimSanitize'
import { sanitizeV2WallsDrafts } from '@/lib/estimator/v2WallsSanitize'
import type { EstimateV2JobMeta } from '@/types/estimator/v2Meta'
import type {
  EstimateV2CatalogsPayload as CatalogsPayload,
  EstimateV2DoorTypeOption,
  EstimateV2TrimTypeOption,
} from '@/types/estimator/v2Catalogs'
import type {
  EstimateV2RollerDraft,
  EstimateV2RollerScope,
  EstimateV2RoomFlagDraft as RoomFlagDraft,
} from '@/types/estimator/v2Rooms'
import type {
  EstimateV2AccessFeeDraft,
  EstimateV2OtherCustomerVisibility,
  EstimateV2OtherItemDraft,
  EstimateV2OtherPricingMode,
  EstimateV2OtherRollupTarget,
  EstimateV2PrejobTripDraft,
} from '@/types/estimator/v2Scopes'
import type {
  EstimateV2JobDefaultProducts,
  EstimateV2JobSettingsDraft as JobSettingsDraft,
} from '@/types/estimator/v2Settings'
import type { EstimateV2GetResponse as EstimateResponse } from '@/types/estimator/v2Summary'
import { recalculateEditorDraftFactors } from '../_lib/estimateV2EditorRecalculate'
import {
  hydrateConditionSelections,
  resolveAllConditionFactors,
} from '../details/_lib/estimateV2DetailsConditions'
import {
  normalizeCeilingScope,
  normalizeCeilingSegment,
  normalizeDoorScope,
  normalizeDrywallRepair,
  normalizeRoom,
  normalizeRoomFlag,
  normalizeScope,
  normalizeSegment,
  normalizeTrimScope,
} from '../_lib/estimateV2EditorNormalize'
import type { EstimateV2EditorDebugMeta, Unsafe } from './estimateV2EditorTypes'
import { buildEstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'

type ProductOverrideInputs = {
  wallPaintOverride: string
  wallPrimerOverride: string
  ceilingPaintOverride: string
  ceilingPrimerOverride: string
  trimPaintOverride: string
  trimPrimerOverride: string
}

export type EstimateV2SanitizedLoadResult = {
  catalogs: CatalogsPayload['catalogs']
  trimTypeOptions: EstimateV2TrimTypeOption[]
  doorTypeOptions: EstimateV2DoorTypeOption[]
  collections: {
    rooms: ReturnType<typeof normalizeRoom>[]
    scopes: ReturnType<typeof normalizeScope>[]
    segments: ReturnType<typeof normalizeSegment>[]
    roomFlags: RoomFlagDraft[]
    rollers: EstimateV2RollerDraft[]
    accessFees: EstimateV2AccessFeeDraft[]
    prejobTrips: EstimateV2PrejobTripDraft[]
    ceilingScopes: ReturnType<typeof normalizeCeilingScope>[]
    ceilingSegments: ReturnType<typeof normalizeCeilingSegment>[]
    trimScopes: ReturnType<typeof normalizeTrimScope>[]
    doorScopes: ReturnType<typeof normalizeDoorScope>[]
    drywallRepairs: ReturnType<typeof normalizeDrywallRepair>[]
    otherItems: EstimateV2OtherItemDraft[]
  }
  meta: {
    wallCalculations: EstimateResponse['wall_calculations']
    ceilingCalculations: EstimateResponse['ceiling_calculations']
    trimCalculations: EstimateResponse['trim_calculations']
    doorCalculations: EstimateResponse['door_calculations']
    drywallCalculations: EstimateResponse['drywall_calculations']
    pricingSummary: EstimateResponse['pricing_summary']
    selectedRoomId: string
    lastSavedSnapshot: ReturnType<typeof buildEstimateV2DirtySnapshot>
    saveStatus: 'saved'
    autoSaveHint: null
    debugMeta: EstimateV2EditorDebugMeta
    orgJobProductDefaults: EstimateV2JobDefaultProducts
    jobSettingsDraft: JobSettingsDraft
  }
}

function buildJobSettingsDraft(
  jobsettings: Unsafe | null,
  orgDefaults: Unsafe | null,
  catalogs: CatalogsPayload['catalogs'],
  overrides: ProductOverrideInputs
) {
  const crewSize = Number(jobsettings?.crew_size ?? 1)
  const conditionSelections = hydrateConditionSelections(jobsettings?.condition_selections)
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
    crewSize: Number.isFinite(crewSize) ? Math.max(1, Math.floor(crewSize)) : 1,
    wallPaintProductId: overrides.wallPaintOverride,
    wallPrimerProductId: overrides.wallPrimerOverride,
    ceilingPaintProductId: overrides.ceilingPaintOverride,
    ceilingPrimerProductId: overrides.ceilingPrimerOverride,
    trimPaintProductId: overrides.trimPaintOverride,
    trimPrimerProductId: overrides.trimPrimerOverride,
    standardDoorDeductionSf: Number(
      jobsettings?.standard_door_deduction_sf ?? orgDefaults?.standard_door_deduction_sf ?? 21
    ),
    standardWindowDeductionSf: Number(
      jobsettings?.standard_window_deduction_sf ?? orgDefaults?.standard_window_deduction_sf ?? 15
    ),
    baseboardOpeningDeductionLf: Number(
      jobsettings?.baseboard_opening_deduction_lf ?? orgDefaults?.baseboard_opening_deduction_lf ?? 3
    ),
    conditionSelections,
    resolvedConditionFactors: resolveAllConditionFactors(
      (catalogs.condition_modifiers ?? []).map((condition) => ({
        id: condition.id,
        displayName: condition.label,
        scope: condition.scope,
        modifierType: condition.modifier_type,
        factorField: condition.factor_field ?? '',
        levels: condition.levels,
      })),
      conditionSelections
    ),
  } satisfies JobSettingsDraft
}

export function buildEstimateV2CustomerDraft(job: EstimateV2JobMeta | null) {
  return {
    customerId: job?.customer_id ?? '',
    name: job?.customer_name ?? '',
    email: job?.customer_email ?? '',
    phone: job?.customer_phone ?? '',
    address: job?.customer_address ?? '',
  }
}

export function mergeEstimateV2Catalogs(params: {
  currentCatalogs: CatalogsPayload['catalogs']
  catalogsPayload: CatalogsPayload | null
}) {
  const { currentCatalogs, catalogsPayload } = params
  if (!catalogsPayload) return currentCatalogs
  return {
    ...currentCatalogs,
    ...catalogsPayload.catalogs,
    production_rates:
      catalogsPayload.catalogs.production_rates ?? currentCatalogs.production_rates,
  }
}

function buildTrimTypeOptions(catalogs: CatalogsPayload['catalogs']): EstimateV2TrimTypeOption[] {
  return (catalogs.trim_items ?? []).map((item) => ({
    id: item.id,
    label: item.label || item.id,
    family: item.family || null,
    category: item.category || item.family || null,
    unit_type: item.unit_type,
    helper_allowed: !!item.helper_allowed,
    default_production_rate_id: item.default_production_rate_id,
  }))
}

function buildDoorTypeOptions(catalogs: CatalogsPayload['catalogs']): EstimateV2DoorTypeOption[] {
  return (catalogs.door_types ?? []).map((item) => ({
    id: item.id,
    label: item.label || item.id,
    unit_rate_type: item.unit_rate_type ?? null,
    unit: item.unit ?? null,
    default_qty: item.default_qty ?? null,
    labor_rate: item.labor_rate ?? null,
    material_rate: item.material_rate ?? null,
    amount: item.amount ?? null,
  }))
}

function mergeLoadedConditionSelections<
  TSelections extends Record<string, unknown> | null | undefined,
>(base: TSelections, override: TSelections) {
  return {
    ...(base ?? {}),
    ...(override ?? {}),
  }
}

function normalizeRollerScope(value: unknown): EstimateV2RollerScope {
  const raw = asText(value).toLowerCase()
  if (raw === 'ceiling') return 'Ceiling'
  if (raw === 'trim') return 'Trim'
  return 'Wall'
}

function normalizeRoller(row: Unsafe, index: number): EstimateV2RollerDraft {
  const scope = normalizeRollerScope(row.scope)
  return {
    id: asText(row.id),
    scope,
    wallColorId: scope === 'Wall' ? normalizeWallRollerTargetId(row.wallColorId ?? row.wall_color_id) : '',
    selectedOptionId: asText(row.selectedOptionId ?? row.selected_option_id),
    rollerSizeIn: asText(row.rollerSizeIn ?? row.roller_size_in),
    coversQty: asText(row.coversQty ?? row.covers_qty),
    notes: asText(row.notes),
    position: Number(row.position ?? index),
  }
}

function normalizeAccessFee(row: Unsafe, index: number): EstimateV2AccessFeeDraft {
  return {
    id: asText(row.id),
    roomId: asText(row.roomId ?? row.room_id),
    accessFeeId: asText(row.accessFeeId ?? row.access_fee_id).toUpperCase(),
    qty: asText(row.qty),
    actualCostOverride: asText(row.actualCostOverride ?? row.actual_cost_override),
    notes: asText(row.notes),
    position: Number(row.position ?? index),
  }
}

function normalizePrejobTrip(row: Unsafe, index: number): EstimateV2PrejobTripDraft {
  return {
    id: asText(row.id) || `prejob-${index + 1}`,
    roomId: asText(row.roomId ?? row.room_id).toUpperCase(),
    tripName: asText(row.tripName ?? row.trip_name ?? row.man_trip_name ?? row.task),
    tripCount: asText(row.tripCount ?? row.trip_num),
    tripRate: asText(row.tripRate ?? row.trip_rate),
    manualAdjustment: asText(row.manualAdjustment ?? row.manual_adjustment),
    notes: asText(row.notes),
    position: Number(row.position ?? index),
    include: asText(row.include ?? row.active).toUpperCase() === 'N' ? 'N' : 'Y',
  }
}

function normalizeOtherPricingMode(value: unknown): EstimateV2OtherPricingMode {
  const raw = asText(value).toLowerCase()
  if (raw === 'quantity_rate' || raw === 'labor' || raw === 'material_supply') return raw
  return 'fixed'
}

function normalizeOtherRollupTarget(value: unknown): EstimateV2OtherRollupTarget {
  const raw = asText(value).toLowerCase()
  if (
    raw === 'walls' ||
    raw === 'ceilings' ||
    raw === 'trim' ||
    raw === 'doors' ||
    raw === 'drywall' ||
    raw === 'room_total' ||
    raw === 'job_total' ||
    raw === 'other'
  ) {
    return raw
  }
  if (raw === 'wall' || raw === 'walls') return 'walls'
  if (raw === 'ceiling' || raw === 'ceilings') return 'ceilings'
  if (raw === 'door' || raw === 'doors') return 'doors'
  if (raw === 'room') return 'room_total'
  if (raw === 'job') return 'job_total'
  return 'other'
}

function normalizeOtherVisibility(value: unknown): EstimateV2OtherCustomerVisibility {
  return asText(value).toLowerCase() === 'rollup' ? 'rollup' : 'standalone'
}

function normalizeOtherItem(row: Unsafe, index: number): EstimateV2OtherItemDraft {
  return {
    id: asText(row.id) || `other-${index + 1}`,
    roomId: asText(row.roomId ?? row.room_id ?? row.location).toUpperCase(),
    position: Number(row.position ?? index),
    include: asText(row.include ?? row.active).toUpperCase() === 'N' ? 'N' : 'Y',
    description: asText(row.description ?? row.client_description),
    customerLabel: asText(row.customerLabel ?? row.customer_label ?? row.client_description),
    pricingMode: normalizeOtherPricingMode(row.pricingMode ?? row.pricing_mode),
    quantity: asText(row.quantity ?? row.qty),
    unitRate: asText(row.unitRate ?? row.unit_rate),
    laborHours: asText(row.laborHours ?? row.labor_hours ?? row.labor_hrs_each),
    laborRate: asText(row.laborRate ?? row.labor_rate),
    materialCost: asText(row.materialCost ?? row.material_cost ?? row.materials_each),
    supplyCost: asText(row.supplyCost ?? row.supply_cost),
    fixedAmount: asText(row.fixedAmount ?? row.fixed_amount),
    rollupTarget: normalizeOtherRollupTarget(row.rollupTarget ?? row.rollup_target ?? row.rollup_scope),
    customerVisibility: normalizeOtherVisibility(row.customerVisibility ?? row.customer_visibility),
    internalNotes: asText(row.internalNotes ?? row.internal_notes ?? row.notes),
  }
}

export function sanitizeEstimateV2EditorLoad(params: {
  estimatePayload: EstimateResponse
  catalogs: CatalogsPayload['catalogs']
  selectedRoomId: string
}) {
  const { estimatePayload, catalogs, selectedRoomId } = params
  const trimTypeOptions = buildTrimTypeOptions(catalogs)
  const doorTypeOptions = buildDoorTypeOptions(catalogs)
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
  const jobSettingsDraft = buildJobSettingsDraft(js, orgDefaults, catalogs, {
    wallPaintOverride,
    wallPrimerOverride,
    ceilingPaintOverride,
    ceilingPrimerOverride,
    trimPaintOverride,
    trimPrimerOverride,
  })

  const normalizedRooms = sortByPosition(
    (estimatePayload.inputs.rooms ?? []).map((row, index) => {
      const room = normalizeRoom(row, index)
      return {
        ...room,
        conditionSelections: mergeLoadedConditionSelections(
          jobSettingsDraft.conditionSelections?.room,
          room.conditionSelections
        ),
      }
    })
  )
  const loadedScopes = sortByPosition(
    (estimatePayload.inputs.room_wall_scopes ?? []).map((row, index) => {
      const scope = normalizeScope(row, index)
      return {
        ...scope,
        conditionSelections: mergeLoadedConditionSelections(
          jobSettingsDraft.conditionSelections?.wall,
          scope.conditionSelections
        ),
      }
    })
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
    paintProductId: scope.paintProductId === normalizedWallDefault ? '' : scope.paintProductId,
    primerProductId:
      scope.primerProductId === normalizedWallPrimerDefault ? '' : scope.primerProductId,
  }))
  const normalizedRoomFlags = sortByPosition(
    (estimatePayload.inputs.room_flags ?? [])
      .map(normalizeRoomFlag)
      .filter((flag): flag is RoomFlagDraft => flag != null)
  )
  const normalizedRollers = sortByPosition(
    (estimatePayload.inputs.rollers ?? [])
      .map(normalizeRoller)
      .filter((roller): roller is NonNullable<ReturnType<typeof normalizeRoller>> => roller != null)
  )
  const normalizedAccessFees = sortByPosition(
    (estimatePayload.inputs.access_fees ?? [])
      .map(normalizeAccessFee)
      .filter((row) => row.accessFeeId)
  )
  const normalizedPrejobTrips = sortByPosition(
    (estimatePayload.inputs.prejob ?? []).map(normalizePrejobTrip)
  )

  const normalizedCeilingScopes = sortByPosition(
    (estimatePayload.inputs.room_ceiling_scopes ?? []).map((row, index) => {
      const scope = normalizeCeilingScope(row, index)
      return {
        ...scope,
        conditionSelections: mergeLoadedConditionSelections(
          jobSettingsDraft.conditionSelections?.ceiling,
          scope.conditionSelections
        ),
      }
    })
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
      scope.primerProductId === normalizedCeilingPrimerDefault ? '' : scope.primerProductId,
  }))

  const normalizedTrimScopes = sortByPosition(
    (estimatePayload.inputs.room_trim_scopes ?? []).map((row, index) => {
      const scope = normalizeTrimScope(row, index)
      return {
        ...scope,
        conditionSelections: mergeLoadedConditionSelections(
          jobSettingsDraft.conditionSelections?.trim,
          scope.conditionSelections
        ),
      }
    })
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
    paintProductId: scope.paintProductId === normalizedTrimDefault ? '' : scope.paintProductId,
    primerProductId:
      scope.primerProductId === normalizedTrimPrimerDefault ? '' : scope.primerProductId,
  }))
  const normalizedDoorScopes = sortByPosition(
    (estimatePayload.inputs.room_door_scopes ?? []).map(normalizeDoorScope)
  )
  const normalizedDrywallRepairs = sortByPosition(
    (estimatePayload.inputs.drywall_repairs ?? []).map(normalizeDrywallRepair)
  )
  const normalizedOtherItems = sortByPosition(
    (estimatePayload.inputs.other ?? []).map(normalizeOtherItem)
  )
  const recalculated = recalculateEditorDraftFactors({
    rooms: normalizedRooms,
    wallScopes: wallScopesWithoutDefaults,
    ceilingScopes: ceilingScopesWithoutDefaults,
    trimScopes: trimScopesWithoutDefaults,
    roomFlags: normalizedRoomFlags,
    catalogs,
    trimTypeOptions,
  })

  const nextSelectedRoomId =
    selectedRoomId && normalizedRooms.some((room) => room.roomId === selectedRoomId)
      ? selectedRoomId
      : normalizedRooms[0]?.roomId ?? ''

  const lastSavedSnapshot = buildEstimateV2DirtySnapshot({
    jobSettingsDraft,
    rooms: normalizedRooms,
    scopes: recalculated.wallScopes,
    segments: sanitizedWalls.segments,
    roomFlags: normalizedRoomFlags,
    ceilingScopes: recalculated.ceilingScopes,
    ceilingSegments: sanitizedCeilings.ceilingSegments,
    trimScopes: recalculated.trimScopes,
    doorScopes: normalizedDoorScopes,
    drywallRepairs: normalizedDrywallRepairs,
    rollers: normalizedRollers,
    accessFees: normalizedAccessFees,
    prejobTrips: normalizedPrejobTrips,
    otherItems: normalizedOtherItems,
  })

  return {
    catalogs,
    trimTypeOptions,
    doorTypeOptions,
    collections: {
      rooms: normalizedRooms,
      scopes: recalculated.wallScopes,
      segments: sanitizedWalls.segments,
      roomFlags: normalizedRoomFlags,
      ceilingScopes: recalculated.ceilingScopes,
      ceilingSegments: sanitizedCeilings.ceilingSegments,
      trimScopes: recalculated.trimScopes,
      doorScopes: normalizedDoorScopes,
      drywallRepairs: normalizedDrywallRepairs,
      rollers: normalizedRollers,
      accessFees: normalizedAccessFees,
      prejobTrips: normalizedPrejobTrips,
      otherItems: normalizedOtherItems,
    },
    meta: {
      wallCalculations: estimatePayload.wall_calculations ?? null,
      ceilingCalculations: estimatePayload.ceiling_calculations ?? null,
      trimCalculations: estimatePayload.trim_calculations ?? null,
      doorCalculations: estimatePayload.door_calculations ?? null,
      drywallCalculations: estimatePayload.drywall_calculations ?? null,
      pricingSummary: estimatePayload.pricing_summary ?? null,
      selectedRoomId: nextSelectedRoomId,
      lastSavedSnapshot,
      saveStatus: 'saved' as const,
      autoSaveHint: null,
      debugMeta: {
        dirtySource: 'load',
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      },
      orgJobProductDefaults: {
        wallPaintProductId: orgWallDefault,
        wallPrimerProductId: orgWallPrimerDefault,
        ceilingPaintProductId: orgCeilingDefault,
        ceilingPrimerProductId: orgCeilingPrimerDefault,
        trimPaintProductId: orgTrimDefault,
        trimPrimerProductId: orgTrimPrimerDefault,
      },
      jobSettingsDraft,
    },
  } satisfies EstimateV2SanitizedLoadResult
}
