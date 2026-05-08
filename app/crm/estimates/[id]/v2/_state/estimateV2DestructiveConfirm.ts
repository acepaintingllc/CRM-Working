import type {
  EstimateV2DoorTypeOption,
  EstimateV2DrywallRateOption,
  EstimateV2TrimTypeOption,
} from '@/types/estimator/v2'

type DeferredRun = () => void

export type EstimateV2DestructiveIntent =
  | {
      kind: 'room-delete'
      roomId: string
      roomLabel: string
      hasNestedData: boolean
      run: DeferredRun
    }
  | {
      kind: 'room-geometry-reset'
      roomId: string
      roomLabel: string
      nextMode: 'RECT' | 'SEG'
      run: DeferredRun
    }
  | {
      kind: 'wall-scope-delete'
      roomId: string
      roomLabel: string
      scopeId: string
      scopeLabel: string
      segmentCount: number
      run: DeferredRun
    }
  | {
      kind: 'ceiling-scope-delete'
      roomId: string
      roomLabel: string
      scopeId: string
      scopeLabel: string
      segmentCount: number
      run: DeferredRun
    }
  | {
      kind: 'trim-delete'
      roomId: string
      roomLabel: string
      scopeId: string
      scopeLabel: string
      run: DeferredRun
    }
  | {
      kind: 'door-delete'
      roomId: string
      roomLabel: string
      scopeId: string
      scopeLabel: string
      run: DeferredRun
    }
  | {
      kind: 'drywall-delete'
      roomId: string
      roomLabel: string
      repairId: string
      surfaceLabel: string
      repairLabel: string
      run: DeferredRun
    }

export type EstimateV2DestructiveConfirmVm = {
  isOpen: boolean
  labelledBy: string
  title: string
  description: string
  closeLabel: string
  warning: string
  info?: string | null
  confirmLabel: string
  confirmAriaLabel: string
}

