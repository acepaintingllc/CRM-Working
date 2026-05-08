import type { EstimateRoomPersistenceRow } from './persistenceTypes.ts'

export function buildV2RoomPersistenceRow(row: {
  id?: string
  org_id: string
  estimate_id: string
  job_id: string
  position: number
  room_id: string
  room_name: string
  room_type_id: string | null
  wall_complexity_id: string | null
  notes: string | null
  length_in: number | null
  width_in: number | null
  wallheight_in: number | null
  condition_selections: unknown
}): EstimateRoomPersistenceRow {
  return {
    id: row.id,
    org_id: row.org_id,
    estimate_id: row.estimate_id,
    job_id: row.job_id,
    position: row.position,
    room_id: row.room_id,
    room_name: row.room_name,
    room_type_id: row.room_type_id,
    wall_complexity_id: row.wall_complexity_id,
    notes: row.notes,
    length_in: row.length_in,
    width_in: row.width_in,
    wallheight_in: row.wallheight_in,
    condition_selections: row.condition_selections ?? null,
  }
}
