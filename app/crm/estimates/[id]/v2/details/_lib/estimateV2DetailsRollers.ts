import { asMaybeNumber } from '@/lib/estimator/parsing'
import {
  normalizeRollerApplicatorQuantity,
  type RollerApplicatorQuantityReason,
} from '@/lib/estimator/rollerQuantities'
import type { EstimateV2RollerDraft, EstimateV2RollerScope } from '@/types/estimator/v2'
import type {
  DetailsRollerCoverOption,
  DetailsRollerOptionsState,
  DetailsRollerRowState,
  DetailsRollerVm,
  DetailsScopeLineVm,
  DetailsValidationIssue,
} from './estimateV2DetailsVm'
import { cleanInputNumber } from './estimateV2DetailsShared'
import {
  createAggregateDetailsRollerRowTarget,
  createWallDetailsRollerRowTarget,
  detailsRollerRowId,
  findDetailsRollerDraft,
} from './estimateV2DetailsRollerIdentity'
import { createDetailsBlockingIssue } from './estimateV2DetailsValidation'

function rollerOptionsTargetId(row: DetailsRollerVm) {
  if (row.id === 'trim') return 'trim-applicator-options'
  if (row.id === 'ceiling') return 'ceiling-roller-cover-options'
  return 'wall-roller-cover-options'
}

function rollerQuantityIssueDetails(reason: RollerApplicatorQuantityReason) {
  if (reason === 'empty') {
    return {
      idSuffix: 'required',
      messageSuffix: 'is required',
    }
  }
  if (reason === 'not-number') {
    return {
      idSuffix: 'invalid-number',
      messageSuffix: 'must be a number',
    }
  }
  if (reason === 'not-integer') {
    return {
      idSuffix: 'whole-number',
      messageSuffix: 'must be a whole number',
    }
  }
  return {
    idSuffix: 'positive-number',
    messageSuffix: 'must be greater than zero',
  }
}

export function validateRollerRow(
  row: DetailsRollerVm,
  optionsState: DetailsRollerOptionsState,
  scopedOptions: DetailsRollerCoverOption[]
) {
  const issues: DetailsValidationIssue[] = []
  if (optionsState.status === 'loading') {
    issues.push(createDetailsBlockingIssue({
      id: 'rates:roller-options:loading',
      section: 'rates',
      targetId: 'roller-options',
      message: 'Roller and applicator options are still loading',
    }))
  } else if (optionsState.status === 'unavailable') {
    issues.push(createDetailsBlockingIssue({
      id: 'rates:roller-options:unavailable',
      section: 'rates',
      targetId: 'roller-options',
      message: optionsState.message,
    }))
  } else if (scopedOptions.length === 0) {
    issues.push(
      createDetailsBlockingIssue({
        id: `rates:${rollerOptionsTargetId(row)}:empty`,
        section: 'rates',
        targetId: rollerOptionsTargetId(row),
        field: 'coverId',
        message: `${row.id === 'trim' ? 'Trim applicator' : row.id === 'ceiling' ? 'Ceiling roller cover' : 'Wall roller cover'} options are not configured`,
      })
    )
  } else if (!row.coverId) {
    issues.push(createDetailsBlockingIssue({
      id: `rollers:${row.id}:coverId:required`,
      section: 'rollers',
      targetId: row.id,
      field: 'coverId',
      message: `${row.label} ${row.id === 'trim' ? 'applicator' : 'roller cover'} is required`,
    }))
  }
  const quantity = normalizeRollerApplicatorQuantity(row.quantity)
  if (!quantity.ok) {
    const details = rollerQuantityIssueDetails(quantity.reason)
    issues.push(createDetailsBlockingIssue({
      id: `rollers:${row.id}:quantity:${details.idSuffix}`,
      section: 'rollers',
      targetId: row.id,
      field: 'quantity',
      message: `${row.label} quantity ${details.messageSuffix}`,
    }))
  }
  return issues
}

export function rollerDraftByScope(params: {
  rollers: EstimateV2RollerDraft[]
  scope: EstimateV2RollerScope
  wallColorId?: string
}) {
  return findDetailsRollerDraft({
    rollers: params.rollers,
    target:
      params.scope === 'Ceiling' || params.scope === 'Trim'
        ? createAggregateDetailsRollerRowTarget(params.scope)
        : createWallDetailsRollerRowTarget(params.wallColorId ?? ''),
  })
}

