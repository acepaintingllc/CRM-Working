import {
  resolveEstimatorV2RoomModeById,
  toCeilingCalculationCatalogs,
  toDoorCalculationCatalogs,
  toDrywallCalculationCatalogs,
  toTrimCalculationCatalogs,
  toWallCalculationCatalogs,
} from '../estimator/v2CalculationShared.ts'
import { asText, type UnsafeRecord } from '../estimator/parsing.ts'
import type {
  EstimatorV2RoomModeRoom,
  EstimatorV2RoomModeScope,
} from '../estimator/v2CalculationShared.ts'

function toCatalogBlob(value: unknown): UnsafeRecord {
  return value && typeof value === 'object' ? (value as UnsafeRecord) : {}
}

function toRoomModeValue(value: unknown): EstimatorV2RoomModeRoom['mode'] {
  const mode = asText(value).toUpperCase()
  if (mode === 'SEG' || mode === 'RECT') return mode
  return null
}

function toRoomModeRows(rows: unknown): EstimatorV2RoomModeRoom[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    const record = row && typeof row === 'object' ? (row as UnsafeRecord) : null
    const roomId = asText(record?.room_id).toUpperCase()
    return roomId ? [{ room_id: roomId, mode: toRoomModeValue(record?.mode) }] : []
  })
}

function toRoomModeScopeRows(rows: unknown): EstimatorV2RoomModeScope[] {
  return toRoomModeRows(rows)
}

export async function loadEstimateV2CalculationCatalogs(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
}) {
  const { getEstimateCatalogs } = await import('./estimateCatalogs.ts')
  const catalogs = await getEstimateCatalogs({
    origin: params.requestOrigin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
  })
  const source = toCatalogBlob(catalogs.catalogs)

  return {
    source,
    wall: toWallCalculationCatalogs(source),
    ceiling: toCeilingCalculationCatalogs(source),
    trim: toTrimCalculationCatalogs(source),
    door: toDoorCalculationCatalogs(source),
    drywall: toDrywallCalculationCatalogs(source),
  }
}

export function resolveEstimateV2RoomModeById(params: {
  rooms: EstimatorV2RoomModeRoom[]
  wallScopes: EstimatorV2RoomModeScope[]
  ceilingScopes: EstimatorV2RoomModeScope[]
}) {
  return resolveEstimatorV2RoomModeById({ ...params, useRoomMode: true })
}

export async function loadEstimateV2RoomModesForTrimFromDb(params: {
  orgId: string
  estimateId: string
}) {
  const { supabaseAdmin } = await import('./org.ts')
  const [roomRes, wallRes, ceilingRes] = await Promise.all([
    supabaseAdmin
      .from('estimate_rooms')
      .select('room_id, mode')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId),
    supabaseAdmin
      .from('estimate_room_wall_scopes')
      .select('room_id, mode')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y'),
    supabaseAdmin
      .from('estimate_room_ceiling_scopes')
      .select('room_id, mode')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y'),
  ])
  if (roomRes.error) throw new Error(roomRes.error.message)
  if (wallRes.error) throw new Error(wallRes.error.message)
  if (ceilingRes.error) throw new Error(ceilingRes.error.message)

  return resolveEstimateV2RoomModeById({
    rooms: toRoomModeRows(roomRes.data),
    wallScopes: toRoomModeScopeRows(wallRes.data),
    ceilingScopes: toRoomModeScopeRows(ceilingRes.data),
  })
}
