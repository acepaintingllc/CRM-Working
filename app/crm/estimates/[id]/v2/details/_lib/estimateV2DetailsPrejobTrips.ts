import { calculatePrejobTrips } from '@/lib/estimator/prejobTrips'
import type { EstimateV2RoomDraft } from '@/types/estimator/v2Rooms'
import type { EstimateV2PrejobTripDraft } from '@/types/estimator/v2Scopes'

export type DetailsPrejobTripsVm = {
  rows: Array<EstimateV2PrejobTripDraft & {
    roomLabel: string
    effectiveTotal: number
  }>
  roomOptions: Array<{ id: string; label: string }>
  total: number
}

export function createPrejobTripDraftId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `prejob-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function addPrejobTripDraft(
  rows: EstimateV2PrejobTripDraft[],
  createId: () => string = createPrejobTripDraftId
) {
  return [
    ...rows,
    {
      id: createId(),
      roomId: '',
      tripName: 'Prejob prep trip',
      tripCount: '1',
      tripRate: '',
      manualAdjustment: '',
      notes: '',
      position: rows.length,
      include: 'Y' as const,
    },
  ]
}

export function updatePrejobTripDraft(
  rows: EstimateV2PrejobTripDraft[],
  rowId: string,
  patch: Partial<EstimateV2PrejobTripDraft>
) {
  return rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
}

export function removePrejobTripDraft(rows: EstimateV2PrejobTripDraft[], rowId: string) {
  return rows
    .filter((row) => row.id !== rowId)
    .map((row, index) => ({ ...row, position: index }))
}

export function buildEstimateV2DetailsPrejobTripsVm(params: {
  prejobTrips: EstimateV2PrejobTripDraft[]
  rooms: Array<Pick<EstimateV2RoomDraft, 'roomId' | 'roomName'>>
}): DetailsPrejobTripsVm {
  const calculated = calculatePrejobTrips({
    rows: params.prejobTrips.map((row) => ({
      id: row.id,
      room_id: row.roomId,
      position: row.position,
      active: row.include,
      trip_name: row.tripName,
      trip_num: row.tripCount,
      trip_rate: row.tripRate,
      manual_adjustment: row.manualAdjustment,
      notes: row.notes,
    })),
  })
  const calculatedById = new Map(calculated.scopes.map((row) => [row.id, row]))
  const roomsById = new Map(params.rooms.map((room) => [room.roomId, room.roomName]))

  return {
    rows: params.prejobTrips.map((row) => ({
      ...row,
      roomLabel: row.roomId ? roomsById.get(row.roomId) ?? row.roomId : 'Job level',
      effectiveTotal: calculatedById.get(row.id)?.effective_total ?? 0,
    })),
    roomOptions: params.rooms.map((room) => ({ id: room.roomId, label: room.roomName || room.roomId })),
    total: calculated.scopes.reduce((sum, row) => sum + row.effective_total, 0),
  }
}
