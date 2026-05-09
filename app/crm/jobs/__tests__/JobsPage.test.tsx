import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobsPage from '../page'

const mockUseJobsBoardPage = vi.fn()

vi.mock('@/app/crm/jobs/_hooks/useJobsBoardPage', () => ({
  useJobsBoardPage: () => mockUseJobsBoardPage(),
}))

vi.mock('@/app/crm/jobs/_components/StageEmailModal', () => ({
  default: () => null,
}))

vi.mock('@/app/crm/jobs/_components/JobCompletionCloseoutModal', () => ({
  default: () => null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('JobsPage', () => {
  beforeEach(() => {
    mockUseJobsBoardPage.mockReset()
  })

  it('renders the shared board header, notices, and completed search surface', () => {
    mockUseJobsBoardPage.mockReturnValue({
      loading: false,
      error: null,
      notice: 'Board updated.',
      completedQuery: '',
      setCompletedQuery: vi.fn(),
      showAllCompleted: false,
      setShowAllCompleted: vi.fn(),
      showCompleted: true,
      setShowCompleted: vi.fn(),
      showLost: false,
      setShowLost: vi.fn(),
      showEmptyStages: false,
      setShowEmptyStages: vi.fn(),
      compactActions: false,
      emailJobId: null,
      emailStage: null,
      closeoutJobId: null,
      grouped: {
        estimate_scheduled: [],
        estimate_sent: [],
        follow_up: [],
        scheduled: [],
        completed: [
          {
            id: 'job-1',
            customer_id: 'customer-1',
            customer_name: 'Alice',
            title: 'Paint house',
            description: 'Exterior repaint',
            status: 'completed',
            estimate_date: null,
            scheduled_date: null,
            scheduled_end_date: null,
            completed_at: '2026-04-21T10:00:00.000Z',
          },
        ],
        lost: [],
      },
      filteredCompleted: [
        {
          id: 'job-1',
          customer_id: 'customer-1',
          customer_name: 'Alice',
          title: 'Paint house',
          description: 'Exterior repaint',
          status: 'completed',
          estimate_date: null,
          scheduled_date: null,
          scheduled_end_date: null,
          completed_at: '2026-04-21T10:00:00.000Z',
        },
      ],
      visibleColumns: [
        { key: 'completed', title: 'Completed' },
      ],
      load: vi.fn(),
      runBoardAction: vi.fn(),
      closeStageEmail: vi.fn(),
      handleStageEmailSent: vi.fn(),
      closeCloseout: vi.fn(),
      handleCloseoutSaved: vi.fn(),
    })

    render(<JobsPage />)

    expect(screen.getByText('Jobs')).toBeTruthy()
    expect(screen.getByText('Board updated.')).toBeTruthy()
    expect(screen.getAllByPlaceholderText('Search completed...').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Paint house').length).toBeGreaterThan(0)
  })
})
