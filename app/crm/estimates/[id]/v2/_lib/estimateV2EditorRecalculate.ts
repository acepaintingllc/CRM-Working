import {
  buildProductionRateById,
  buildRoomFlagById,
  buildRoomComplexityFactorByRoomId,
  buildRoomFlagFactorByRoomId,
  buildRoomHeightFactorByRoomId,
} from './estimateV2EditorDerived.ts'
import {
  isCrownTrimType,
  resolveRoomModeById,
} from './estimateV2EditorNormalize.ts'
import {
  syncWallCutInFromTrayCeilings,
  stripInvalidTrimHelperModeMutation,
} from './estimateV2EditorMutations.ts'
import {
  isV2TrimRoomHelperEligible,
  resolveV2TrimRoomPerimeterLf,
  V2_TRIM_ROOM_HELPER_SOURCE,
} from '../../../../../../lib/estimator/v2TrimActivation.ts'
import type {
  EstimateV2CatalogsPayload,
  EstimateV2TrimTypeOption,
} from '@/types/estimator/v2Catalogs'
import type { EstimateV2RoomDraft, EstimateV2RoomFlagDraft } from '@/types/estimator/v2Rooms'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2Scopes'

type RecalculateDraftFactorsParams = {
  rooms: EstimateV2RoomDraft[]
  wallScopes: EstimateV2WallScopeDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  roomFlags: EstimateV2RoomFlagDraft[]
  catalogs: EstimateV2CatalogsPayload['catalogs']
  trimTypeOptions: EstimateV2TrimTypeOption[]
}

function synchronizeWallScopes(params: {
  scopes: EstimateV2WallScopeDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  roomHeightFactorByRoomId: Map<string, string>
  roomComplexityFactorByRoomId: Map<string, string>
  roomWallFlagFactorByRoomId: Map<string, string>
}) {
  const nextScopes = params.scopes.map((scope) => ({
    ...scope,
    heightFactor: params.roomHeightFactorByRoomId.get(scope.roomId) ?? '1',
    complexityFactor: params.roomComplexityFactorByRoomId.get(scope.roomId) ?? '1',
    wallFlagFactor: params.roomWallFlagFactorByRoomId.get(scope.roomId) ?? '1',
  }))
  return syncWallCutInFromTrayCeilings({
    wallScopes: nextScopes,
    ceilingScopes: params.ceilingScopes,
  })
}

function synchronizeCeilingScopes(params: {
  scopes: EstimateV2CeilingScopeDraft[]
  roomHeightFactorByRoomId: Map<string, string>
  roomComplexityFactorByRoomId: Map<string, string>
  roomCeilingFlagFactorByRoomId: Map<string, string>
}) {
  return params.scopes.map((scope) => ({
    ...scope,
    heightFactor: params.roomHeightFactorByRoomId.get(scope.roomId) ?? '1',
    complexityFactor: params.roomComplexityFactorByRoomId.get(scope.roomId) ?? '1',
    ceilingFlagFactor: params.roomCeilingFlagFactorByRoomId.get(scope.roomId) ?? '1',
  }))
}

function synchronizeTrimScopes(params: {
  scopes: EstimateV2TrimScopeDraft[]
  rooms: EstimateV2RoomDraft[]
  trimTypeOptions: EstimateV2TrimTypeOption[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  roomHeightFactorByRoomId: Map<string, string>
  roomTrimFlagFactorByRoomId: Map<string, string>
}) {
  const roomById = new Map(params.rooms.map((room) => [room.roomId, room] as const))
  const nextScopes = params.scopes.map((scope) => {
    const typeMeta = params.trimTypeOptions.find((item) => item.id === scope.trimTypeId)
    const roomMode = params.roomModeById.get(scope.roomId) ?? 'RECT'
    const shouldUseRoomPerimeter =
      scope.measurementMode === 'ROOM_HELPER' &&
      scope.helperSource === V2_TRIM_ROOM_HELPER_SOURCE &&
      isV2TrimRoomHelperEligible({
        roomMode,
        trimTypeHelperAllowed: !!typeMeta?.helper_allowed,
      })
    const roomPerimeter = shouldUseRoomPerimeter
      ? resolveV2TrimRoomPerimeterLf(roomById.get(scope.roomId))
      : ''
    return {
      ...scope,
      heightFactor: isCrownTrimType(typeMeta, scope)
        ? params.roomHeightFactorByRoomId.get(scope.roomId) ?? '1'
        : scope.heightFactor,
      roomFlagFactor: params.roomTrimFlagFactorByRoomId.get(scope.roomId) ?? '1',
      helperValue: roomPerimeter || scope.helperValue,
    }
  })

  return stripInvalidTrimHelperModeMutation({
    scopes: nextScopes,
    roomModeById: params.roomModeById,
    trimTypeOptions: params.trimTypeOptions,
  })
}

export function recalculateEditorDraftFactors(params: RecalculateDraftFactorsParams) {
  const wallProductionRates = (params.catalogs.production_rates ?? []).filter(
    (option) => `${option.scope_id ?? ''}`.toUpperCase() === 'WALLS'
  )
  const wallProductionRateById = buildProductionRateById(wallProductionRates)
  const roomFlagById = buildRoomFlagById(params.catalogs.room_flags ?? [])
  const roomHeightFactorByRoomId = buildRoomHeightFactorByRoomId(
    params.rooms,
    params.catalogs.height_factors ?? []
  )
  const roomComplexityFactorByRoomId = buildRoomComplexityFactorByRoomId(
    params.rooms,
    wallProductionRateById
  )
  const roomWallFlagFactorByRoomId = buildRoomFlagFactorByRoomId(
    params.rooms,
    params.roomFlags,
    roomFlagById,
    'wall_factor'
  )
  const roomCeilingFlagFactorByRoomId = buildRoomFlagFactorByRoomId(
    params.rooms,
    params.roomFlags,
    roomFlagById,
    'ceil_factor'
  )
  const roomTrimFlagFactorByRoomId = buildRoomFlagFactorByRoomId(
    params.rooms,
    params.roomFlags,
    roomFlagById,
    'trim_factor'
  )
  const roomModeById = resolveRoomModeById({
    rooms: params.rooms,
    wallScopes: params.wallScopes,
    ceilingScopes: params.ceilingScopes,
  })

  return {
    wallScopes: synchronizeWallScopes({
      scopes: params.wallScopes,
      ceilingScopes: params.ceilingScopes,
      roomHeightFactorByRoomId,
      roomComplexityFactorByRoomId,
      roomWallFlagFactorByRoomId,
    }),
    ceilingScopes: synchronizeCeilingScopes({
      scopes: params.ceilingScopes,
      roomHeightFactorByRoomId,
      roomComplexityFactorByRoomId,
      roomCeilingFlagFactorByRoomId,
    }),
    trimScopes: synchronizeTrimScopes({
      scopes: params.trimScopes,
      rooms: params.rooms,
      trimTypeOptions: params.trimTypeOptions,
      roomModeById,
      roomHeightFactorByRoomId,
      roomTrimFlagFactorByRoomId,
    }),
    roomModeById,
  }
}
