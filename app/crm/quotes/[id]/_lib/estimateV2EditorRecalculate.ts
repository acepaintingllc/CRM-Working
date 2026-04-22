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
  stripInvalidTrimHelperModeMutation,
} from './estimateV2EditorMutations.ts'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2CatalogsPayload,
  EstimateV2RoomDraft,
  EstimateV2RoomFlagDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2TrimTypeOption,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'

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
  roomHeightFactorByRoomId: Map<string, string>
  roomComplexityFactorByRoomId: Map<string, string>
  roomWallFlagFactorByRoomId: Map<string, string>
}) {
  return params.scopes.map((scope) => ({
    ...scope,
    heightFactor: params.roomHeightFactorByRoomId.get(scope.roomId) ?? '1',
    complexityFactor: params.roomComplexityFactorByRoomId.get(scope.roomId) ?? '1',
    wallFlagFactor: params.roomWallFlagFactorByRoomId.get(scope.roomId) ?? '1',
  }))
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
  trimTypeOptions: EstimateV2TrimTypeOption[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  roomHeightFactorByRoomId: Map<string, string>
  roomTrimFlagFactorByRoomId: Map<string, string>
}) {
  const nextScopes = params.scopes.map((scope) => {
    const typeMeta = params.trimTypeOptions.find((item) => item.id === scope.trimTypeId)
    return {
      ...scope,
      heightFactor: isCrownTrimType(typeMeta, scope)
        ? params.roomHeightFactorByRoomId.get(scope.roomId) ?? '1'
        : scope.heightFactor,
      roomFlagFactor: params.roomTrimFlagFactorByRoomId.get(scope.roomId) ?? '1',
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
      trimTypeOptions: params.trimTypeOptions,
      roomModeById,
      roomHeightFactorByRoomId,
      roomTrimFlagFactorByRoomId,
    }),
    roomModeById,
  }
}
