import { describe, expect, it } from 'vitest'
import {
  buildEstimateV2MaterialPlanningVm,
  buildEstimateV2RollerPlanningVm,
  buildEstimateV2TotalsVm,
  buildEstimateV2ValidationVm,
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  extractEstimateV2DetailsCalculationRows,
  parseRollerCoverOptionsFromRatesFlags,
  parseRollerCoverOptionsStateFromRatesFlags,
} from '../estimateV2DetailsVm'
import {
  createWallRows,
} from '../estimateV2DetailsMaterials'
import {
  applyGroupedMaterialOverridePersistencePolicy,
  resolveGroupedOverride,
} from '../estimateV2DetailsMaterialOverrides'
import { calculationRowsById } from '../estimateV2DetailsMaterialCalculations'
import { resolveRollerRowState, validateRollerRow } from '../estimateV2DetailsRollers'
import { formatDetailsNumber } from '../estimateV2DetailsShared'
import {
  createMaterialCards,
  createValidationIssues,
  createValidationSummary,
  getBlockingValidationIssues,
} from '../estimateV2DetailsValidation'
import {
  buildVm,
  buildVmParams,
  ceilingCalculationRow,
  ceilingScope,
  rooms,
  testIssue,
  trimCalculationRow,
  trimScope,
  validationIds,
  validationMessages,
  wallCalculationRow,
  wallScope,
} from './estimateV2DetailsVm.testUtils'
import type {
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'

type DetailsVm = ReturnType<typeof buildVm>

describe('estimate details VM rollers', () => {

  it('builds the roller planning VM from material rows and scoped option pools', () => {
    const params = buildVmParams({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: '',
          position: 0,
        },
      ],
    })
    const materialPlanning = buildEstimateV2MaterialPlanningVm(params)
    const rollerPlanning = buildEstimateV2RollerPlanningVm({
      materialPlanning,
      rollerOptions: params.rollerOptions,
      rollers: params.rollers,
    })

    expect(rollerPlanning.wallRollerOptions.map((option) => option.id)).toEqual(['WALL_9'])
    expect(rollerPlanning.ceilingRollerOptions.map((option) => option.id)).toEqual(['CEIL_14'])
    expect(rollerPlanning.wallRollerRows.find((row) => row.id === 'wall:COLOR1')).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
    })
    expect(rollerPlanning.ceilingRollerRow).toMatchObject({ id: 'ceiling' })
    expect(rollerPlanning.trimApplicatorSummary).toEqual({
      active: true,
      label: '1 brush + 1 roller included automatically per color',
    })
  })


  it('hydrates roller state from the focused roller helper', () => {
    expect(
      resolveRollerRowState({
        label: 'Primary',
        targetId: 'wall:COLOR1',
        draft: {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved note',
          position: 0,
        },
        options: [{ id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 }],
        scope: 'Wall',
      })
    ).toEqual({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Saved note',
      hydrationErrors: [],
    })
  })


  it('hydrates roller state by saved active selected option id before size fallback', () => {
    expect(
      resolveRollerRowState({
        label: 'Primary',
        targetId: 'wall:COLOR1',
        draft: {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_PREMIUM',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved premium',
          position: 0,
        },
        options: [
          { id: 'WALL_9_STANDARD', label: 'Wall standard 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
          { id: 'WALL_9_PREMIUM', label: 'Wall premium 9"', scope: 'Wall', sizeIn: 9, priceEach: 8 },
        ],
        scope: 'Wall',
      })
    ).toEqual({
      coverId: 'WALL_9_PREMIUM',
      quantity: '2',
      notes: 'Saved premium',
      hydrationErrors: [],
    })
  })


  it('falls back to a unique saved size when saved selected option id is stale', () => {
    expect(
      resolveRollerRowState({
        label: 'Primary',
        targetId: 'wall:COLOR1',
        draft: {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_ARCHIVED',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved stale id',
          position: 0,
        },
        options: [
          { id: 'WALL_9_REPLACEMENT', label: 'Wall replacement 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
          { id: 'WALL_12', label: 'Wall 12"', scope: 'Wall', sizeIn: 12, priceEach: 7 },
        ],
        scope: 'Wall',
      })
    ).toEqual({
      coverId: 'WALL_9_REPLACEMENT',
      quantity: '2',
      notes: 'Saved stale id',
      hydrationErrors: [],
    })
  })


  it('blocks stale saved selected option id when no safe saved-size fallback exists', () => {
    expect(
      resolveRollerRowState({
        label: 'Primary',
        targetId: 'wall:COLOR1',
        draft: {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_ARCHIVED',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved stale id',
          position: 0,
        },
        options: [{ id: 'WALL_12', label: 'Wall 12"', scope: 'Wall', sizeIn: 12, priceEach: 7 }],
        scope: 'Wall',
      })
    ).toEqual({
      coverId: '',
      quantity: '2',
      notes: 'Saved stale id',
      hydrationErrors: [
        {
          id: 'rollers:wall:COLOR1:coverId:stale-option',
          section: 'rollers',
          targetId: 'wall:COLOR1',
          field: 'coverId',
          severity: 'blocking',
          message:
            'Primary saved wall roller cover option WALL_9_ARCHIVED is no longer active; select an active option before continuing.',
        },
      ],
    })
  })


  it('keeps saved-size ambiguity blocking when saved selected option id is stale', () => {
    const state = resolveRollerRowState({
      label: 'Primary',
      targetId: 'wall:COLOR1',
      draft: {
        id: 'roller-wall-1',
        scope: 'Wall',
        wallColorId: 'COLOR1',
        selectedOptionId: 'WALL_9_ARCHIVED',
        rollerSizeIn: '9',
        coversQty: '2',
        notes: 'Saved stale id',
        position: 0,
      },
      options: [
        { id: 'WALL_9_STANDARD', label: 'Wall standard 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
        { id: 'WALL_9_PREMIUM', label: 'Wall premium 9"', scope: 'Wall', sizeIn: 9, priceEach: 8 },
      ],
      scope: 'Wall',
    })

    expect(state).toMatchObject({
      coverId: '',
      quantity: '2',
      notes: 'Saved stale id',
    })
    expect(state.hydrationErrors).toEqual([
      {
        id: 'rollers:wall:COLOR1:coverId:ambiguous-size',
        section: 'rollers',
        targetId: 'wall:COLOR1',
        field: 'coverId',
        severity: 'blocking',
        message:
          'Primary saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.',
      },
    ])
  })


  it('maps roller quantity normalization reasons to specific validation issues', () => {
    const option = { id: 'WALL_9', label: 'Wall 9"', scope: 'Wall' as const, sizeIn: 9, priceEach: 6 }
    const optionsState = { status: 'loaded' as const, options: [option], message: null }
    const baseRow = {
      id: 'wall:COLOR1',
      label: 'Primary',
      sublabel: 'Primary',
      sqFt: 100,
      product: 'Wall Paint',
      coverId: 'WALL_9',
      notes: '',
      errors: [],
    }
    const cases = [
      ['', 'rollers:wall:COLOR1:quantity:required', 'Primary roller quantity is required'],
      ['abc', 'rollers:wall:COLOR1:quantity:invalid-number', 'Primary roller quantity must be a number'],
      ['1.5', 'rollers:wall:COLOR1:quantity:whole-number', 'Primary roller quantity must be a whole number'],
      ['0', 'rollers:wall:COLOR1:quantity:positive-number', 'Primary roller quantity must be greater than zero'],
      ['-1', 'rollers:wall:COLOR1:quantity:positive-number', 'Primary roller quantity must be greater than zero'],
    ] as const

    for (const [quantity, id, message] of cases) {
      const issues = validateRollerRow(
        { ...baseRow, quantity },
        optionsState,
        [option]
      )
      expect(issues).toContainEqual({
        id,
        section: 'rollers',
        targetId: 'wall:COLOR1',
        field: 'quantity',
        severity: 'blocking',
        message,
      })
    }

    expect(validateRollerRow({ ...baseRow, quantity: ' 2 ' }, optionsState, [option])).toEqual([])
  })


  it('matches unassigned wall roller drafts after save and reload normalization', () => {
    const vm = buildVm({
      wallScopes: [
        wallScope({
          id: 'wall-unassigned',
          colorId: '',
          scopeName: 'Powder bath walls',
        }),
      ],
      ceilingScopes: [],
      trimScopes: [],
      wallCalculations: [
        wallCalculationRow({
          id: 'wall-unassigned',
          effectiveAreaSf: 80,
          rawPaintGallons: 0.9,
        }),
      ],
      rollers: [
        {
          id: 'roller-wall-unassigned',
          scope: 'Wall',
          wallColorId: 'scope:wall-unassigned',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved unassigned scope',
          position: 0,
        },
      ],
    })

    expect(vm.wallRollerRows[0]).toMatchObject({
      id: 'wall:scope:wall-unassigned',
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Saved unassigned scope',
      errors: [],
    })
  })


  it('continues matching color-based wall roller drafts case-insensitively', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'color1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'roller-trim',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRollerRows.find((row) => row.id === 'wall:COLOR1')).toMatchObject({
      coverId: 'WALL_9',
      quantity: '1',
    })
  })


  it('validates missing required roller settings', () => {
    const vm = buildVm()
    expect(validationMessages(vm)).toContain('Primary roller cover is required')
    expect(validationMessages(vm)).toContain('Ceilings roller quantity is required')
    expect(vm.canContinueToSummary).toBe(false)
    expect(vm.validationSummary).toMatchObject({
      status: 'blocked',
      title: 'Summary is blocked',
    })
  })


  it('validates roller quantities with the canonical whole-number rule', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1.5',
          notes: '',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: ' 2 ',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'roller-trim',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRollerRows.find((row) => row.id === 'wall:COLOR2')).toMatchObject({
      quantity: '2',
      errors: [],
    })
    expect(validationIds(vm)).toContain('rollers:wall:COLOR1:quantity:whole-number')
    expect(validationMessages(vm)).toContain('Primary roller quantity must be a whole number')
    expect(vm.canContinueToSummary).toBe(false)
  })


  it('does not ask users to select roller covers while options are unavailable', () => {
    const vm = buildVm({
      rollerOptions: [],
      rollerOptionsState: {
        status: 'unavailable',
        options: [],
        message: 'Roller and applicator options failed to load.',
      },
    })

    expect(vm.rollerOptionsState.status).toBe('unavailable')
    expect(validationMessages(vm)).toContain('Roller and applicator options failed to load.')
    expect(validationMessages(vm)).not.toContain('Primary roller cover is required')
  })


  it('represents configured-but-empty roller options explicitly', () => {
    const vm = buildVm({
      rollerOptions: [],
      rollerOptionsState: {
        status: 'empty',
        options: [],
        message: 'No roller or applicator options are configured in rates and flags.',
      },
    })

    expect(vm.rollerOptionsState.status).toBe('empty')
    expect(validationMessages(vm)).toContain('Wall roller cover options are not configured')
    expect(validationMessages(vm)).toContain('Ceiling roller cover options are not configured')
    expect(validationMessages(vm)).not.toContain('Trim applicator options are not configured')
    expect(validationMessages(vm)).not.toContain('Primary roller cover is required')
  })


  it('hydrates roller selections from persisted stable option identities', () => {
    const vm = buildVm({
      rollerOptions: [
        { id: 'WALL_9_STANDARD', label: 'Wall standard 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
        { id: 'WALL_9_PREMIUM', label: 'Wall premium 9"', scope: 'Wall', sizeIn: 9, priceEach: 8 },
        { id: 'CEIL_14_STANDARD', label: 'Ceiling standard 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
        { id: 'CEIL_14_WIDE', label: 'Ceiling wide 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 12 },
        { id: 'TRIM_4_STANDARD', label: 'Trim standard 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
        { id: 'TRIM_4_DETAIL', label: 'Trim detail 4"', scope: 'Trim', sizeIn: 4, priceEach: 5 },
      ],
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_PREMIUM',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved note',
          position: 0,
        },
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14_WIDE',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4_DETAIL',
          rollerSizeIn: '4',
          coversQty: '2',
          notes: 'Saved trim note',
          position: 2,
        },
      ],
    })

    expect(vm.wallRollerRows[0]).toMatchObject({
      coverId: 'WALL_9_PREMIUM',
      quantity: '2',
      notes: 'Saved note',
      errors: [],
    })
    expect(vm.ceilingRollerRow).toMatchObject({
      coverId: 'CEIL_14_WIDE',
      quantity: '1',
      errors: [],
    })
    expect(vm.trimApplicatorSummary).toMatchObject({ active: true })
    expect(vm.canContinueToSummary).toBe(false)
    expect(validationMessages(vm)).not.toContain(
      'Primary saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.'
    )
  })


  it('hydrates persisted roller drafts through normalized row identities', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-case',
          scope: 'Wall',
          wallColorId: 'color1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Case-insensitive color',
          position: 0,
        },
        {
          id: 'roller-ceiling-colored',
          scope: 'Ceiling',
          wallColorId: 'COLOR1',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: 'Aggregate ignores color',
          position: 1,
        },
        {
          id: 'applicator-trim-colored',
          scope: 'Trim',
          wallColorId: 'COLOR2',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '4',
          coversQty: '3',
          notes: 'Trim ignores color',
          position: 2,
        },
      ],
    })

    expect(vm.wallRollerRows.find((row) => row.id === 'wall:COLOR1')).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Case-insensitive color',
      errors: [],
    })
    expect(vm.ceilingRollerRow).toMatchObject({
      id: 'ceiling',
      coverId: 'CEIL_14',
      quantity: '1',
      notes: 'Aggregate ignores color',
      errors: [],
    })
    expect(vm.trimApplicatorSummary).toMatchObject({ active: true })
  })


  it('hydrates legacy size-only roller selections from persisted roller rows', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved note',
          position: 0,
        },
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          rollerSizeIn: '4',
          coversQty: '2',
          notes: 'Saved trim note',
          position: 2,
        },
      ],
    })

    expect(vm.wallRollerRows[0]).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Saved note',
      errors: [],
    })
    expect(vm.ceilingRollerRow).toMatchObject({
      coverId: 'CEIL_14',
      quantity: '1',
      errors: [],
    })
    expect(vm.trimApplicatorSummary).toMatchObject({ active: true })
  })


  it('surfaces a stale saved selected option id through details VM validation', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_ARCHIVED',
          rollerSizeIn: '99',
          coversQty: '2',
          notes: 'Archived option',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'roller-trim',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRollerRows.find((row) => row.id === 'wall:COLOR1')).toMatchObject({
      coverId: '',
      quantity: '2',
      notes: 'Archived option',
    })
    expect(validationIds(vm)).toContain('rollers:wall:COLOR1:coverId:stale-option')
    expect(validationMessages(vm)).toContain(
      'Primary saved wall roller cover option WALL_9_ARCHIVED is no longer active; select an active option before continuing.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })


  it('blocks ambiguous wall roller hydration when active options share the saved size', () => {
    const vm = buildVm({
      rollerOptions: [
        { id: 'WALL_9_STANDARD', label: 'Wall standard 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
        { id: 'WALL_9_PREMIUM', label: 'Wall premium 9"', scope: 'Wall', sizeIn: 9, priceEach: 8 },
        { id: 'CEIL_14', label: 'Ceiling 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
        { id: 'TRIM_4', label: 'Trim applicator 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
      ],
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved note',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          rollerSizeIn: '12',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRollerRows[0]).toMatchObject({
      coverId: '',
      quantity: '2',
      notes: 'Saved note',
    })
    expect(validationMessages(vm)).toContain(
      'Primary saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })


  it('blocks ambiguous aggregate roller and applicator hydration when active options share saved sizes', () => {
    const vm = buildVm({
      wallScopes: [],
      rollerOptions: [
        { id: 'CEIL_14_STANDARD', label: 'Ceiling standard 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
        { id: 'CEIL_14_WIDE', label: 'Ceiling wide 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 12 },
        { id: 'TRIM_4_STANDARD', label: 'Trim standard 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
        { id: 'TRIM_4_DETAIL', label: 'Trim detail 4"', scope: 'Trim', sizeIn: 4, priceEach: 5 },
      ],
      rollers: [
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 0,
        },
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 1,
        },
      ],
    })

    expect(vm.ceilingRollerRow).toMatchObject({ coverId: '', quantity: '1' })
    expect(vm.trimApplicatorSummary).toMatchObject({ active: true })
    expect(validationMessages(vm)).toContain(
      'Ceilings saved ceiling roller cover size 14" matches multiple active options; make sizes unique before continuing.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })


  it('parses roller covers from the rates flags roller cover category', () => {
    const options = parseRollerCoverOptionsFromRatesFlags({
      categories: [
        {
          key: 'supply_rates_roller_covers',
          rows: [
            { id: 'WALL_9', display_name: 'Wall', scope: 'Wall', size_in: '9', price_each: '6', active: 'Y' },
            { id: 'WALL_ARCHIVED', display_name: 'Archived wall', scope: 'Wall', size_in: '9', price_each: '1', active: 'N' },
            { id: 'CEIL_14', display_name: 'Ceiling', scope: 'Ceiling', size_in: '14', price_each: '10', active: 'Y' },
            { id: 'TRIM_4', display_name: 'Trim applicator', scope: 'Trim', size_in: '4', price_each: '4', active: 'Y' },
          ],
        },
      ],
    })

    expect(options).toEqual([
      { id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
      { id: 'CEIL_14', label: 'Ceiling 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
      { id: 'TRIM_4', label: 'Trim applicator 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
    ])
  })


  it('classifies malformed and empty roller cover payloads', () => {
    expect(parseRollerCoverOptionsStateFromRatesFlags({ categories: null })).toMatchObject({
      status: 'unavailable',
      options: [],
    })

    expect(parseRollerCoverOptionsStateFromRatesFlags({ categories: [{}] })).toMatchObject({
      status: 'unavailable',
      options: [],
    })

    expect(
      parseRollerCoverOptionsStateFromRatesFlags({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
      })
    ).toMatchObject({
      status: 'empty',
      options: [],
    })
  })

})
