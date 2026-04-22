import type {
  EstimateV2EditorSectionChipVm,
  EstimateV2EditorSectionSummaryVm,
} from '../_state/estimateV2EditorTypes'

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function buildHeaderSubtitle(job: {
  title?: string | null
  customer_name?: string | null
  customer_address?: string | null
} | null) {
  return [job?.title, job?.customer_name, job?.customer_address].filter(Boolean).join(' - ')
}

export function buildIncludedScopeLabels(params: {
  wallsIncluded: boolean
  ceilingsIncluded: boolean
  trimsIncluded: boolean
}) {
  const labels = [
    params.wallsIncluded ? 'Walls' : null,
    params.ceilingsIncluded ? 'Ceilings' : null,
    params.trimsIncluded ? 'Trim' : null,
  ].filter(Boolean)

  return labels.length > 0 ? labels.join(', ') : 'No scopes included'
}

export function buildScopeToggleLabels(params: {
  wallsIncluded: boolean
  ceilingsIncluded: boolean
  trimsIncluded: boolean
}) {
  return {
    walls: `Walls ${params.wallsIncluded ? 'included' : 'excluded'}`,
    ceilings: `Ceilings ${params.ceilingsIncluded ? 'included' : 'excluded'}`,
    trim: `Trim ${params.trimsIncluded ? 'included' : 'excluded'}`,
  }
}

export function buildValidationState(validationIssueCount: number) {
  return {
    text: validationIssueCount ? `${validationIssueCount} issue(s)` : 'No open issues',
    color: validationIssueCount ? '#f9e2b7' : 'var(--v2-ink-2)',
  }
}

export function buildCalculationState(calculationsStale: boolean) {
  return {
    text: calculationsStale ? 'Live preview (not saved)' : 'Saved server values',
    color: calculationsStale ? '#f9e2b7' : 'var(--v2-ink-2)',
  }
}

export function buildRoomSubtitle(roomName: string, includedScopeLabels: string) {
  return `${roomName} - ${includedScopeLabels}`
}

export function buildRunningTotalLabel(roomsCount: number) {
  return `Running total - ${formatCountLabel(roomsCount, 'room')} - active scopes`
}

export function buildSectionSummaryChips(params: {
  modeLabel?: string
  primaryValue: string
  primaryUnit: string
  paintLabel: string
  primerLabel: string
  validationIssueCount?: number
  itemCount?: number
  secondaryValue?: string
  secondaryLabel?: string
}) {
  const chips: EstimateV2EditorSectionChipVm[] = []

  if (params.modeLabel) chips.push({ label: `Mode: ${params.modeLabel}` })
  if (params.itemCount != null) chips.push({ label: `Items: ${params.itemCount}` })
  chips.push({ label: `${params.primaryUnit}: ${params.primaryValue}` })
  chips.push({ label: `Paint: ${params.paintLabel}` })
  chips.push({ label: `Primer: ${params.primerLabel}` })

  if (params.secondaryValue && params.secondaryLabel) {
    chips.push({ label: `${params.secondaryLabel}: ${params.secondaryValue}` })
  }

  if (params.validationIssueCount != null) {
    chips.push({
      label:
        params.validationIssueCount > 0
          ? `${params.validationIssueCount} issue(s)`
          : 'Validated',
      tone: params.validationIssueCount > 0 ? 'warning' : 'default',
    })
  }

  return chips
}

export function buildSectionSummaryVm(params: Omit<EstimateV2EditorSectionSummaryVm, 'chips'> & {
  chips: EstimateV2EditorSectionChipVm[]
}) {
  return params
}
