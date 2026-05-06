import { calculateCeilings } from './ceilings.ts'
import { calculateDoors } from './doors.ts'
import { calculateDrywallRepairs } from './drywall.ts'
import { calculateOtherItems } from './other.ts'
import { calculateTrim } from './trim.ts'
import { calculateWalls } from './walls.ts'
import { asText, type UnsafeRecord as Unsafe } from './parsing.ts'
import {
  applyBaseCeilingProductionRates,
  applySelectedWallProductionRates,
  buildEstimatorV2CalculationSettings,
  buildEstimatorV2PricingSummary,
  buildTrimPaintInput,
  calculateEstimatorV2AccessFees,
  productMapFromWallCatalog,
  resolveEstimatorV2EffectiveJobSettings,
  resolveEstimatorV2RoomModeById,
  toCeilingCalculationCatalogs,
  toDoorCalculationCatalogs,
  toDrywallCalculationCatalogs,
  toTrimCalculationCatalogs,
  toWallCalculationCatalogs,
} from './v2CalculationShared.ts'
import type { CeilingCalculationScopeRow } from './ceilingTypes.ts'
import type {
  EstimateV2Catalogs,
  EstimateV2JobSettingsInput,
  EstimateV2SavePayload,
} from '@/types/estimator/v2'
import type { WallCalculationScopeRow } from './wallsTypes.ts'

type PreviewCatalogs = EstimateV2Catalogs & {
  supplies_rates?: Unsafe[]
}

export function calculateEstimateV2Preview(params: {
  payload: EstimateV2SavePayload
  catalogs: EstimateV2Catalogs
  orgDefaults?: EstimateV2JobSettingsInput | null
}) {
  const catalogs = params.catalogs as PreviewCatalogs
  const effectiveSettings = resolveEstimatorV2EffectiveJobSettings({
    jobsettings: params.payload.jobsettings as unknown as Unsafe,
    orgDefaults: params.orgDefaults as unknown as Unsafe | null | undefined,
  })
  const settings = buildEstimatorV2CalculationSettings(effectiveSettings)
  const roomModes = resolveEstimatorV2RoomModeById({
    rooms: params.payload.rooms as unknown as Unsafe[],
    wallScopes: params.payload.room_wall_scopes as unknown as Unsafe[],
    ceilingScopes: params.payload.room_ceiling_scopes as unknown as Unsafe[],
  })
  const productionRates = catalogs.production_rates ?? []

  const wallScopes = applySelectedWallProductionRates({
    rooms: params.payload.rooms,
    scopes: params.payload.room_wall_scopes.map((scope) => ({
      ...scope,
      paint_product_id: asText(scope.paint_product_id) || effectiveSettings.walls_paint_id,
      primer_product_id: asText(scope.primer_product_id) || effectiveSettings.walls_primer_id,
    })) as unknown as WallCalculationScopeRow[],
    productionRates,
  })
  const ceilingScopes = applyBaseCeilingProductionRates({
    scopes: params.payload.room_ceiling_scopes.map((scope) => ({
      ...scope,
      paint_product_id: asText(scope.paint_product_id) || effectiveSettings.ceiling_paint_id,
      primer_product_id: asText(scope.primer_product_id) || effectiveSettings.ceiling_primer_id,
    })) as unknown as CeilingCalculationScopeRow[],
    productionRates,
  })
  const trimScopes = params.payload.room_trim_scopes.map((scope) => ({
    ...scope,
    paint_product_id: asText(scope.paint_product_id) || effectiveSettings.trim_paint_id,
    primer_product_id: asText(scope.primer_product_id) || effectiveSettings.trim_primer_id,
  }))
  const doorScopes = (params.payload.room_door_scopes ?? []).map((scope) => ({
    ...scope,
    paint_product_id: asText(scope.paint_product_id) || effectiveSettings.trim_paint_id,
    primer_product_id: asText(scope.primer_product_id) || effectiveSettings.trim_primer_id,
  }))

  const wallCatalogs = toWallCalculationCatalogs(catalogs)
  const walls = calculateWalls({
    scopes: wallScopes,
    segments: params.payload.wall_segments as never,
    settings,
    catalogs: wallCatalogs,
  })
  const ceilings = calculateCeilings({
    scopes: ceilingScopes,
    segments: params.payload.ceiling_scope_segments as never,
    settings,
    catalogs: toCeilingCalculationCatalogs(catalogs),
  })
  const trim = calculateTrim({
    scopes: trimScopes as never,
    rooms: params.payload.rooms.map((room) => ({
      room_id: room.room_id,
      length_in: room.length_in,
      width_in: room.width_in,
      mode: roomModes.get(room.room_id) ?? 'RECT',
    })),
    settings,
    catalogs: toTrimCalculationCatalogs(catalogs),
  })
  const doors = calculateDoors({
    scopes: doorScopes as never,
    settings,
    catalogs: toDoorCalculationCatalogs(catalogs),
  })
  const drywall = calculateDrywallRepairs({
    repairs: (params.payload.drywall_repairs ?? []) as never,
    catalogs: toDrywallCalculationCatalogs(catalogs),
  })
  const other = calculateOtherItems({
    rows: (params.payload.other ?? []) as never,
    settings: { labor_rate_per_hour: settings.labor_rate_per_hour },
  })
  const accessFees = calculateEstimatorV2AccessFees({
    rows: (params.payload.access_fees ?? []) as unknown as Unsafe[],
    catalog: (catalogs.access_fees ?? []) as never,
  })
  const trimPaintProductMap = productMapFromWallCatalog(wallCatalogs)
  const trimPaint = buildTrimPaintInput({
    jobsettings: params.payload.jobsettings as unknown as Unsafe,
    productId: effectiveSettings.trim_paint_id,
    product: effectiveSettings.trim_paint_id ? trimPaintProductMap.get(effectiveSettings.trim_paint_id) : null,
  })
  const pricingSummary = buildEstimatorV2PricingSummary({
    engines: [
      { kind: 'walls', output: walls },
      { kind: 'ceilings', output: ceilings },
      { kind: 'trim', output: trim },
      { kind: 'doors', output: doors },
      { kind: 'drywall', output: drywall },
      { kind: 'other', output: other },
    ],
    settings: effectiveSettings,
    wallCatalogs,
    accessFeeTotal: accessFees.total,
    wallRoomTotals: walls.room_totals,
    ceilingRoomTotals: ceilings.room_totals,
    trimRoomTotals: trim.room_totals,
    wallScopes: walls.scopes,
    ceilingScopes: ceilings.scopes,
    trimScopes: trim.scopes,
    sourceTrimScopes: params.payload.room_trim_scopes as unknown as Unsafe[],
    trimPaintInput: trimPaint,
  })

  return {
    walls,
    ceilings,
    trim,
    doors,
    drywall,
    other,
    accessFees,
    pricingSummary,
    trimPaint,
  }
}
