import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InsightsPageContent } from '../InsightsPageContent'

const { mockUseInsightsTrendsPage, mockCancelApply, mockConfirmApply } = vi.hoisted(() => ({
  mockUseInsightsTrendsPage: vi.fn(),
  mockCancelApply: vi.fn(),
  mockConfirmApply: vi.fn(),
}))

vi.mock('../_hooks/useInsightsTrendsPage', () => ({
  useInsightsTrendsPage: mockUseInsightsTrendsPage,
}))

const basePageState = {
  loading: false,
  error: null,
  hasData: true,
  filters: {
    from: null,
    to: null,
    jobType: null,
    occupancy: null,
    conditionTags: [],
  },
  filterInputs: {
    conditionTags: '',
  },
  setFilter: vi.fn(),
  resetFilters: vi.fn(),
  applyRecommendation: vi.fn(),
  cancelApplyRecommendation: mockCancelApply,
  confirmApplyRecommendation: mockConfirmApply,
  dismissRecommendation: vi.fn(),
  generateRecommendations: vi.fn(),
  feedback: {
    actionError: null,
    actionNotice: null,
  },
  recommendationActionState: {
    pendingId: null,
    pendingAction: null,
    generating: false,
    confirmingApplyId: null,
  },
  refresh: vi.fn(async () => true),
  vm: {
    kpis: [],
    jobsAnalyzedLabel: '0 jobs',
    hasMetrics: false,
    varianceRows: [],
    patterns: [],
    recommendationCountLabel: '1 open',
    recommendations: [
      {
        id: 'rec-1',
        title: 'Production Rates Walls',
        targetSettingKey: 'production_rates_walls:WALL_STD:sqft_per_hr',
        currentValue: 'sqft_per_hr: 150',
        suggestedValue: 'sqft_per_hr: 135',
        confidenceLabel: 'High',
        confidenceTone: 'success',
        reason: 'Locked reviews show labor hours high.',
        evidence: ['Average variance: 3'],
        basedOnJobCountLabel: '10 jobs',
      },
    ],
  },
}

describe('InsightsPageContent', () => {
  beforeEach(() => {
    mockCancelApply.mockReset()
    mockConfirmApply.mockReset()
    mockUseInsightsTrendsPage.mockReset()
    mockUseInsightsTrendsPage.mockReturnValue(basePageState)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders explicit apply confirmation copy before activating a setting set', () => {
    mockUseInsightsTrendsPage.mockReturnValue({
      ...basePageState,
      recommendationActionState: {
        ...basePageState.recommendationActionState,
        confirmingApplyId: 'rec-1',
      },
    })

    render(<InsightsPageContent />)

    const dialog = screen.getByRole('dialog', { name: 'Apply recommendation?' })
    expect(
      within(dialog).getByText(/This activates a new estimator setting set immediately/i)
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/New estimates will use the suggested setting/i)
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/production_rates_walls:WALL_STD:sqft_per_hr/i)
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate setting set' }))

    expect(mockConfirmApply).toHaveBeenCalledTimes(1)
  })

  it('keeps apply, dismiss, and generate actions accessible', () => {
    render(<InsightsPageContent />)

    expect(
      screen.getAllByRole('button', { name: /Generate recommendations/i }).length
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
  })
})
