import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2DetailsPageContent } from '../EstimateV2DetailsPageContent'

const mockUseEstimateV2DetailsPage = vi.fn()
const continueToSummary = vi.fn()
const returnToEditor = vi.fn()
const saveDraft = vi.fn()

vi.mock('../../_state/useEstimateV2DetailsPage', () => ({
  useEstimateV2DetailsPage: (...args: unknown[]) => mockUseEstimateV2DetailsPage(...args),
}))

function issue(patch: {
  id: string
  message: string
  section?: 'material' | 'rollers' | 'rates' | 'save' | 'unknown'
  targetId?: string
  field?: string
}) {
  return {
    id: patch.id,
    section: patch.section ?? 'unknown',
    targetId: patch.targetId ?? 'test',
    field: patch.field,
    severity: 'blocking',
    message: patch.message,
  }
}

const primaryRollerRequired = issue({
  id: 'rollers:wall:COLOR1:coverId:required',
  section: 'rollers',
  targetId: 'wall:COLOR1',
  field: 'coverId',
  message: 'Primary roller cover is required',
})

const basePage = {
  loading: false,
  saving: false,
  error: null,
  dirty: true,
  saveStatus: 'dirty',
  saveStatusText: 'Unsaved changes',
  estimate: { id: 'estimate-1', version_name: 'Version A' },
  job: null,
  routeFamily: null,
  vm: {
    wallRows: [
      {
        id: 'COLOR1',
        label: 'Primary',
        colorId: 'COLOR1',
        colorName: 'Primary',
        rooms: ['Living'],
        sqFt: 100,
        coats: '2',
        product: 'Wall Paint',
        calculationStatus: 'available',
        calculatedGallons: 1.2,
        roundedGallons: 2,
        overrideGallons: '',
        finalGallons: 2,
        overrideKey: 'walls:color:COLOR1',
        overrideOwnerScopeId: 'wall-1',
        hasOverride: false,
        errors: [],
      },
    ],
    ceilingRow: null,
    trimRow: null,
    wallRollerRows: [
      {
        id: 'wall:COLOR1',
        label: 'Primary',
        sublabel: 'Primary',
        sqFt: 100,
        product: 'Wall Paint',
        coverId: '',
        quantity: '',
        notes: '',
        errors: [primaryRollerRequired],
      },
    ],
    ceilingRollerRow: null,
    trimApplicatorRow: null,
    wallRollerOptions: [{ id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 }],
    ceilingRollerOptions: [],
    trimApplicatorOptions: [],
    rollerOptionsState: {
      status: 'loaded',
      options: [{ id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 }],
      message: null,
    },
    materialCards: [
      { label: 'Wall Paint', finalValue: '2 gal', calculatedValue: '2 rounded', overridden: false },
      { label: 'Total Paint', finalValue: '2 gal', calculatedValue: '1.2 calc', overridden: false },
    ],
    materialPlanningSections: {
      walls: {
        description: '1 active wall color group.',
        emptyTitle: 'No Active Wall Scopes',
        emptyMessage: 'There are no active wall scopes to plan paint or roller covers for.',
      },
      ceilings: {
        description: 'No active ceiling scopes.',
        emptyTitle: 'No Active Ceiling Scopes',
        emptyMessage: 'There are no active ceiling scopes to plan ceiling paint or roller covers for.',
      },
      trim: {
        description: 'No active trim scopes.',
        emptyTitle: 'No Active Trim Scopes',
        emptyMessage: 'There are no active trim scopes to plan trim paint or applicators for.',
      },
    },
    activeOverrides: [],
    validationIssues: [primaryRollerRequired],
    validationSummary: {
      status: 'blocked',
      title: 'Summary is blocked',
      message: '1 required item needs attention before continuing.',
    },
    canContinueToSummary: false,
    continueBlockedReason: 'Primary roller cover is required',
    gallonsByScope: { walls: 2, ceilings: 0, trim: 0, total: 2 },
    estimatedMaterialCost: 100,
    hasCeilings: false,
    hasTrim: false,
  },
  actions: {
    returnToEditor,
    saveDraft,
    continueToSummary,
    setRollerRow: vi.fn(),
    setWallOverride: vi.fn(),
    setCeilingOverride: vi.fn(),
    setTrimOverride: vi.fn(),
  },
}

