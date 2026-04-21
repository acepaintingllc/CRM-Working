import { getEstimateCatalogs } from '@/lib/server/estimateCatalogs'
import { supabaseAdmin } from '@/lib/server/org'
import {
  toCeilingCalculationCatalogs,
  toTrimCalculationCatalogs,
  toWallCalculationCatalogs,
} from '@/lib/server/estimateV2RoutePayload'
import { asText, type UnsafeRecord } from '@/lib/estimator/parsing'

export async function loadEstimateV2CalculationCatalogs(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
}) {
  const catalogs = await getEstimateCatalogs({
    origin: params.requestOrigin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
  })
  const source = catalogs.catalogs as unknown as UnsafeRecord

  return {
    source,
    wall: toWallCalculationCatalogs(source),
    ceiling: toCeilingCalculationCatalogs(source),
    trim: toTrimCalculationCatalogs(source),
  }
}

export function resolveEstimateV2RoomModeById(params: {
  rooms: UnsafeRecord[]
  wallScopes: UnsafeRecord[]
  ceilingScopes: UnsafeRecord[]
}) {
  const roomMode = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of params.wallScopes) {
    const roomId = asText(scope.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(scope.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  for (const scope of params.ceilingScopes) {
    const roomId = asText(scope.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(scope.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  for (const room of params.rooms) {
    const roomId = asText(room.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(room.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  return roomMode
}

export async function loadEstimateV2RoomModesForTrimFromDb(params: {
  orgId: string
  estimateId: string
}) {
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
    rooms: (roomRes.data ?? []) as UnsafeRecord[],
    wallScopes: (wallRes.data ?? []) as UnsafeRecord[],
    ceilingScopes: (ceilingRes.data ?? []) as UnsafeRecord[],
  })
}
