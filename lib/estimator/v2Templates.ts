import type {
  EstimateV2RollerDraft,
  EstimateV2RoomDraft,
  EstimateV2RoomFlagDraft,
} from '@/types/estimator/v2Rooms'
import type {
  EstimateV2AccessFeeDraft,
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
  EstimateV2DoorScopeDraft,
  EstimateV2DrywallRepairDraft,
  EstimateV2OtherItemDraft,
  EstimateV2PrejobTripDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
} from '@/types/estimator/v2Scopes'
import type { EstimateV2JobSettingsDraft } from '@/types/estimator/v2Settings'

export type EstimateTemplateStatus = 'active' | 'archived'
export type EstimateTemplateKind = 'room' | 'job'
export type EstimateRoomTemplateApplyMode = 'new_room' | 'fill_blanks' | 'replace_room'
export type EstimateJobTemplateApplyMode = 'fill_blanks' | 'replace_job'

export type EstimateTemplateReference = {
  kind: string
  id: string
  label: string | null
}

export type EstimateTemplateSnapshotLabels = Record<string, string | null>

export type EstimateRoomTemplateData = {
  version: 1
  room: EstimateV2RoomDraft
  wallScopes: EstimateV2WallScopeDraft[]
  wallSegments: EstimateV2WallSegmentDraft[]
  roomFlags: EstimateV2RoomFlagDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  doorScopes: EstimateV2DoorScopeDraft[]
  drywallRepairs: EstimateV2DrywallRepairDraft[]
  accessFees: EstimateV2AccessFeeDraft[]
  otherItems: EstimateV2OtherItemDraft[]
  prejobTrips: EstimateV2PrejobTripDraft[]
  references: EstimateTemplateReference[]
  snapshotLabels: EstimateTemplateSnapshotLabels
}

export type EstimateJobTemplateData = {
  version: 1
  jobSettingsDraft: EstimateV2JobSettingsDraft | null
  rooms: EstimateV2RoomDraft[]
  wallScopes: EstimateV2WallScopeDraft[]
  wallSegments: EstimateV2WallSegmentDraft[]
  roomFlags: EstimateV2RoomFlagDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  doorScopes: EstimateV2DoorScopeDraft[]
  drywallRepairs: EstimateV2DrywallRepairDraft[]
  rollers: EstimateV2RollerDraft[]
  accessFees: EstimateV2AccessFeeDraft[]
  otherItems: EstimateV2OtherItemDraft[]
  prejobTrips: EstimateV2PrejobTripDraft[]
  references: EstimateTemplateReference[]
  snapshotLabels: EstimateTemplateSnapshotLabels
}

export type EstimateTemplateData = EstimateRoomTemplateData | EstimateJobTemplateData

export type EstimateTemplateRecord<TData extends EstimateTemplateData = EstimateTemplateData> = {
  id: string
  org_id: string
  name: string
  description: string | null
  status: EstimateTemplateStatus
  template_data: TData
  snapshot_labels: EstimateTemplateSnapshotLabels
  source_estimate_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string | null
  updated_at: string | null
}

export type EstimateTemplateListPayload = {
  room_templates: EstimateTemplateRecord<EstimateRoomTemplateData>[]
  job_templates: EstimateTemplateRecord<EstimateJobTemplateData>[]
}

export type EstimateTemplateMutationPayload = {
  kind: EstimateTemplateKind
  name: string
  description: string | null
  status: EstimateTemplateStatus
  template_data: EstimateTemplateData
  snapshot_labels: EstimateTemplateSnapshotLabels
  source_estimate_id: string | null
}

export type EstimateTemplateCollections = {
  rooms: EstimateV2RoomDraft[]
  wallScopes: EstimateV2WallScopeDraft[]
  wallSegments: EstimateV2WallSegmentDraft[]
  roomFlags: EstimateV2RoomFlagDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  doorScopes: EstimateV2DoorScopeDraft[]
  drywallRepairs: EstimateV2DrywallRepairDraft[]
  rollers: EstimateV2RollerDraft[]
  accessFees: EstimateV2AccessFeeDraft[]
  otherItems: EstimateV2OtherItemDraft[]
  prejobTrips: EstimateV2PrejobTripDraft[]
}

export type ApplyEstimateJobTemplateResult = {
  collections: EstimateTemplateCollections
  jobSettingsDraft: EstimateV2JobSettingsDraft | null
  selectedRoomId: string
}

