import type { EstimateV2RollerDraft, EstimateV2RollerScope } from '@/types/estimator/v2'
import type { DetailsRollerCoverOption, DetailsRollerState } from './estimateV2DetailsVm'

export type DetailsRollerRowTarget = {
  scope: EstimateV2RollerScope
  wallColorId: string
}

export function createDetailsDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function parseDetailsRollerRowId(rowId: string): DetailsRollerRowTarget {
  if (rowId === 'ceiling') return { scope: 'Ceiling', wallColorId: '' }
  if (rowId === 'trim') return { scope: 'Trim', wallColorId: '' }
  if (rowId.startsWith('wall:')) {
    return { scope: 'Wall', wallColorId: rowId.slice('wall:'.length).toUpperCase() }
  }
  return { scope: 'Wall', wallColorId: rowId.toUpperCase() }
}

export function applyDetailsRollerRowPatch(params: {
  rollers: EstimateV2RollerDraft[]
  rowId: string
  patch: Partial<DetailsRollerState[string]>
  rollerOptions: DetailsRollerCoverOption[]
  createId?: () => string
}) {
  const rowTarget = parseDetailsRollerRowId(params.rowId)
  const selectedCover =
    params.patch.coverId != null
      ? params.rollerOptions.find((option) => option.id === params.patch.coverId)
      : null
  const existingIndex = params.rollers.findIndex((roller) => {
    if (roller.scope !== rowTarget.scope) return false
    if (rowTarget.scope === 'Ceiling' || rowTarget.scope === 'Trim') return true
    return roller.wallColorId === rowTarget.wallColorId
  })
  const existing = existingIndex >= 0 ? params.rollers[existingIndex] : null
  const nextRow: EstimateV2RollerDraft = {
    id: existing?.id ?? (params.createId ?? createDetailsDraftId)(),
    scope: rowTarget.scope,
    wallColorId: rowTarget.scope === 'Wall' ? rowTarget.wallColorId : '',
    rollerSizeIn:
      params.patch.coverId != null
        ? selectedCover?.sizeIn == null
          ? ''
          : String(selectedCover.sizeIn)
        : existing?.rollerSizeIn ?? '',
    coversQty: params.patch.quantity ?? existing?.coversQty ?? '',
    notes: params.patch.notes ?? existing?.notes ?? '',
    position: existing?.position ?? params.rollers.length,
  }

  if (existingIndex < 0) return [...params.rollers, nextRow]
  return params.rollers.map((roller, index) => (index === existingIndex ? nextRow : roller))
}