describe('EstimateV2DetailsPageContent', () => {
  beforeEach(() => {
    continueToSummary.mockReset()
    returnToEditor.mockReset()
    saveDraft.mockReset()
    mockUseEstimateV2DetailsPage.mockReturnValue(basePage)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders validation, save state, material planning, and blocks summary when VM says incomplete', () => {
    render(<EstimateV2DetailsPageContent estimateId="estimate-1" />)

    expect(screen.getByText('Details & Overrides')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getAllByText('Summary is blocked').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Primary roller cover is required').length).toBeGreaterThan(0)
    expect(screen.getByText('Material Overview')).toBeInTheDocument()
    expect(screen.getByText('Paint Planning')).toBeInTheDocument()
    expect(screen.getByText('Rollers & Applicators')).toBeInTheDocument()

    const continueButtons = screen.getAllByRole('button', { name: /Continue to Summary/i })
    expect(continueButtons.every((button) => button.hasAttribute('disabled'))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))
    expect(saveDraft).toHaveBeenCalled()
    expect(continueToSummary).not.toHaveBeenCalled()
  })

  it('routes header back through the guarded page action', () => {
    render(<EstimateV2DetailsPageContent estimateId="estimate-1" />)

    fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))

    expect(returnToEditor).toHaveBeenCalled()
  })

  it('renders unavailable roller option state and keeps summary actions disabled', () => {
    mockUseEstimateV2DetailsPage.mockReturnValue({
      ...basePage,
      vm: {
        ...basePage.vm,
        rollerOptionsState: {
          status: 'unavailable',
          options: [],
          message: 'Rates unavailable',
        },
        wallRollerOptions: [],
        validationIssues: [
          issue({
            id: 'rates:roller-options:unavailable',
            section: 'rates',
            targetId: 'roller-options',
            message: 'Rates unavailable',
          }),
        ],
        validationSummary: {
          status: 'blocked',
          title: 'Summary is blocked',
          message: '1 required item needs attention before continuing.',
        },
        continueBlockedReason: 'Rates unavailable',
      },
    })

    render(<EstimateV2DetailsPageContent estimateId="estimate-1" />)

    expect(screen.getAllByText('Rates unavailable').length).toBeGreaterThan(0)
    const continueButtons = screen.getAllByRole('button', { name: /Continue to Summary/i })
    expect(continueButtons.every((button) => button.hasAttribute('disabled'))).toBe(true)
  })

  it('renders VM-provided material empty states for inactive scope sections', () => {
    const emptyIssue = issue({
      id: 'material:active-scopes:empty',
      section: 'material',
      targetId: 'active-scopes',
      message: 'Add at least one active wall, ceiling, or trim scope before continuing.',
    })
    mockUseEstimateV2DetailsPage.mockReturnValue({
      ...basePage,
      vm: {
        ...basePage.vm,
        wallRows: [],
        ceilingRow: null,
        trimRow: null,
        wallRollerRows: [],
        validationIssues: [emptyIssue],
        continueBlockedReason: emptyIssue.message,
      },
    })

    render(<EstimateV2DetailsPageContent estimateId="estimate-1" />)

    expect(screen.getByText('No Active Wall Scopes')).toBeInTheDocument()
    expect(screen.getByText('No Active Ceiling Scopes')).toBeInTheDocument()
    expect(screen.getByText('No Active Trim Scopes')).toBeInTheDocument()
    expect(screen.getAllByText(emptyIssue.message).length).toBeGreaterThan(0)
  })

  it('renders grouped override conflicts in planning and validation surfaces', () => {
    const conflictMessage =
      'Primary has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
    const conflictIssue = issue({
      id: 'material:COLOR1:overrideGallons:conflicting-saved-values',
      section: 'material',
      targetId: 'COLOR1',
      field: 'overrideGallons',
      message: conflictMessage,
    })

    mockUseEstimateV2DetailsPage.mockReturnValue({
      ...basePage,
      vm: {
        ...basePage.vm,
        wallRows: [
          {
            ...basePage.vm.wallRows[0],
            overrideGallons: '4',
            finalGallons: 4,
            hasOverride: true,
            errors: [conflictIssue],
          },
        ],
        activeOverrides: [
          {
            key: 'walls:color:COLOR1',
            itemName: 'Primary',
            originalValue: 2,
            newValue: 4,
          },
        ],
        validationIssues: [conflictIssue],
        continueBlockedReason: conflictMessage,
      },
    })

    render(<EstimateV2DetailsPageContent estimateId="estimate-1" />)

    expect(screen.getAllByText(conflictMessage).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Primary').length).toBeGreaterThan(0)
    expect(screen.getByText(/2 to 4 gal/i)).toBeInTheDocument()
  })
})
