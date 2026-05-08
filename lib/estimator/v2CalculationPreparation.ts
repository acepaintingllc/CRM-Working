import { normalizeConditionSelections, resolveConditionFactor, type EstimateV2ConditionScope } from './conditionModifiers.ts'
import { asNullableNumber, asText } from './parsing.ts'
import {
  applyBaseCeilingProductionRates,
  applySelectedWallProductionRates,
  type EstimatorV2ProductionRateRow,
} from './v2CalculationShared.ts'
import type { CeilingCalculationInput, CeilingCalculationScopeRow } from './ceilingTypes.ts'
import type { TrimCalculationInput, TrimCalculationRoomInput, TrimCalculationScopeRow } from './trimTypes.ts'
import type { WallCalculationCatalogs, WallCalculationInput, WallCalculationScopeRow } from './wallsTypes.ts'
import type { DoorCalculationInput, DoorCalculationScopeRow } from '@/types/estimator/doors'

type PaintProductRow = {
  paint_product_id?: string | null
  primer_product_id?: string | null
}

type RoomConditionSelectionRow = {
  room_id: string
  condition_selections?: unknown
}

type RoomModeRow = {
  room_id: string
  length_in: number | null
  width_in: number | null
}

type WallProductionRateRoomRow = {
  room_id?: unknown
  wall_complexity_id?: unknown
  wall_complexity_type_id?: unknown
}

export type EstimateV2CalculationPreparationCatalogs = {
  source: {
    production_rates?: EstimatorV2ProductionRateRow[] | null
  }
  wall: WallCalculationCatalogs
  ceiling?: CeilingCalculationInput['catalogs'] | null
  trim?: TrimCalculationInput['catalogs'] | null
  door?: DoorCalculationInput['catalogs'] | null
}

export type ProductDefaultRestoration<TRow extends PaintProductRow> = {
  rows: TRow[]
  restorePersistedProductIds<TResult extends PaintProductRow>(rows: TResult[]): TResult[]
}

export type PreparedPaintScopeRows<TRow extends PaintProductRow> = {
  rows: TRow[]
  productDefaults: ProductDefaultRestoration<TRow>
}

export type PreparedWallCalculationInput = PreparedPaintScopeRows<WallCalculationScopeRow> & {
  segments: WallCalculationInput['segments']
}

export type PreparedCeilingCalculationInput = PreparedPaintScopeRows<CeilingCalculationScopeRow> & {
  segments: CeilingCalculationInput['segments']
}

export type PreparedTrimCalculationInput = PreparedPaintScopeRows<TrimCalculationScopeRow> & {
  rooms: TrimCalculationRoomInput[]
}

export type PreparedDoorCalculationInput = PreparedPaintScopeRows<DoorCalculationScopeRow>

export type PreparedEstimateV2CalculationInputs = {
  conditionSelectionsByRoomId: ReturnType<typeof createRoomConditionSelectionMap>
  walls: PreparedWallCalculationInput
  ceilings: PreparedCeilingCalculationInput
  trim: PreparedTrimCalculationInput
  doors: PreparedDoorCalculationInput
}

function productionRatesFromCatalogs(catalogs: EstimateV2CalculationPreparationCatalogs) {
  return Array.isArray(catalogs.source.production_rates) ? catalogs.source.production_rates : []
}

export function createRoomConditionSelectionMap(rooms: RoomConditionSelectionRow[]) {
  const result = new Map<string, ReturnType<typeof normalizeConditionSelections>>()
  for (const room of rooms) {
    const roomId = asText(room.room_id).toUpperCase()
    if (roomId) result.set(roomId, normalizeConditionSelections(room.condition_selections))
  }
  return result
}

export function resolveCombinedConditionFactor(params: {
  catalogs: Pick<EstimateV2CalculationPreparationCatalogs, 'wall'>
  roomSelectionsById: ReturnType<typeof createRoomConditionSelectionMap>
  roomId: string
  scope: EstimateV2ConditionScope
  selections: unknown
}) {
  const catalog = params.catalogs.wall?.condition_modifiers ?? []
  const factor =
    resolveConditionFactor({
      catalog,
      scope: 'room',
      selections: params.roomSelectionsById.get(asText(params.roomId).toUpperCase()),
    }) *
    resolveConditionFactor({
      catalog,
      scope: params.scope,
      selections: normalizeConditionSelections(params.selections),
    })
  return factor === 1 ? null : factor
}

