import type { EstimateV2RollerDraft } from '@/types/estimator/v2'
import { normalizeRollerApplicatorQuantity } from '@/lib/estimator/rollerQuantities'
import type { DetailsRollerCoverOption, DetailsRollerState } from './estimateV2DetailsVm'
import {
  findDetailsRollerDraftIndexForRowId,
  parseDetailsRollerRowId,
  type DetailsRollerRowTarget,
} from './estimateV2DetailsRollerIdentity'

export { parseDetailsRollerRowId, type DetailsRollerRowTarget }

export function createDetailsDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function areRollerDraftsEqual(left: EstimateV2RollerDraft, right: EstimateV2RollerDraft) {
  return (
    left.id === right.id &&
    left.scope === right.scope &&
    left.wallColorId === right.wallColorId &&
    (left.selectedOptionId ?? '') === (right.selectedOptionId ?? '') &&
    left.rollerSizeIn === right.rollerSizeIn &&
    left.coversQty === right.coversQty &&
    left.notes === right.notes &&
    left.position === right.position
  )
}

function isEmptyRollerDraft(row: EstimateV2RollerDraft) {
  return (
    (row.selectedOptionId ?? '') === '' &&
    row.rollerSizeIn === '' &&
    row.coversQty === '' &&
    row.notes === ''
  )
}

export function applyDetailsRollerRowPatch(params: {
  rollers: EstimateV2RollerDraft[]
  rowId: string
  patch: Partial<DetailsRollerState[string]>
  rollerOptions: DetailsRollerCoverOption[]
  createId?: () => string
}) {
  const rowTarget = parseDetailsRollerRowId(params.rowId)
  if (rowTarget.scope === 'Trim') return params.rollers

  const selectedCover =
    params.patch.coverId != null
      ? params.rollerOptions.find((option) => option.id === params.patch.coverId)
      : null
  const existingIndex = findDetailsRollerDraftIndexForRowId({
    rollers: params.rollers,
    rowId: params.rowId,
  })
  const existing = existingIndex >= 0 ? params.rollers[existingIndex] : null
  const nextCoversQty =
    params.patch.quantity != null
      ? normalizeRollerApplicatorQuantity(params.patch.quantity).displayValue
      : existing?.coversQty ?? ''
  const nextRow: EstimateV2RollerDraft = {
    id: existing?.id ?? (params.createId ?? createDetailsDraftId)(),
    scope: rowTarget.scope,
    wallColorId: rowTarget.scope === 'Wall' ? rowTarget.wallColorId : '',
    selectedOptionId:
      params.patch.coverId != null ? selectedCover?.id ?? '' : existing?.selectedOptionId ?? '',
    rollerSizeIn:
      params.patch.coverId != null
        ? selectedCover?.sizeIn == null
          ? ''
          : String(selectedCover.sizeIn)
        : existing?.rollerSizeIn ?? '',
    coversQty: nextCoversQty,
    notes: params.patch.notes ?? existing?.notes ?? '',
    position: existing?.position ?? params.rollers.length,
  }

  if (existingIndex < 0) {
    if (isEmptyRollerDraft(nextRow)) return params.rollers
    return [...params.rollers, nextRow]
  }
  if (existing && areRollerDraftsEqual(existing, nextRow)) return params.rollers
  return params.rollers.map((roller, index) => (index === existingIndex ? nextRow : roller))
}
