import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
  EstimateV2JobSettingsDraft,
  EstimateV2RoomDraft,
  EstimateV2RoomFlagDraft,
  EstimateV2RollerDraft,
  EstimateV2SavePayload,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDerived,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDerived,
  EstimateV2WallSegmentDraft,
} from '../../types/estimator/v2.ts'
import { asNullableNumber } from './parsing.ts'
import { normalizeRollerApplicatorQuantity } from './rollerQuantities.ts'
import { normalizeWallRollerTargetId } from './rollerIdentity.ts'
import { HIDDEN_CEILING_COLOR_ID } from './scopeRules.ts'
import type { EstimateV2ConditionSelections } from './conditionModifiers.ts'

const STANDARD_DOOR_DEDUCTION_SF = 21
const STANDARD_WINDOW_DEDUCTION_SF = 15

export function sortByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

function toNullableDraftNumber(value: string) {
  return asNullableNumber(value)
}

function normalizeCrewSize(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value as number))
}

function toNullableText(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

function toPersistedConditionSelections(
  selections: EstimateV2ConditionSelections | null | undefined
) {
  const entries = Object.entries(selections ?? {}).filter(([, value]) => !!value)
  return entries.length > 0 ? Object.fromEntries(entries) : null
}

export function deriveEstimateV2Segment(segment: EstimateV2WallSegmentDraft): EstimateV2WallSegmentDerived {
  const quantity = toNullableDraftNumber(segment.quantity) ?? 1
  const widthIn = toNullableDraftNumber(segment.widthIn)
  const heightIn = toNullableDraftNumber(segment.heightIn)
  const baseIn = toNullableDraftNumber(segment.baseIn)
  const manualAreaSqFt = toNullableDraftNumber(segment.manualAreaSqFt)
  let rawArea: number | null = null

  if (segment.shapeType === 'RECTANGLE' && widthIn != null && heightIn != null) {
    rawArea = (widthIn * heightIn * quantity) / 144
  } else if (segment.shapeType === 'TRIANGLE' && baseIn != null && heightIn != null) {
    rawArea = ((baseIn * heightIn) / 2 / 144) * quantity
  } else if (segment.shapeType === 'MANUAL' && manualAreaSqFt != null) {
    rawArea = manualAreaSqFt * quantity
  }

  const doorCount = toNullableDraftNumber(segment.standardDoorCount) ?? 0
  const windowCount = toNullableDraftNumber(segment.standardWindowCount) ?? 0
  const deductionArea = doorCount * STANDARD_DOOR_DEDUCTION_SF + windowCount * STANDARD_WINDOW_DEDUCTION_SF
  const deductionAdjustedArea = rawArea == null ? null : Math.max(rawArea - deductionArea, 0)
  const overrideArea = toNullableDraftNumber(segment.overrideAreaSqFt)

  return {
    rawArea,
    deductionArea,
    deductionAdjustedArea,
    effectiveArea: overrideArea ?? deductionAdjustedArea,
  }
}

export function deriveEstimateV2Scope(
  scope: EstimateV2WallScopeDraft,
  scopeSegments: EstimateV2WallSegmentDraft[]
): EstimateV2WallScopeDerived {
  if (scope.mode === 'RECT') {
    const perimeter = toNullableDraftNumber(scope.perimeterIn)
    const height = toNullableDraftNumber(scope.heightIn)
    const doorCount = toNullableDraftNumber(scope.standardDoorCount) ?? 0
    const windowCount = toNullableDraftNumber(scope.standardWindowCount) ?? 0
    const openingArea = doorCount * STANDARD_DOOR_DEDUCTION_SF + windowCount * STANDARD_WINDOW_DEDUCTION_SF
    const rawArea =
      perimeter != null && height != null ? Math.max((perimeter * height) / 144 - openingArea, 0) : null
    const overrideArea = toNullableDraftNumber(scope.overrideAreaSqFt)
    return {
      rawArea,
      effectiveArea: overrideArea ?? rawArea,
    }
  }

  const rawArea = sortByPosition(scopeSegments)
    .filter((segment) => segment.include === 'Y')
    .reduce((sum, segment) => sum + (deriveEstimateV2Segment(segment).effectiveArea ?? 0), 0)
  const overrideArea = toNullableDraftNumber(scope.overrideAreaSqFt)
  return {
    rawArea,
    effectiveArea: overrideArea ?? rawArea,
  }
}

export function buildEstimateV2SavePayload(
  jobSettingsDraft: EstimateV2JobSettingsDraft,
  rooms: EstimateV2RoomDraft[],
  scopes: EstimateV2WallScopeDraft[],
  segments: EstimateV2WallSegmentDraft[],
  roomFlags: EstimateV2RoomFlagDraft[],
  ceilingScopes: EstimateV2CeilingScopeDraft[],
  ceilingSegments: EstimateV2CeilingSegmentDraft[],
  trimScopes: EstimateV2TrimScopeDraft[],
  rollers: EstimateV2RollerDraft[] = []
): EstimateV2SavePayload {
  const jobsettings = {
    labor_day_policy_enabled: jobSettingsDraft.laborDayEnabled,
    dayhours: jobSettingsDraft.dayhours,
    rounding_increment_hours: jobSettingsDraft.roundingIncrementHours,
    override_labor_rate: jobSettingsDraft.laborRate,
    job_minimum_enabled: jobSettingsDraft.jobMinEnabled,
    job_minimum_amount: jobSettingsDraft.jobMinAmount,
    crew_size: normalizeCrewSize(jobSettingsDraft.crewSize),
    walls_paint_id: toNullableText(jobSettingsDraft.wallPaintProductId),
    walls_primer_id: toNullableText(jobSettingsDraft.wallPrimerProductId),
    ceiling_paint_id: toNullableText(jobSettingsDraft.ceilingPaintProductId),
    ceiling_primer_id: toNullableText(jobSettingsDraft.ceilingPrimerProductId),
    trim_paint_id: toNullableText(jobSettingsDraft.trimPaintProductId),
    trim_primer_id: toNullableText(jobSettingsDraft.trimPrimerProductId),
  }

  const orderedRooms = sortByPosition(rooms).map((room, index) => ({
    id: room.id,
    room_id: room.roomId,
    room_name: room.roomName.trim(),
    notes: room.notes.trim() || null,
    position: index,
    length_in: toNullableDraftNumber(room.lengthIn),
    width_in: toNullableDraftNumber(room.widthIn),
    wallheight_in: toNullableDraftNumber(room.heightIn),
    condition_selections: toPersistedConditionSelections(room.conditionSelections),
  }))

  const orderedScopes = orderedRooms.flatMap((room) =>
    sortByPosition(scopes.filter((scope) => scope.roomId === room.room_id)).map((scope, index) => {
      const scopeSegments = sortByPosition(segments.filter((segment) => segment.wallScopeId === scope.id))
      const derived = deriveEstimateV2Scope(scope, scopeSegments)
      return {
        id: scope.id,
        room_id: scope.roomId,
        position: index,
        mode: scope.mode,
        include: scope.include,
        scope_name: scope.scopeName.trim() || null,
        color_id: scope.colorId.trim() || null,
        paint_product_id: scope.paintProductId.trim() || null,
        primer_product_id: scope.primerProductId.trim() || null,
        prime_mode: scope.primeMode,
        height_in: toNullableDraftNumber(scope.heightIn),
        perimeter_in: scope.mode === 'RECT' ? toNullableDraftNumber(scope.perimeterIn) : null,
        standard_door_count: scope.mode === 'RECT' ? toNullableDraftNumber(scope.standardDoorCount) : null,
        standard_window_count: scope.mode === 'RECT' ? toNullableDraftNumber(scope.standardWindowCount) : null,
        height_factor: toNullableDraftNumber(scope.heightFactor),
        complexity_factor: toNullableDraftNumber(scope.complexityFactor),
        wall_flag_factor: toNullableDraftNumber(scope.wallFlagFactor),
        cut_in_top_factor: toNullableDraftNumber(scope.cutInTopFactor),
        cut_in_bottom_factor: toNullableDraftNumber(scope.cutInBottomFactor),
        paint_coats: toNullableDraftNumber(scope.paintCoats),
        primer_coats: toNullableDraftNumber(scope.primerCoats),
        spot_prime_percent: toNullableDraftNumber(scope.spotPrimePercent),
        raw_area_sf: derived.rawArea,
        override_area_sf: toNullableDraftNumber(scope.overrideAreaSqFt),
        effective_area_sf: derived.effectiveArea,
        raw_paint_hours: null,
        override_paint_hours: toNullableDraftNumber(scope.overridePaintHours),
        effective_paint_hours: null,
        raw_primer_hours: null,
        override_primer_hours: toNullableDraftNumber(scope.overridePrimerHours),
        effective_primer_hours: null,
        raw_paint_gallons: null,
        override_paint_gallons: toNullableDraftNumber(scope.overridePaintGallons),
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        override_primer_gallons: toNullableDraftNumber(scope.overridePrimerGallons),
        effective_primer_gallons: null,
        raw_supply_cost: null,
        override_supply_cost: toNullableDraftNumber(scope.overrideSupplyCost),
        effective_supply_cost: null,
        raw_total: null,
        override_total: toNullableDraftNumber(scope.overrideTotal),
        effective_total: null,
        notes: scope.notes.trim() || null,
        condition_selections: toPersistedConditionSelections(scope.conditionSelections),
      }
    })
  )

  const scopeIdSet = new Set(orderedScopes.map((scope) => scope.id))
  const orderedSegments = orderedScopes.flatMap((scope) =>
    sortByPosition(segments.filter((segment) => segment.wallScopeId === scope.id && scopeIdSet.has(segment.wallScopeId))).map(
      (segment, index) => {
        const derived = deriveEstimateV2Segment(segment)
        return {
          id: segment.id,
          wall_scope_id: segment.wallScopeId,
          room_id: segment.roomId,
          position: index,
          segment_name: segment.segmentName.trim() || null,
          include: segment.include,
          shape_type: segment.shapeType,
          quantity: toNullableDraftNumber(segment.quantity),
          width_in: segment.shapeType === 'RECTANGLE' ? toNullableDraftNumber(segment.widthIn) : null,
          height_in: segment.shapeType !== 'MANUAL' ? toNullableDraftNumber(segment.heightIn) : null,
          base_in: segment.shapeType === 'TRIANGLE' ? toNullableDraftNumber(segment.baseIn) : null,
          manual_area_sf: segment.shapeType === 'MANUAL' ? toNullableDraftNumber(segment.manualAreaSqFt) : null,
          standard_door_count: toNullableDraftNumber(segment.standardDoorCount),
          standard_window_count: toNullableDraftNumber(segment.standardWindowCount),
          raw_area_sf: derived.rawArea,
          override_area_sf: toNullableDraftNumber(segment.overrideAreaSqFt),
          effective_area_sf: derived.effectiveArea,
          notes: segment.notes.trim() || null,
        }
      }
    )
  )

  const orderedRoomFlags = [...roomFlags]
    .sort((a, b) => a.roomId.localeCompare(b.roomId) || a.position - b.position)
    .map((flag) => ({
      id: flag.id,
      room_id: flag.roomId,
      flag_id: flag.flagId,
      position: flag.position,
      active: 'Y' as const,
    }))

  const orderedCeilingScopes = orderedRooms.flatMap((room) =>
    sortByPosition(ceilingScopes.filter((scope) => scope.roomId === room.room_id)).map((scope, index) => ({
      id: scope.id,
      room_id: scope.roomId,
      position: index,
      mode: scope.mode,
      include: scope.include,
      scope_name: scope.scopeName.trim() || null,
      color_id: HIDDEN_CEILING_COLOR_ID,
      paint_product_id: scope.paintProductId.trim() || null,
      primer_product_id: scope.primerProductId.trim() || null,
      prime_mode: scope.primeMode,
      spot_prime_percent: toNullableDraftNumber(scope.spotPrimePercent),
      ceiling_type_id: scope.ceilingTypeId.trim() || null,
      length_in: scope.mode === 'RECT' ? room.length_in : null,
      width_in: scope.mode === 'RECT' ? room.width_in : null,
      area_sf: toNullableDraftNumber(scope.areaSf),
      height_factor: toNullableDraftNumber(scope.heightFactor),
      complexity_factor: toNullableDraftNumber(scope.complexityFactor),
      ceiling_flag_factor: toNullableDraftNumber(scope.ceilingFlagFactor),
      paint_coats: toNullableDraftNumber(scope.paintCoats),
      primer_coats: toNullableDraftNumber(scope.primerCoats),
      override_area_sf: toNullableDraftNumber(scope.overrideAreaSqFt),
      override_paint_hours: toNullableDraftNumber(scope.overridePaintHours),
      override_primer_hours: toNullableDraftNumber(scope.overridePrimerHours),
      override_paint_gallons: toNullableDraftNumber(scope.overridePaintGallons),
      override_primer_gallons: toNullableDraftNumber(scope.overridePrimerGallons),
      override_supply_cost: toNullableDraftNumber(scope.overrideSupplyCost),
      override_total: toNullableDraftNumber(scope.overrideTotal),
      notes: scope.notes.trim() || null,
      condition_selections: toPersistedConditionSelections(scope.conditionSelections),
    }))
  )

  const ceilingScopeIdSet = new Set(orderedCeilingScopes.map((scope) => scope.id))
  const orderedCeilingSegments = orderedCeilingScopes.flatMap((scope) =>
    sortByPosition(
      ceilingSegments.filter((seg) => seg.ceilingScopeId === scope.id && ceilingScopeIdSet.has(seg.ceilingScopeId))
    ).map((seg, index) => ({
      id: seg.id,
      ceiling_scope_id: seg.ceilingScopeId,
      room_id: seg.roomId,
      position: index,
      segment_name: seg.segmentName.trim() || null,
      include: seg.include,
      shape_type: seg.shapeType,
      quantity: toNullableDraftNumber(seg.quantity),
      width_in: seg.shapeType === 'RECTANGLE' ? toNullableDraftNumber(seg.widthIn) : null,
      height_in: seg.shapeType !== 'MANUAL' ? toNullableDraftNumber(seg.heightIn) : null,
      base_in: seg.shapeType === 'TRIANGLE' ? toNullableDraftNumber(seg.baseIn) : null,
      manual_area_sf: seg.shapeType === 'MANUAL' ? toNullableDraftNumber(seg.manualAreaSqFt) : null,
      override_area_sf: toNullableDraftNumber(seg.overrideAreaSqFt),
      notes: seg.notes.trim() || null,
    }))
  )

  const orderedTrimScopes = orderedRooms.flatMap((room) =>
    sortByPosition(trimScopes.filter((scope) => scope.roomId === room.room_id)).map((scope, index) => ({
      id: scope.id,
      room_id: scope.roomId,
      position: index,
      include: scope.include,
      scope_name: scope.scopeName.trim() || null,
      trim_type_id: scope.trimTypeId.trim() || null,
      trim_family: scope.trimFamily.trim() || null,
      unit_type: scope.unitType,
      measurement_mode: scope.measurementMode,
      helper_source: scope.measurementMode === 'ROOM_HELPER' ? 'ROOM_PERIMETER' : null,
      measurement_value: scope.measurementMode === 'MANUAL' ? toNullableDraftNumber(scope.measurementValue) : null,
      helper_value: scope.measurementMode === 'ROOM_HELPER' ? toNullableDraftNumber(scope.helperValue) : null,
      baseboard_opening_count: toNullableDraftNumber(scope.baseboardOpeningCount),
      color_id: scope.colorId.trim() || null,
      paint_product_id: null,
      primer_product_id: null,
      paint_enabled: scope.paintEnabled,
      prime_mode: scope.primeMode,
      spot_prime_percent: toNullableDraftNumber(scope.spotPrimePercent),
      production_rate_id: scope.productionRateId.trim() || null,
      prep_factor: toNullableDraftNumber(scope.prepFactor),
      height_factor: toNullableDraftNumber(scope.heightFactor),
      profile_factor: toNullableDraftNumber(scope.profileFactor),
      room_flag_factor: toNullableDraftNumber(scope.roomFlagFactor),
      masking_factor: toNullableDraftNumber(scope.maskingFactor),
      stair_factor: toNullableDraftNumber(scope.stairFactor),
      difficult_finish_factor: toNullableDraftNumber(scope.difficultFinishFactor),
      caulk_fill_factor: toNullableDraftNumber(scope.caulkFillFactor),
      paint_coats: toNullableDraftNumber(scope.paintCoats),
      primer_coats: toNullableDraftNumber(scope.primerCoats),
      override_measurement: null,
      override_hours: null,
      override_gallons: toNullableDraftNumber(scope.overrideGallons),
      override_supply_cost: null,
      override_total: null,
      override_description: null,
      notes: scope.notes.trim() || null,
      condition_selections: toPersistedConditionSelections(scope.conditionSelections),
    }))
  )

  const orderedRollers = sortByPosition(rollers)
    .map((roller, index) => ({
      id: roller.id,
      position: index,
      scope: roller.scope,
      wall_color_id:
        roller.scope === 'Wall' ? normalizeWallRollerTargetId(roller.wallColorId) || null : null,
      selected_option_id: roller.selectedOptionId?.trim() || null,
      roller_size_in: toNullableDraftNumber(roller.rollerSizeIn),
      covers_qty: normalizeRollerApplicatorQuantity(roller.coversQty).numberValue,
      notes: roller.notes.trim() || null,
    }))
    .filter((roller) => roller.scope === 'Ceiling' || roller.wall_color_id)

  return {
    jobsettings,
    rooms: orderedRooms,
    room_wall_scopes: orderedScopes,
    wall_segments: orderedSegments,
    room_flags: orderedRoomFlags,
    room_ceiling_scopes: orderedCeilingScopes,
    ceiling_scope_segments: orderedCeilingSegments,
    room_trim_scopes: orderedTrimScopes,
    rollers: orderedRollers,
  }
}