function resolveDoorConditionFactor(params: {
  catalogs: Pick<EstimateV2CalculationPreparationCatalogs, 'wall'>
  roomSelectionsById: ReturnType<typeof createRoomConditionSelectionMap>
  roomId: string
  persistedConditionFactor: unknown
}) {
  const roomFactor = resolveConditionFactor({
    catalog: params.catalogs.wall?.condition_modifiers ?? [],
    scope: 'room',
    selections: params.roomSelectionsById.get(asText(params.roomId).toUpperCase()),
  })
  const doorFactor = asNullableNumber(params.persistedConditionFactor)
  if (doorFactor != null && doorFactor > 0 && doorFactor !== 1) return doorFactor
  return roomFactor === 1 ? null : roomFactor
}

export function applyEffectiveProductDefaults<TRow extends PaintProductRow>(params: {
  rows: TRow[]
  defaultPaintProductId: string | null
  defaultPrimerProductId: string | null
}): ProductDefaultRestoration<TRow> {
  const persistedProductIds = params.rows.map((row) => ({
    paint_product_id: row.paint_product_id || null,
    primer_product_id: row.primer_product_id || null,
  }))
  return {
    rows: params.rows.map((row) => ({
      ...row,
      paint_product_id: row.paint_product_id || params.defaultPaintProductId,
      primer_product_id: row.primer_product_id || params.defaultPrimerProductId,
    })),
    restorePersistedProductIds<TResult extends PaintProductRow>(rows: TResult[]) {
      return rows.map((row, index) => {
        const persisted = persistedProductIds[index]
        if (!persisted) return row
        return {
          ...row,
          paint_product_id: persisted.paint_product_id,
          primer_product_id: persisted.primer_product_id,
        }
      })
    },
  }
}

export function prepareWallCalculationInput(params: {
  rooms: WallProductionRateRoomRow[]
  scopes: WallCalculationScopeRow[]
  segments: WallCalculationInput['segments']
  catalogs: EstimateV2CalculationPreparationCatalogs
  roomSelectionsById: ReturnType<typeof createRoomConditionSelectionMap>
  defaultPaintProductId: string | null
  defaultPrimerProductId: string | null
}): PreparedWallCalculationInput {
  const scopesWithProductionRates = applySelectedWallProductionRates({
    rooms: params.rooms,
    scopes: params.scopes,
    productionRates: productionRatesFromCatalogs(params.catalogs),
  })
  const productDefaults = applyEffectiveProductDefaults({
    rows: scopesWithProductionRates,
    defaultPaintProductId: params.defaultPaintProductId,
    defaultPrimerProductId: params.defaultPrimerProductId,
  })
  return {
    rows: productDefaults.rows.map((row) => ({
      ...row,
      condition_factor: resolveCombinedConditionFactor({
        catalogs: params.catalogs,
        roomSelectionsById: params.roomSelectionsById,
        roomId: row.room_id,
        scope: 'wall',
        selections: row.condition_selections,
      }),
    })),
    segments: params.segments,
    productDefaults,
  }
}

export function prepareCeilingCalculationInput(params: {
  scopes: CeilingCalculationScopeRow[]
  segments: CeilingCalculationInput['segments']
  catalogs: EstimateV2CalculationPreparationCatalogs
  roomSelectionsById: ReturnType<typeof createRoomConditionSelectionMap>
  defaultPaintProductId: string | null
  defaultPrimerProductId: string | null
}): PreparedCeilingCalculationInput {
  const scopesWithProductionRates = applyBaseCeilingProductionRates({
    scopes: params.scopes,
    productionRates: productionRatesFromCatalogs(params.catalogs),
  })
  const productDefaults = applyEffectiveProductDefaults({
    rows: scopesWithProductionRates,
    defaultPaintProductId: params.defaultPaintProductId,
    defaultPrimerProductId: params.defaultPrimerProductId,
  })
  return {
    rows: productDefaults.rows.map((row) => ({
      ...row,
      condition_factor: resolveCombinedConditionFactor({
        catalogs: params.catalogs,
        roomSelectionsById: params.roomSelectionsById,
        roomId: row.room_id,
        scope: 'ceiling',
        selections: row.condition_selections,
      }),
    })),
    segments: params.segments,
    productDefaults,
  }
}