export type IdFactory = () => string

function defaultCreateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `template-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableText(value: unknown) {
  const text = asText(value)
  return text || null
}

function isTemplateStatus(value: unknown): value is EstimateTemplateStatus {
  return value === 'active' || value === 'archived'
}

function isTemplateKind(value: unknown): value is EstimateTemplateKind {
  return value === 'room' || value === 'job'
}

function normalizeStatus(value: unknown): EstimateTemplateStatus {
  return isTemplateStatus(value) ? value : 'active'
}

function normalizeSnapshotLabels(value: unknown): EstimateTemplateSnapshotLabels {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).map(([key, label]) => [key, typeof label === 'string' ? label : null])
  )
}

function normalizeReferences(value: unknown): EstimateTemplateReference[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const kind = asText(entry.kind)
    const id = asText(entry.id)
    if (!kind || !id) return []
    return [{ kind, id, label: asNullableText(entry.label) }]
  })
}

function normalizeTemplateData(kind: EstimateTemplateKind, value: unknown): EstimateTemplateData | null {
  if (!isRecord(value) || value.version !== 1) return null

  if (kind === 'room') {
    if (!isRecord(value.room)) return null
    return {
      version: 1,
      room: value.room as EstimateV2RoomDraft,
      wallScopes: Array.isArray(value.wallScopes) ? (value.wallScopes as EstimateV2WallScopeDraft[]) : [],
      wallSegments: Array.isArray(value.wallSegments)
        ? (value.wallSegments as EstimateV2WallSegmentDraft[])
        : [],
      roomFlags: Array.isArray(value.roomFlags) ? (value.roomFlags as EstimateV2RoomFlagDraft[]) : [],
      ceilingScopes: Array.isArray(value.ceilingScopes)
        ? (value.ceilingScopes as EstimateV2CeilingScopeDraft[])
        : [],
      ceilingSegments: Array.isArray(value.ceilingSegments)
        ? (value.ceilingSegments as EstimateV2CeilingSegmentDraft[])
        : [],
      trimScopes: Array.isArray(value.trimScopes) ? (value.trimScopes as EstimateV2TrimScopeDraft[]) : [],
      doorScopes: Array.isArray(value.doorScopes) ? (value.doorScopes as EstimateV2DoorScopeDraft[]) : [],
      drywallRepairs: Array.isArray(value.drywallRepairs)
        ? (value.drywallRepairs as EstimateV2DrywallRepairDraft[])
        : [],
      accessFees: Array.isArray(value.accessFees) ? (value.accessFees as EstimateV2AccessFeeDraft[]) : [],
      otherItems: Array.isArray(value.otherItems) ? (value.otherItems as EstimateV2OtherItemDraft[]) : [],
      prejobTrips: Array.isArray(value.prejobTrips) ? (value.prejobTrips as EstimateV2PrejobTripDraft[]) : [],
      references: normalizeReferences(value.references),
      snapshotLabels: normalizeSnapshotLabels(value.snapshotLabels),
    }
  }

  return {
    version: 1,
    jobSettingsDraft: isRecord(value.jobSettingsDraft)
      ? (value.jobSettingsDraft as EstimateV2JobSettingsDraft)
      : null,
    rooms: Array.isArray(value.rooms) ? (value.rooms as EstimateV2RoomDraft[]) : [],
    wallScopes: Array.isArray(value.wallScopes) ? (value.wallScopes as EstimateV2WallScopeDraft[]) : [],
    wallSegments: Array.isArray(value.wallSegments) ? (value.wallSegments as EstimateV2WallSegmentDraft[]) : [],
    roomFlags: Array.isArray(value.roomFlags) ? (value.roomFlags as EstimateV2RoomFlagDraft[]) : [],
    ceilingScopes: Array.isArray(value.ceilingScopes)
      ? (value.ceilingScopes as EstimateV2CeilingScopeDraft[])
      : [],
    ceilingSegments: Array.isArray(value.ceilingSegments)
      ? (value.ceilingSegments as EstimateV2CeilingSegmentDraft[])
      : [],
    trimScopes: Array.isArray(value.trimScopes) ? (value.trimScopes as EstimateV2TrimScopeDraft[]) : [],
    doorScopes: Array.isArray(value.doorScopes) ? (value.doorScopes as EstimateV2DoorScopeDraft[]) : [],
    drywallRepairs: Array.isArray(value.drywallRepairs)
      ? (value.drywallRepairs as EstimateV2DrywallRepairDraft[])
      : [],
    rollers: Array.isArray(value.rollers) ? (value.rollers as EstimateV2RollerDraft[]) : [],
    accessFees: Array.isArray(value.accessFees) ? (value.accessFees as EstimateV2AccessFeeDraft[]) : [],
    otherItems: Array.isArray(value.otherItems) ? (value.otherItems as EstimateV2OtherItemDraft[]) : [],
    prejobTrips: Array.isArray(value.prejobTrips) ? (value.prejobTrips as EstimateV2PrejobTripDraft[]) : [],
    references: normalizeReferences(value.references),
    snapshotLabels: normalizeSnapshotLabels(value.snapshotLabels),
  }
}

export function normalizeEstimateTemplateMutationBody(
  body: unknown,
  existing?: EstimateTemplateRecord
): { ok: true; payload: EstimateTemplateMutationPayload } | { ok: false; message: string } {
  if (!isRecord(body)) return { ok: false, message: 'Missing template payload.' }
  const kindValue = body.kind ?? (existing ? inferTemplateKind(existing.template_data) : null)
  if (!isTemplateKind(kindValue)) return { ok: false, message: 'Template kind must be room or job.' }

  const name = asText(body.name ?? existing?.name)
  if (!name) return { ok: false, message: 'Template name is required.' }

  const rawData = body.template_data ?? existing?.template_data
  const templateData = normalizeTemplateData(kindValue, rawData)
  if (!templateData) return { ok: false, message: 'Template data is invalid.' }

  const snapshotLabels = normalizeSnapshotLabels(body.snapshot_labels ?? templateData.snapshotLabels)
  return {
    ok: true,
    payload: {
      kind: kindValue,
      name,
      description: asNullableText(body.description ?? existing?.description),
      status: normalizeStatus(body.status ?? existing?.status),
      template_data: { ...templateData, snapshotLabels },
      snapshot_labels: snapshotLabels,
      source_estimate_id: asNullableText(body.source_estimate_id ?? existing?.source_estimate_id),
    },
  }
}

export function inferTemplateKind(data: EstimateTemplateData): EstimateTemplateKind {
  return 'room' in data ? 'room' : 'job'
}

export function createEstimateRoomTemplateData(params: {
  room: EstimateV2RoomDraft
  collections: Pick<
    EstimateTemplateCollections,
    | 'wallScopes'
    | 'wallSegments'
    | 'roomFlags'
    | 'ceilingScopes'
    | 'ceilingSegments'
    | 'trimScopes'
    | 'doorScopes'
    | 'drywallRepairs'
    | 'accessFees'
    | 'otherItems'
    | 'prejobTrips'
  >
  references?: EstimateTemplateReference[]
  snapshotLabels?: EstimateTemplateSnapshotLabels
}): EstimateRoomTemplateData {
  const roomId = params.room.roomId
  const wallScopeIds = new Set(params.collections.wallScopes.filter((row) => row.roomId === roomId).map((row) => row.id))
  const ceilingScopeIds = new Set(
    params.collections.ceilingScopes.filter((row) => row.roomId === roomId).map((row) => row.id)
  )
  return {
    version: 1,
    room: { ...params.room },
    wallScopes: params.collections.wallScopes.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    wallSegments: params.collections.wallSegments
      .filter((row) => row.roomId === roomId || wallScopeIds.has(row.wallScopeId))
      .map((row) => ({ ...row })),
    roomFlags: params.collections.roomFlags.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    ceilingScopes: params.collections.ceilingScopes.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    ceilingSegments: params.collections.ceilingSegments
      .filter((row) => row.roomId === roomId || ceilingScopeIds.has(row.ceilingScopeId))
      .map((row) => ({ ...row })),
    trimScopes: params.collections.trimScopes.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    doorScopes: params.collections.doorScopes.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    drywallRepairs: params.collections.drywallRepairs.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    accessFees: params.collections.accessFees.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    otherItems: params.collections.otherItems.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    prejobTrips: params.collections.prejobTrips.filter((row) => row.roomId === roomId).map((row) => ({ ...row })),
    references: params.references ?? [],
    snapshotLabels: params.snapshotLabels ?? {},
  }
}

export function createEstimateJobTemplateData(params: {
  jobSettingsDraft: EstimateV2JobSettingsDraft | null
  collections: EstimateTemplateCollections
  references?: EstimateTemplateReference[]
  snapshotLabels?: EstimateTemplateSnapshotLabels
}): EstimateJobTemplateData {
  return {
    version: 1,
    jobSettingsDraft: params.jobSettingsDraft ? { ...params.jobSettingsDraft } : null,
    rooms: params.collections.rooms.map((row) => ({ ...row })),
    wallScopes: params.collections.wallScopes.map((row) => ({ ...row })),
    wallSegments: params.collections.wallSegments.map((row) => ({ ...row })),
    roomFlags: params.collections.roomFlags.map((row) => ({ ...row })),
    ceilingScopes: params.collections.ceilingScopes.map((row) => ({ ...row })),
    ceilingSegments: params.collections.ceilingSegments.map((row) => ({ ...row })),
    trimScopes: params.collections.trimScopes.map((row) => ({ ...row })),
    doorScopes: params.collections.doorScopes.map((row) => ({ ...row })),
    drywallRepairs: params.collections.drywallRepairs.map((row) => ({ ...row })),
    rollers: params.collections.rollers.map((row) => ({ ...row })),
    accessFees: params.collections.accessFees.map((row) => ({ ...row })),
    otherItems: params.collections.otherItems.map((row) => ({ ...row })),
    prejobTrips: params.collections.prejobTrips.map((row) => ({ ...row })),
    references: params.references ?? [],
    snapshotLabels: params.snapshotLabels ?? {},
  }
}

function isBlank(value: unknown) {
  return value == null || value === ''
}

function fillBlankFields<T extends Record<string, unknown>>(current: T, template: T): T {
  const next = { ...current }
  for (const [key, value] of Object.entries(template)) {
    if (key === 'id' || key === 'roomId' || key === 'position') continue
    if (isBlank(next[key]) && !isBlank(value)) {
      next[key as keyof T] = value as T[keyof T]
    }
  }
  return next
}

function nextRoomCode(rooms: EstimateV2RoomDraft[]) {
  const used = new Set(rooms.map((room) => room.roomId))
  let n = rooms.length + 1
  while (used.has(`R${String(n).padStart(3, '0')}`)) n += 1
  return `R${String(n).padStart(3, '0')}`
}

function cloneRoomTemplateRows(params: {
  data: EstimateRoomTemplateData
  roomId: string
  roomPosition: number
  createId: IdFactory
}) {
  const wallScopeIdMap = new Map<string, string>()
  const ceilingScopeIdMap = new Map<string, string>()
  const room = {
    ...params.data.room,
    id: params.createId(),
    roomId: params.roomId,
    position: params.roomPosition,
  }
  const wallScopes = params.data.wallScopes.map((row) => {
    const id = params.createId()
    wallScopeIdMap.set(row.id, id)
    return { ...row, id, roomId: params.roomId }
  })
  const ceilingScopes = params.data.ceilingScopes.map((row) => {
    const id = params.createId()
    ceilingScopeIdMap.set(row.id, id)
    return { ...row, id, roomId: params.roomId }
  })
  return {
    room,
    wallScopes,
    wallSegments: params.data.wallSegments.map((row) => ({
      ...row,
      id: params.createId(),
      wallScopeId: wallScopeIdMap.get(row.wallScopeId) ?? row.wallScopeId,
      roomId: params.roomId,
    })),
    roomFlags: params.data.roomFlags.map((row) => ({ ...row, id: params.createId(), roomId: params.roomId })),
    ceilingScopes,
    ceilingSegments: params.data.ceilingSegments.map((row) => ({
      ...row,
      id: params.createId(),
      ceilingScopeId: ceilingScopeIdMap.get(row.ceilingScopeId) ?? row.ceilingScopeId,
      roomId: params.roomId,
    })),
    trimScopes: params.data.trimScopes.map((row) => ({ ...row, id: params.createId(), roomId: params.roomId })),
    doorScopes: params.data.doorScopes.map((row) => ({ ...row, id: params.createId(), roomId: params.roomId })),
    drywallRepairs: params.data.drywallRepairs.map((row) => ({
      ...row,
      id: params.createId(),
      roomId: params.roomId,
    })),
    accessFees: params.data.accessFees.map((row) => ({ ...row, id: params.createId(), roomId: params.roomId })),
    otherItems: params.data.otherItems.map((row) => ({ ...row, id: params.createId(), roomId: params.roomId })),
    prejobTrips: params.data.prejobTrips.map((row) => ({ ...row, id: params.createId(), roomId: params.roomId })),
  }
}

function stripRoomRows(collections: EstimateTemplateCollections, roomId: string): EstimateTemplateCollections {
  const wallScopeIds = new Set(collections.wallScopes.filter((row) => row.roomId === roomId).map((row) => row.id))
  const ceilingScopeIds = new Set(collections.ceilingScopes.filter((row) => row.roomId === roomId).map((row) => row.id))
  return {
    ...collections,
    wallScopes: collections.wallScopes.filter((row) => row.roomId !== roomId),
    wallSegments: collections.wallSegments.filter(
      (row) => row.roomId !== roomId && !wallScopeIds.has(row.wallScopeId)
    ),
    roomFlags: collections.roomFlags.filter((row) => row.roomId !== roomId),
    ceilingScopes: collections.ceilingScopes.filter((row) => row.roomId !== roomId),
    ceilingSegments: collections.ceilingSegments.filter(
      (row) => row.roomId !== roomId && !ceilingScopeIds.has(row.ceilingScopeId)
    ),
    trimScopes: collections.trimScopes.filter((row) => row.roomId !== roomId),
    doorScopes: collections.doorScopes.filter((row) => row.roomId !== roomId),
    drywallRepairs: collections.drywallRepairs.filter((row) => row.roomId !== roomId),
    accessFees: collections.accessFees.filter((row) => row.roomId !== roomId),
    otherItems: collections.otherItems.filter((row) => row.roomId !== roomId),
    prejobTrips: collections.prejobTrips.filter((row) => row.roomId !== roomId),
  }
}

export function applyEstimateRoomTemplate(params: {
  collections: EstimateTemplateCollections
  template: EstimateRoomTemplateData
  mode: EstimateRoomTemplateApplyMode
  targetRoomId?: string | null
  createId?: IdFactory
}): { collections: EstimateTemplateCollections; selectedRoomId: string } {
  const createId = params.createId ?? defaultCreateId
  const targetRoomId = params.targetRoomId ?? null
  const targetRoom = targetRoomId
    ? params.collections.rooms.find((room) => room.roomId === targetRoomId)
    : null

  if (params.mode === 'fill_blanks' && targetRoom) {
    const cloned = cloneRoomTemplateRows({
      data: params.template,
      roomId: targetRoom.roomId,
      roomPosition: targetRoom.position,
      createId,
    })
    const hasRows = <T extends { roomId: string }>(rows: T[]) =>
      rows.some((row) => row.roomId === targetRoom.roomId)
    return {
      selectedRoomId: targetRoom.roomId,
      collections: {
        ...params.collections,
        rooms: params.collections.rooms.map((room) =>
          room.roomId === targetRoom.roomId
            ? fillBlankFields(room as unknown as Record<string, unknown>, cloned.room as unknown as Record<string, unknown>) as EstimateV2RoomDraft
            : room
        ),
        wallScopes: hasRows(params.collections.wallScopes)
          ? params.collections.wallScopes
          : [...params.collections.wallScopes, ...cloned.wallScopes],
        wallSegments: hasRows(params.collections.wallScopes)
          ? params.collections.wallSegments
          : [...params.collections.wallSegments, ...cloned.wallSegments],
        roomFlags: [
          ...params.collections.roomFlags,
          ...cloned.roomFlags.filter(
            (flag) =>
              !params.collections.roomFlags.some(
                (existing) => existing.roomId === targetRoom.roomId && existing.flagId === flag.flagId
              )
          ),
        ],
        ceilingScopes: hasRows(params.collections.ceilingScopes)
          ? params.collections.ceilingScopes
          : [...params.collections.ceilingScopes, ...cloned.ceilingScopes],
        ceilingSegments: hasRows(params.collections.ceilingScopes)
          ? params.collections.ceilingSegments
          : [...params.collections.ceilingSegments, ...cloned.ceilingSegments],
        trimScopes: hasRows(params.collections.trimScopes)
          ? params.collections.trimScopes
          : [...params.collections.trimScopes, ...cloned.trimScopes],
        doorScopes: hasRows(params.collections.doorScopes)
          ? params.collections.doorScopes
          : [...params.collections.doorScopes, ...cloned.doorScopes],
        drywallRepairs: hasRows(params.collections.drywallRepairs)
          ? params.collections.drywallRepairs
          : [...params.collections.drywallRepairs, ...cloned.drywallRepairs],
      },
    }
  }

  const roomId = params.mode === 'replace_room' && targetRoom ? targetRoom.roomId : nextRoomCode(params.collections.rooms)
  const roomPosition =
    params.mode === 'replace_room' && targetRoom ? targetRoom.position : params.collections.rooms.length
  const cloned = cloneRoomTemplateRows({ data: params.template, roomId, roomPosition, createId })
  const base =
    params.mode === 'replace_room' && targetRoom
      ? {
          ...stripRoomRows(params.collections, targetRoom.roomId),
          rooms: params.collections.rooms.map((room) =>
            room.roomId === targetRoom.roomId ? cloned.room : room
          ),
        }
      : { ...params.collections, rooms: [...params.collections.rooms, cloned.room] }

  return {
    selectedRoomId: roomId,
    collections: {
      ...base,
      wallScopes: [...base.wallScopes, ...cloned.wallScopes],
      wallSegments: [...base.wallSegments, ...cloned.wallSegments],
      roomFlags: [...base.roomFlags, ...cloned.roomFlags],
      ceilingScopes: [...base.ceilingScopes, ...cloned.ceilingScopes],
      ceilingSegments: [...base.ceilingSegments, ...cloned.ceilingSegments],
      trimScopes: [...base.trimScopes, ...cloned.trimScopes],
      doorScopes: [...base.doorScopes, ...cloned.doorScopes],
      drywallRepairs: [...base.drywallRepairs, ...cloned.drywallRepairs],
      accessFees: [...base.accessFees, ...cloned.accessFees],
      otherItems: [...base.otherItems, ...cloned.otherItems],
      prejobTrips: [...base.prejobTrips, ...cloned.prejobTrips],
    },
  }
}

export function applyEstimateJobTemplate(params: {
  collections: EstimateTemplateCollections
  jobSettingsDraft: EstimateV2JobSettingsDraft | null
  template: EstimateJobTemplateData
  mode: EstimateJobTemplateApplyMode
  createId?: IdFactory
}): ApplyEstimateJobTemplateResult {
  const createId = params.createId ?? defaultCreateId
  if (params.mode === 'fill_blanks' && params.collections.rooms.length > 0) {
    return {
      collections: params.collections,
      jobSettingsDraft: mergeJobSettingsBlanks(params.jobSettingsDraft, params.template.jobSettingsDraft),
      selectedRoomId: params.collections.rooms[0]?.roomId ?? '',
    }
  }

  const empty: EstimateTemplateCollections = {
    rooms: [],
    wallScopes: [],
    wallSegments: [],
    roomFlags: [],
    ceilingScopes: [],
    ceilingSegments: [],
    trimScopes: [],
    doorScopes: [],
    drywallRepairs: [],
    rollers: params.template.rollers.map((row) => ({ ...row, id: createId() })),
    accessFees: [],
    otherItems: [],
    prejobTrips: [],
  }

  const collections = params.template.rooms.reduce((current, room) => {
    const roomTemplate = createEstimateRoomTemplateData({
      room,
      collections: params.template,
      references: params.template.references,
      snapshotLabels: params.template.snapshotLabels,
    })
    return applyEstimateRoomTemplate({
      collections: current,
      template: roomTemplate,
      mode: 'new_room',
      createId,
    }).collections
  }, empty)

  return {
    collections,
    jobSettingsDraft: params.template.jobSettingsDraft ? { ...params.template.jobSettingsDraft } : params.jobSettingsDraft,
    selectedRoomId: collections.rooms[0]?.roomId ?? '',
  }
}

function mergeJobSettingsBlanks(
  current: EstimateV2JobSettingsDraft | null,
  template: EstimateV2JobSettingsDraft | null
) {
  if (!current) return template ? { ...template } : null
  if (!template) return current
  return fillBlankFields(
    current as unknown as Record<string, unknown>,
    template as unknown as Record<string, unknown>
  ) as EstimateV2JobSettingsDraft
}
