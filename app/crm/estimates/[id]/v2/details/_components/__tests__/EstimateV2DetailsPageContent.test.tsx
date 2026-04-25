import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2DetailsPageContent } from '../EstimateV2DetailsPageContent'

const mockUseEstimateV2DetailsPage = vi.fn()
const continueToSummary = vi.fn()
const saveDraft = vi.fn()

vi.mock('../../_state/useEstimateV2DetailsPage', () => ({
  useEstimateV2DetailsPage: (...args: unknown[]) => mockUseEstimateV2DetailsPage(...args),
}))

const basePage = {
  loading: false,
  saving: false,
  error: null,
  dirty: true,
  saveStatus: 'dirty',
  saveStatusText: 'Unsaved changes',
  showValidation: true,
  estimate: { id: 'estimate-1', version_name: 'Version A' },
  job: null,
  routeFamily: null,
  vm: {
    wallRows: [
      {
        id: 'COLOR1',
        label: 'Color 1',
        colorId: 'COLOR1',
        colorName: 'Primary',
        rooms: ['Living'],
        sqFt: 100,
        coats: '2',
        product: 'Wall Paint',
        calculatedGallons: 1.2,
        roundedGallons: 2,
        overrideGallons: '',
        finalGallons: 2,
        overrideKey: 'walls:COLOR1',
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
        label: 'Color 1',
        sublabel: 'Primary',
        sqFt: 100,
        product: 'Wall Paint',
        coverId: '',
        quantity: '',
        notes: '',
        errors: ['Color 1 roller cover is required'],
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
    activeOverrides: [],
    validationIssues: ['Color 1 roller cover is required'],
    validationSummary: {
      status: 'blocked',
      title: 'Summary is blocked',
      message: '1 required item needs attention before continuing.',
    },
    canContinueToSummary: false,
    continueBlockedReason: 'Color 1 roller cover is required',
    gallonsByScope: { walls: 2, ceilings: 0, trim: 0, total: 2 },
    estimatedMaterialCost: 100,
    hasCeilings: false,
    hasTrim: false,
  },
  actions: {
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
    expect(screen.getAllByText('Color 1 roller cover is required').length).toBeGreaterThan(0)
    expect(screen.getByText('Material Overview')).toBeInTheDocument()
    expect(screen.getByText('Paint Planning')).toBeInTheDocument()
    expect(screen.getByText('Rollers & Applicators')).toBeInTheDocument()

    const continueButtons = screen.getAllByRole('button', { name: /Continue to Summary/i })
    expect(continueButtons.every((button) => button.hasAttribute('disabled'))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))
    expect(saveDraft).toHaveBeenCalled()
    expect(continueToSummary).not.toHaveBeenCalled()
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
        validationIssues: ['Rates unavailable'],
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

  it('renders grouped override conflicts in planning and validation surfaces', () => {
    const conflictMessage =
      'Color 1 has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'

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
            errors: [conflictMessage],
          },
        ],
        activeOverrides: [
          {
            key: 'walls:COLOR1',
            itemName: 'Color 1',
            originalValue: 2,
            newValue: 4,
          },
        ],
        validationIssues: [conflictMessage],
        continueBlockedReason: conflictMessage,
      },
    })

    render(<EstimateV2DetailsPageContent estimateId="estimate-1" />)

    expect(screen.getAllByText(conflictMessage).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Color 1').length).toBeGreaterThan(0)
    expect(screen.getByText(/2 to 4 gal/i)).toBeInTheDocument()
  })
})