export function prepareTrimRoomCalculationInputs(params: {
  rooms: RoomModeRow[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
}): TrimCalculationRoomInput[] {
  return params.rooms.map((row) => {
    const roomId = asText(row.room_id).toUpperCase()
    return {
      room_id: roomId,
      length_in: row.length_in,
      width_in: row.width_in,
      mode: params.roomModeById.get(roomId) ?? 'RECT',
    }
  })
}

export function prepareTrimCalculationInput(params: {
  rooms: RoomModeRow[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  scopes: TrimCalculationScopeRow[]
  catalogs: EstimateV2CalculationPreparationCatalogs
  roomSelectionsById: ReturnType<typeof createRoomConditionSelectionMap>
  defaultPaintProductId: string | null
  defaultPrimerProductId: string | null
}): PreparedTrimCalculationInput {
  const productDefaults = applyEffectiveProductDefaults({
    rows: params.scopes,
    defaultPaintProductId: params.defaultPaintProductId,
    defaultPrimerProductId: params.defaultPrimerProductId,
  })
  return {
    rows: productDefaults.rows.map((row) => ({
      ...row,
      condition_factor: resolveCombinedConditionFactor({
        catalogs: params.catalogs,
        roomSelectionsById: params.roomSelectionsById,
        roomId: row.room_id,
        scope: 'trim',
        selections: row.condition_selections,
      }),
    })),
    rooms: prepareTrimRoomCalculationInputs({
      rooms: params.rooms,
      roomModeById: params.roomModeById,
    }),
    productDefaults,
  }
}

export function prepareDoorCalculationInput(params: {
  scopes: DoorCalculationScopeRow[]
  catalogs: EstimateV2CalculationPreparationCatalogs
  roomSelectionsById: ReturnType<typeof createRoomConditionSelectionMap>
  defaultPaintProductId: string | null
  defaultPrimerProductId: string | null
}): PreparedDoorCalculationInput {
  const productDefaults = applyEffectiveProductDefaults({
    rows: params.scopes,
    defaultPaintProductId: params.defaultPaintProductId,
    defaultPrimerProductId: params.defaultPrimerProductId,
  })
  return {
    rows: productDefaults.rows.map((row) => ({
      ...row,
      condition_factor: resolveDoorConditionFactor({
        catalogs: params.catalogs,
        roomSelectionsById: params.roomSelectionsById,
        roomId: row.room_id,
        persistedConditionFactor: row.condition_factor,
      }),
    })),
    productDefaults,
  }
}

export function prepareEstimateV2CalculationInputs(params: {
  rooms: Array<RoomConditionSelectionRow & WallProductionRateRoomRow & RoomModeRow>
  roomWallScopes: WallCalculationScopeRow[]
  wallSegments: WallCalculationInput['segments']
  roomCeilingScopes: CeilingCalculationScopeRow[]
  ceilingScopeSegments: CeilingCalculationInput['segments']
  roomTrimScopes: TrimCalculationScopeRow[]
  roomDoorScopes: DoorCalculationScopeRow[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  catalogs: EstimateV2CalculationPreparationCatalogs
  defaults: {
    wallPaintProductId: string | null
    wallPrimerProductId: string | null
    ceilingPaintProductId: string | null
    ceilingPrimerProductId: string | null
    trimPaintProductId: string | null
    trimPrimerProductId: string | null
  }
}): PreparedEstimateV2CalculationInputs {
  const conditionSelectionsByRoomId = createRoomConditionSelectionMap(params.rooms)
  return {
    conditionSelectionsByRoomId,
    walls: prepareWallCalculationInput({
      rooms: params.rooms,
      scopes: params.roomWallScopes,
      segments: params.wallSegments,
      catalogs: params.catalogs,
      roomSelectionsById: conditionSelectionsByRoomId,
      defaultPaintProductId: params.defaults.wallPaintProductId,
      defaultPrimerProductId: params.defaults.wallPrimerProductId,
    }),
    ceilings: prepareCeilingCalculationInput({
      scopes: params.roomCeilingScopes,
      segments: params.ceilingScopeSegments,
      catalogs: params.catalogs,
      roomSelectionsById: conditionSelectionsByRoomId,
      defaultPaintProductId: params.defaults.ceilingPaintProductId,
      defaultPrimerProductId: params.defaults.ceilingPrimerProductId,
    }),
    trim: prepareTrimCalculationInput({
      rooms: params.rooms,
      roomModeById: params.roomModeById,
      scopes: params.roomTrimScopes,
      catalogs: params.catalogs,
      roomSelectionsById: conditionSelectionsByRoomId,
      defaultPaintProductId: params.defaults.trimPaintProductId,
      defaultPrimerProductId: params.defaults.trimPrimerProductId,
    }),
    doors: prepareDoorCalculationInput({
      scopes: params.roomDoorScopes,
      catalogs: params.catalogs,
      roomSelectionsById: conditionSelectionsByRoomId,
      defaultPaintProductId: params.defaults.trimPaintProductId,
      defaultPrimerProductId: params.defaults.trimPrimerProductId,
    }),
  }
}
