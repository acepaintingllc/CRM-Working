import type {
  DetailsOverrideVm,
  DetailsRollerVm,
  DetailsScopeLineVm,
  DetailsValidationIssue,
} from './estimateV2DetailsVm'
import { round1, sumNumbers } from './estimateV2DetailsShared'

export function createDetailsValidationIssue(
  issue: DetailsValidationIssue
): DetailsValidationIssue {
  return issue
}

export function createDetailsBlockingIssue(params: Omit<DetailsValidationIssue, 'severity'>) {
  return createDetailsValidationIssue({
    ...params,
    severity: 'blocking',
  })
}

export function createDetailsWarningIssue(params: Omit<DetailsValidationIssue, 'severity'>) {
  return createDetailsValidationIssue({
    ...params,
    severity: 'warning',
  })
}

export function createMaterialOverrideInputIssues(params: {
  label: string
  targetId: string
  value: string
  isValid: boolean
}) {
  if (!params.value.trim() || params.isValid) return []
  return [
    createDetailsBlockingIssue({
      id: `material:${params.targetId}:overrideGallons:invalid-number`,
      section: 'material',
      targetId: params.targetId,
      field: 'overrideGallons',
      message: `${params.label} override gallons must be a zero or positive number`,
    }),
  ]
}

export function createMaterialMissingCalculationIssues(params: {
  label: string
  targetId: string
  missingScopeIds: string[]
}) {
  if (params.missingScopeIds.length === 0) return []
  return [
    createDetailsBlockingIssue({
      id: `material:${params.targetId}:calculation:missing`,
      section: 'material',
      targetId: params.targetId,
      field: 'calculation',
      message: `${params.label} calculation data is unavailable; reopen the estimate calculator before continuing.`,
    }),
  ]
}

export function createMaterialMissingProductIssues(params: {
  label: string
  targetId: string
  productWarning?: string
}) {
  if (!params.productWarning) return []
  return [
    createDetailsWarningIssue({
      id: `material:${params.targetId}:paintProductId:missing-catalog-label`,
      section: 'material',
      targetId: params.targetId,
      field: 'paintProductId',
      message: `${params.label} product ${params.productWarning}.`,
    }),
  ]
}

export function createMaterialGroupedOverrideConflictIssue(params: {
  label: string
  targetId: string
  conflictKind: 'duplicate' | 'conflicting'
}) {
  return createDetailsBlockingIssue({
    id: `material:${params.targetId}:overrideGallons:${params.conflictKind}-saved-values`,
    section: 'material',
    targetId: params.targetId,
    field: 'overrideGallons',
    message:
      params.conflictKind === 'duplicate'
        ? `${params.label} has duplicate saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.`
        : `${params.label} has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.`,
  })
}

export function createActiveOverrides(params: {
  wallRows: DetailsScopeLineVm[]
  ceilingRow: DetailsScopeLineVm | null
  trimRow: DetailsScopeLineVm | null
}): DetailsOverrideVm[] {
  return [
    params.wallRows,
    params.ceilingRow ? [params.ceilingRow] : [],
    params.trimRow ? [params.trimRow] : [],
  ]
    .flat()
    .filter((row) => row.hasOverride)
    .map((row) => ({
      key: row.overrideKey,
      itemName: row.label,
      originalValue: row.roundedGallons,
      newValue: row.finalGallons,
    }))
}

export function createValidationIssues(params: {
  wallRows: DetailsScopeLineVm[]
  ceilingRow: DetailsScopeLineVm | null
  trimRow: DetailsScopeLineVm | null
  wallRollerRows: DetailsRollerVm[]
  ceilingRollerRow: DetailsRollerVm | null
  activeMaterialScopeCount?: number
}) {
  const emptyMaterialIssues: DetailsValidationIssue[] =
    params.activeMaterialScopeCount === 0
      ? [
          createDetailsBlockingIssue({
            id: 'material:active-scopes:empty',
            section: 'material',
            targetId: 'active-scopes',
            message: 'Add at least one active wall, ceiling, or trim scope before continuing.',
          }),
        ]
      : []
  const materialValidationIssues = [
    ...emptyMaterialIssues,
    ...params.wallRows.flatMap((row) => row.errors),
    ...(params.ceilingRow?.errors ?? []),
    ...(params.trimRow?.errors ?? []),
  ]
  const issuesById = new Map<string, DetailsValidationIssue>()
  for (const issue of [
    ...materialValidationIssues,
    ...params.wallRollerRows.flatMap((row) => row.errors),
    ...(params.ceilingRollerRow?.errors ?? []),
  ]) {
    if (!issuesById.has(issue.id)) issuesById.set(issue.id, issue)
  }
  return Array.from(issuesById.values())
}

export function getBlockingValidationIssues(validationIssues: DetailsValidationIssue[]) {
  return validationIssues.filter((issue) => issue.severity === 'blocking')
}

export function createValidationSummary(blockingValidationIssues: DetailsValidationIssue[]) {
  return blockingValidationIssues.length === 0
    ? {
        status: 'ready' as const,
        title: 'Ready to continue',
        message: 'Required material planning fields are complete.',
      }
    : {
        status: 'blocked' as const,
        title: 'Summary is blocked',
        message: `${blockingValidationIssues.length} required item${blockingValidationIssues.length === 1 ? '' : 's'} need attention before continuing.`,
      }
}

export function createMaterialCards(params: {
  wallRows: DetailsScopeLineVm[]
  ceilingRow: DetailsScopeLineVm | null
  trimRow: DetailsScopeLineVm | null
  activeOverrides: DetailsOverrideVm[]
  estimatedMaterialCost: number
}) {
  const walls = sumNumbers(params.wallRows, (row) => row.finalGallons)
  const ceilings = params.ceilingRow?.finalGallons ?? 0
  const trim = params.trimRow?.finalGallons ?? 0
  const roundedWallGallons = sumNumbers(params.wallRows, (row) => row.roundedGallons)
  const calculatedPaintGallons =
    sumNumbers(params.wallRows, (row) => row.calculatedGallons) +
    (params.ceilingRow?.calculatedGallons ?? 0) +
    (params.trimRow?.calculatedGallons ?? 0)

  return [
    {
      label: 'Wall Paint',
      finalValue: `${round1(walls)} gal`,
      calculatedValue: `${round1(roundedWallGallons)} rounded`,
      overridden: params.wallRows.some((row) => row.hasOverride),
    },
    {
      label: 'Ceiling Paint',
      finalValue: `${round1(ceilings)} gal`,
      calculatedValue: `${params.ceilingRow?.roundedGallons ?? 0} rounded`,
      overridden: !!params.ceilingRow?.hasOverride,
    },
    {
      label: 'Trim Paint',
      finalValue: `${round1(trim)} gal`,
      calculatedValue: `${params.trimRow?.roundedGallons ?? 0} rounded`,
      overridden: !!params.trimRow?.hasOverride,
    },
    {
      label: 'Total Paint',
      finalValue: `${round1(walls + ceilings + trim)} gal`,
      calculatedValue: `${round1(calculatedPaintGallons)} calc`,
      overridden: params.activeOverrides.length > 0,
    },
    {
      label: 'Current Calculated Material Cost',
      finalValue: `$${Math.round(params.estimatedMaterialCost).toLocaleString('en-US')}`,
      calculatedValue: 'Pricing summary paint + supplies',
      overridden: false,
    },
  ]
}
