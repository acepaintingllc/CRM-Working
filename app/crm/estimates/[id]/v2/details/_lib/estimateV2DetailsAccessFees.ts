import { calculateAccessFeeRows } from '@/lib/estimator/accessFees'
import type {
  EstimateV2AccessFeeDraft,
  EstimateV2AccessFeeOption,
  EstimateV2RoomDraft,
} from '@/types/estimator/v2'

export type DetailsAccessFeeAllocation = {
  walls: number
  ceilings: number
  trim: number
  unallocated: number
  warning: string | null
}

export type DetailsAccessFeesVm = {
  rows: Array<{
    id: string
    accessFeeId: string
    label: string
    roomId: string
    roomLabel: string
    qty: string
    actualCostOverride: string
    notes: string
    effectiveTotal: number
    overridden: boolean
  }>
  optionGroups: Array<{
    key: EstimateV2AccessFeeOption['access_group']
    label: string
    options: EstimateV2AccessFeeOption[]
  }>
  roomOptions: Array<{ id: string; label: string }>
  total: number
  allocation: DetailsAccessFeeAllocation | null
}

const ACCESS_GROUP_LABELS = {
  ladders: 'Ladders',
  scaffolding: 'Scaffolding',
  specialty: 'Specialty',
} satisfies Record<EstimateV2AccessFeeOption['access_group'], string>

export function createAccessFeeDraftId() {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `access-fee-${randomId}`
}

export function addAccessFeeDraft(
  rows: EstimateV2AccessFeeDraft[],
  createId: () => string = createAccessFeeDraftId
) {
  return [
    ...rows,
    {
      id: createId(),
      roomId: '',
      accessFeeId: '',
      qty: '1',
      actualCostOverride: '',
      notes: '',
      position: rows.length,
    },
  ]
}

export function updateAccessFeeDraft(
  rows: EstimateV2AccessFeeDraft[],
  rowId: string,
  patch: Partial<EstimateV2AccessFeeDraft>
) {
  return rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
}

export function removeAccessFeeDraft(rows: EstimateV2AccessFeeDraft[], rowId: string) {
  return rows
    .filter((row) => row.id !== rowId)
    .map((row, index) => ({ ...row, position: index }))
}

export function buildEstimateV2DetailsAccessFeesVm(params: {
  accessFees: EstimateV2AccessFeeDraft[]
  catalog: EstimateV2AccessFeeOption[]
  rooms: Array<Pick<EstimateV2RoomDraft, 'roomId' | 'roomName'>>
  pricingSummary: { accessFeeAllocation?: DetailsAccessFeeAllocation | null } | null | undefined
}): DetailsAccessFeesVm {
  const calculated = calculateAccessFeeRows({
    drafts: params.accessFees,
    catalog: params.catalog,
  })
  const calculatedById = new Map(calculated.rows.map((row) => [row.id, row]))
  const roomsById = new Map(params.rooms.map((room) => [room.roomId, room.roomName]))
  const optionGroups = (['ladders', 'scaffolding', 'specialty'] as const)
    .map((key) => ({
      key,
      label: ACCESS_GROUP_LABELS[key],
      options: params.catalog.filter((option) => option.access_group === key),
    }))
    .filter((group) => group.options.length > 0)

  return {
    rows: params.accessFees.map((draft) => {
      const calculatedRow = calculatedById.get(draft.id)
      return {
        id: draft.id,
        accessFeeId: draft.accessFeeId,
        label: calculatedRow?.label ?? (draft.accessFeeId || 'Access fee'),
        roomId: draft.roomId,
        roomLabel: draft.roomId ? roomsById.get(draft.roomId) ?? draft.roomId : 'Job level',
        qty: draft.qty,
        actualCostOverride: draft.actualCostOverride,
        notes: draft.notes,
        effectiveTotal: calculatedRow?.total ?? 0,
        overridden: calculatedRow?.overridden ?? false,
      }
    }),
    optionGroups,
    roomOptions: params.rooms.map((room) => ({ id: room.roomId, label: room.roomName || room.roomId })),
    total: calculated.total,
    allocation: params.pricingSummary?.accessFeeAllocation ?? null,
  }
}