function rollerOptionScopeLabel(scope: DetailsRollerCoverOption['scope']) {
  if (scope === 'Trim') return 'trim applicator'
  if (scope === 'Ceiling') return 'ceiling roller cover'
  if (scope === 'Wall') return 'wall roller cover'
  return 'roller cover'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRatesFlagsCategories(payload: unknown) {
  if (!isRecord(payload)) return null
  return Array.isArray(payload.categories) ? payload.categories : null
}

function findRollerCoverCategory(categories: unknown[]) {
  return categories.find(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.key === 'supply_rates_roller_covers'
  )
}

function normalizeRollerOptionScope(scope: unknown): DetailsRollerCoverOption['scope'] {
  const value = String(scope ?? 'Other').toLowerCase()
  if (value.startsWith('wall')) return 'Wall'
  if (value.startsWith('ceil')) return 'Ceiling'
  if (value.startsWith('trim')) return 'Trim'
  return 'Other'
}

function createStaleSelectedOptionIssue(params: {
  label: string
  targetId: string
  scope: DetailsRollerCoverOption['scope']
  selectedOptionId: string
}): DetailsValidationIssue {
  return createDetailsBlockingIssue({
    id: `rollers:${params.targetId}:coverId:stale-option`,
    section: 'rollers',
    targetId: params.targetId,
    field: 'coverId',
    message: `${params.label} saved ${rollerOptionScopeLabel(params.scope)} option ${params.selectedOptionId} is no longer active; select an active option before continuing.`,
  })
}

export function resolveRollerRowState(params: {
  label: string
  targetId: string
  draft: EstimateV2RollerDraft | null | undefined
  options: DetailsRollerCoverOption[]
  scope: DetailsRollerCoverOption['scope']
}): DetailsRollerRowState & { hydrationErrors: DetailsValidationIssue[] } {
  const selectedOptionId = params.draft?.selectedOptionId?.trim() ?? ''
  const quantity = normalizeRollerApplicatorQuantity(params.draft?.coversQty ?? '')
  if (selectedOptionId) {
    const selectedOption = params.options.find(
      (option) => option.scope === params.scope && option.id === selectedOptionId
    )
    if (selectedOption) {
      return {
        coverId: selectedOption.id,
        quantity: quantity.displayValue,
        notes: params.draft?.notes ?? '',
        hydrationErrors: [],
      }
    }
  }

  const size = cleanInputNumber(params.draft?.rollerSizeIn ?? '')
  const matchingOptions = params.options.filter(
    (option) => option.scope === params.scope && option.sizeIn != null && option.sizeIn === size
  )
  const isAmbiguous = size != null && matchingOptions.length > 1
  const canHydrateBySize = matchingOptions.length === 1
  const hydrationErrors: DetailsValidationIssue[] = isAmbiguous
    ? [
        createDetailsBlockingIssue({
          id: `rollers:${params.targetId}:coverId:ambiguous-size`,
          section: 'rollers',
          targetId: params.targetId,
          field: 'coverId',
          message: `${params.label} saved ${rollerOptionScopeLabel(params.scope)} size ${size}" matches multiple active options; make sizes unique before continuing.`,
        }),
      ]
    : selectedOptionId && !canHydrateBySize
      ? [
          createStaleSelectedOptionIssue({
            label: params.label,
            targetId: params.targetId,
            scope: params.scope,
            selectedOptionId,
          }),
        ]
      : []
  return {
    coverId: canHydrateBySize ? matchingOptions[0].id : '',
    quantity: quantity.displayValue,
    notes: params.draft?.notes ?? '',
    hydrationErrors,
  }
}

export function createWallRollerRows(params: {
  wallRows: DetailsScopeLineVm[]
  rollers: EstimateV2RollerDraft[]
  rollerOptions: DetailsRollerCoverOption[]
  rollerOptionsState: DetailsRollerOptionsState
  wallRollerOptions: DetailsRollerCoverOption[]
}) {
  return params.wallRows.map((row) => {
    const target = createWallDetailsRollerRowTarget(row.id)
    const targetId = detailsRollerRowId(target)
    const state = resolveRollerRowState({
      label: row.label,
      targetId,
      draft: rollerDraftByScope({ rollers: params.rollers, ...target }),
      options: params.rollerOptions,
      scope: 'Wall',
    })
    const rollerRow = {
      id: targetId,
      label: row.label,
      sublabel: row.colorName,
      sqFt: row.sqFt,
      product: row.product,
      coverId: state.coverId,
      quantity: state.quantity,
      notes: state.notes,
      errors: [] as DetailsValidationIssue[],
    }
    return {
      ...rollerRow,
      errors: [
        ...state.hydrationErrors,
        ...validateRollerRow(rollerRow, params.rollerOptionsState, params.wallRollerOptions),
      ],
    }
  })
}

export function createCeilingRollerRow(params: {
  ceilingRow: DetailsScopeLineVm | null
  rollers: EstimateV2RollerDraft[]
  rollerOptions: DetailsRollerCoverOption[]
  rollerOptionsState: DetailsRollerOptionsState
  ceilingRollerOptions: DetailsRollerCoverOption[]
}) {
  const target = createAggregateDetailsRollerRowTarget('Ceiling')
  const targetId = detailsRollerRowId(target)
  const state = resolveRollerRowState({
    label: 'Ceilings',
    targetId,
    draft: findDetailsRollerDraft({ rollers: params.rollers, target }),
    options: params.rollerOptions,
    scope: 'Ceiling',
  })
  const ceilingRollerRow = params.ceilingRow
    ? {
        id: targetId,
        label: 'Ceilings',
        sublabel: 'All active ceiling scopes',
        sqFt: params.ceilingRow.sqFt,
        product: params.ceilingRow.product,
        coverId: state.coverId,
        quantity: state.quantity,
        notes: state.notes,
        errors: [] as DetailsValidationIssue[],
      }
    : null

  return ceilingRollerRow
    ? {
        ...ceilingRollerRow,
        errors: [
          ...state.hydrationErrors,
          ...validateRollerRow(ceilingRollerRow, params.rollerOptionsState, params.ceilingRollerOptions),
        ],
      }
    : null
}

export function createTrimApplicatorRow(params: {
  trimRow: DetailsScopeLineVm | null
  rollers: EstimateV2RollerDraft[]
  rollerOptions: DetailsRollerCoverOption[]
  rollerOptionsState: DetailsRollerOptionsState
  trimApplicatorOptions: DetailsRollerCoverOption[]
}) {
  const target = createAggregateDetailsRollerRowTarget('Trim')
  const targetId = detailsRollerRowId(target)
  const state = resolveRollerRowState({
    label: 'Trim & Baseboards',
    targetId,
    draft: findDetailsRollerDraft({ rollers: params.rollers, target }),
    options: params.rollerOptions,
    scope: 'Trim',
  })
  const trimApplicatorRow = params.trimRow
    ? {
        id: targetId,
        label: 'Trim & Baseboards',
        sublabel: 'All active trim scopes',
        sqFt: params.trimRow.sqFt,
        product: params.trimRow.product,
        coverId: state.coverId,
        quantity: state.quantity,
        notes: state.notes,
        errors: [] as DetailsValidationIssue[],
      }
    : null

  return trimApplicatorRow
    ? {
        ...trimApplicatorRow,
        errors: [
          ...state.hydrationErrors,
          ...validateRollerRow(trimApplicatorRow, params.rollerOptionsState, params.trimApplicatorOptions),
        ],
      }
    : null
}

export function parseRollerCoverOptionsFromRatesFlags(payload: unknown): DetailsRollerCoverOption[] {
  return parseRollerCoverOptionsStateFromRatesFlags(payload).options
}

export function parseRollerCoverOptionsStateFromRatesFlags(
  payload: unknown
): DetailsRollerOptionsState {
  const categories = getRatesFlagsCategories(payload)
  if (!categories) {
    return {
      status: 'unavailable',
      options: [],
      message: 'Roller and applicator options could not be read from rates and flags.',
    }
  }
  const category = findRollerCoverCategory(categories)
  if (!category || !Array.isArray(category.rows)) {
    return {
      status: 'unavailable',
      options: [],
      message: 'Roller and applicator options could not be read from rates and flags.',
    }
  }

  const options = category.rows
    .filter(isRecord)
    .filter((row) => String(row.active ?? 'Y').toUpperCase() !== 'N')
    .map((row): DetailsRollerCoverOption => {
      return {
        id: String(row.id ?? ''),
        label: `${row.display_name ?? row.id ?? 'Roller cover'}${row.size_in ? ` ${row.size_in}"` : ''}`,
        scope: normalizeRollerOptionScope(row.scope),
        sizeIn: asMaybeNumber(row.size_in),
        priceEach: asMaybeNumber(row.price_each),
      }
    })
    .filter((row) => row.id)

  if (options.length === 0) {
    return {
      status: 'empty',
      options,
      message: 'No roller or applicator options are configured in rates and flags.',
    }
  }

  return {
    status: 'loaded',
    options,
    message: null,
  }
}