export function buildEstimateV2DestructiveConfirmVm(
  pendingIntent: EstimateV2DestructiveIntent | null
): EstimateV2DestructiveConfirmVm {
  if (!pendingIntent) {
    return {
      isOpen: false,
      labelledBy: 'estimate-v2-destructive-confirm-title',
      title: '',
      description: '',
      closeLabel: 'Close destructive confirmation',
      warning: '',
      info: null,
      confirmLabel: 'Confirm',
      confirmAriaLabel: 'Confirm destructive change',
    }
  }

  switch (pendingIntent.kind) {
    case 'room-delete':
      return {
        isOpen: true,
        labelledBy: 'estimate-v2-destructive-confirm-title',
        title: `Delete ${pendingIntent.roomLabel}?`,
        description: `This will remove room ${pendingIntent.roomLabel} from the estimate.`,
        closeLabel: 'Close delete room confirmation',
        warning: pendingIntent.hasNestedData
          ? `Delete ${pendingIntent.roomLabel} and all wall, ceiling, trim, door, and drywall rows inside it.`
          : `Delete ${pendingIntent.roomLabel}.`,
        info: 'This change removes the room from the current editor draft immediately.',
        confirmLabel: `Delete ${pendingIntent.roomLabel}`,
        confirmAriaLabel: `Delete room ${pendingIntent.roomLabel}`,
      }
    case 'room-geometry-reset':
      return {
        isOpen: true,
        labelledBy: 'estimate-v2-destructive-confirm-title',
        title: `Reset ${pendingIntent.roomLabel} geometry?`,
        description: `Switch ${pendingIntent.roomLabel} back to ${pendingIntent.nextMode} mode.`,
        closeLabel: 'Close geometry reset confirmation',
        warning: `Resetting ${pendingIntent.roomLabel} clears all SEG wall and ceiling scopes and segments in that room.`,
        info: 'Use Cancel to keep the current segmented geometry.',
        confirmLabel: `Reset ${pendingIntent.roomLabel}`,
        confirmAriaLabel: `Reset geometry for room ${pendingIntent.roomLabel}`,
      }
    case 'wall-scope-delete':
      return {
        isOpen: true,
        labelledBy: 'estimate-v2-destructive-confirm-title',
        title: `Delete ${pendingIntent.scopeLabel}?`,
        description: `This will remove wall scope ${pendingIntent.scopeLabel} from ${pendingIntent.roomLabel}.`,
        closeLabel: 'Close wall scope delete confirmation',
        warning:
          pendingIntent.segmentCount > 0
            ? `Delete ${pendingIntent.scopeLabel} and its ${pendingIntent.segmentCount} wall segment${pendingIntent.segmentCount === 1 ? '' : 's'}.`
            : `Delete wall scope ${pendingIntent.scopeLabel}.`,
        info: 'Wall scope totals update as soon as you confirm.',
        confirmLabel: `Delete ${pendingIntent.scopeLabel}`,
        confirmAriaLabel: `Delete wall scope ${pendingIntent.scopeLabel} from room ${pendingIntent.roomLabel}`,
      }
    case 'ceiling-scope-delete':
      return {
        isOpen: true,
        labelledBy: 'estimate-v2-destructive-confirm-title',
        title: `Delete ${pendingIntent.scopeLabel}?`,
        description: `This will remove ceiling scope ${pendingIntent.scopeLabel} from ${pendingIntent.roomLabel}.`,
        closeLabel: 'Close ceiling scope delete confirmation',
        warning:
          pendingIntent.segmentCount > 0
            ? `Delete ${pendingIntent.scopeLabel} and its ${pendingIntent.segmentCount} ceiling segment${pendingIntent.segmentCount === 1 ? '' : 's'}.`
            : `Delete ceiling scope ${pendingIntent.scopeLabel}.`,
        info: 'Related wall cut-in sync will refresh automatically.',
        confirmLabel: `Delete ${pendingIntent.scopeLabel}`,
        confirmAriaLabel: `Delete ceiling scope ${pendingIntent.scopeLabel} from room ${pendingIntent.roomLabel}`,
      }
    case 'trim-delete':
      return {
        isOpen: true,
        labelledBy: 'estimate-v2-destructive-confirm-title',
        title: `Delete ${pendingIntent.scopeLabel}?`,
        description: `This will remove trim item ${pendingIntent.scopeLabel} from ${pendingIntent.roomLabel}.`,
        closeLabel: 'Close trim delete confirmation',
        warning: `Delete trim item ${pendingIntent.scopeLabel}.`,
        info: 'Trim totals update as soon as you confirm.',
        confirmLabel: `Delete ${pendingIntent.scopeLabel}`,
        confirmAriaLabel: `Delete trim item ${pendingIntent.scopeLabel} from room ${pendingIntent.roomLabel}`,
      }
    case 'door-delete':
      return {
        isOpen: true,
        labelledBy: 'estimate-v2-destructive-confirm-title',
        title: `Delete ${pendingIntent.scopeLabel}?`,
        description: `This will remove door item ${pendingIntent.scopeLabel} from ${pendingIntent.roomLabel}.`,
        closeLabel: 'Close door delete confirmation',
        warning: `Delete door item ${pendingIntent.scopeLabel}.`,
        info: 'Door totals update as soon as you confirm.',
        confirmLabel: `Delete ${pendingIntent.scopeLabel}`,
        confirmAriaLabel: `Delete door item ${pendingIntent.scopeLabel} from room ${pendingIntent.roomLabel}`,
      }
    case 'drywall-delete':
      return {
        isOpen: true,
        labelledBy: 'estimate-v2-destructive-confirm-title',
        title: `Delete ${pendingIntent.repairLabel}?`,
        description: `This will remove the ${pendingIntent.surfaceLabel.toLowerCase()} drywall repair ${pendingIntent.repairLabel} from ${pendingIntent.roomLabel}.`,
        closeLabel: 'Close drywall delete confirmation',
        warning: `Delete ${pendingIntent.repairLabel} on ${pendingIntent.roomLabel}.`,
        info: 'Drywall totals update as soon as you confirm.',
        confirmLabel: `Delete ${pendingIntent.repairLabel}`,
        confirmAriaLabel: `Delete drywall repair ${pendingIntent.repairLabel} from room ${pendingIntent.roomLabel}`,
      }
  }
}

export function formatEstimateV2RoomLabel(roomName: string | null | undefined, roomId: string) {
  const trimmedName = roomName?.trim()
  return trimmedName ? `${trimmedName} (${roomId})` : roomId
}

export function formatEstimateV2ScopeLabel(
  scopeName: string | null | undefined,
  fallback: string
) {
  const trimmedName = scopeName?.trim()
  return trimmedName || fallback
}

export function formatEstimateV2TrimLabel(
  scopeName: string | null | undefined,
  trimTypeId: string | null | undefined,
  trimTypeOptions: EstimateV2TrimTypeOption[]
) {
  const optionLabel = trimTypeOptions.find((item) => item.id === trimTypeId)?.label
  return formatEstimateV2ScopeLabel(scopeName, optionLabel || trimTypeId || 'Trim item')
}

export function formatEstimateV2DoorLabel(
  scopeName: string | null | undefined,
  doorTypeId: string | null | undefined,
  doorTypeOptions: EstimateV2DoorTypeOption[]
) {
  const optionLabel = doorTypeOptions.find((item) => item.id === doorTypeId)?.label
  return formatEstimateV2ScopeLabel(scopeName, optionLabel || doorTypeId || 'Door item')
}

export function formatEstimateV2DrywallLabel(
  repairType: string | null | undefined,
  drywallRateOptions: EstimateV2DrywallRateOption[]
) {
  const optionLabel = drywallRateOptions.find((item) => item.id === repairType)?.label
  return optionLabel || repairType || 'Drywall repair'
}
