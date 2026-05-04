import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobDetailPage from '../page'

const { useJobDetailPageMock } = vi.hoisted(() => ({
  useJobDetailPageMock: vi.fn(),
}))

vi.mock('@/app/crm/jobs/_hooks/useJobDetailPage', () => ({
  useJobDetailPage: () => useJobDetailPageMock(),
}))

vi.mock('@/app/crm/jobs/_components/StageEmailModal', () => ({
  default: () => null,
}))

vi.mock('@/app/crm/jobs/_components/JobCompletionCloseoutModal', () => ({
  default: () => null,
}))

vi.mock('@/app/crm/jobs/[id]/_components/JobDetailHeader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('@/app/crm/jobs/[id]/_components/JobDetailsPanel', () => ({
  default: () => <div>Job details panel</div>,
}))

vi.mock('@/app/crm/jobs/[id]/_components/JobTimeline', () => ({
  default: () => <div>Job timeline</div>,
}))

function acceptedQuote(overrides: Record<string, unknown> = {}) {
  return {
    estimate_id: 'estimate-1',
    accepted_public_version_id: 'public-version-1',
    public_version_number: 1,
    public_token: 'token-1',
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_by_legal_name: 'Jordan Customer',
    signature_type: 'typed',
    user_agent: 'Mozilla/5.0',
    ip: '127.0.0.1',
    version_name: 'Interior repaint',
    estimate_snapshot_id: 'snapshot-1',
    estimated_labor_hours: 32,
    estimated_paint_gallons: 7,
    estimated_supplies_cost: 180,
    estimated_other_cost: 45,
    final_total: 4250,
    ...overrides,
  }
}

function createController(jobOverrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    router: { back: vi.fn(), push: vi.fn() },
    resource: {
      loading: false,
      error: null,
      refresh: vi.fn(),
    },
    job: {
      id: 'job-1',
      title: 'Completed repaint',
      status: 'completed',
      linked_estimate_id: 'estimate-1',
      accepted_quote: acceptedQuote(),
      ...jobOverrides,
    },
    notice: null,
    deleting: false,
    emailStage: null,
    closeoutOpen: false,
    timelineOpen: true,
    setTimelineOpen: vi.fn(),
    estimateFile: null,
    estimateFileError: null,
    paintLogs: [],
    photosFolderUrl: null,
    photosLoading: false,
    copy: vi.fn(),
    patchJob: vi.fn(),
    deleteJob: vi.fn(),
    openStageEmail: vi.fn(),
    openCloseout: vi.fn(),
    closeStageEmail: vi.fn(),
    closeCloseout: vi.fn(),
    handleStageEmailSent: vi.fn(),
    handleCloseoutSaved: vi.fn(),
    handleStatusChange: vi.fn(),
    markCompletedAndPrompt: vi.fn(),
    runWorkflowAction: vi.fn(),
    formatDate: (value: string | null | undefined) => value ?? '-',
    formatRange: () => '-',
    formatStatus: (value: string | null | undefined) => value ?? '-',
  }
}

describe('JobDetail workflow actuals and review actions', () => {
  beforeEach(() => {
    useJobDetailPageMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('links completed jobs with an accepted quote snapshot to job actuals and keeps review gated until actuals are submitted', () => {
    useJobDetailPageMock.mockReturnValue(createController())

    render(<JobDetailPage />)

    expect(screen.getByRole('link', { name: 'Job actuals' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1/actuals'
    )
    expect(screen.getByRole('button', { name: 'Estimate review' })).toBeDisabled()
    expect(screen.getByText('Submit job actuals before estimate review.')).toBeTruthy()
  })

  it('links estimate review after job actuals are submitted', () => {
    useJobDetailPageMock.mockReturnValue(
      createController({
        job_actuals_status: 'submitted',
      })
    )

    render(<JobDetailPage />)

    expect(screen.getByRole('link', { name: 'Job actuals' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1/actuals'
    )
    expect(screen.getByRole('link', { name: 'Estimate review' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1/review'
    )
  })

  it('messages missing accepted snapshots instead of linking to actuals or review', () => {
    useJobDetailPageMock.mockReturnValue(
      createController({
        accepted_quote: acceptedQuote({ estimate_snapshot_id: null }),
      })
    )

    render(<JobDetailPage />)

    expect(screen.getByRole('button', { name: 'Job actuals' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Estimate review' })).toBeDisabled()
    expect(
      screen.getByText('Accepted quote is missing an estimate snapshot for actuals.')
    ).toBeTruthy()
    expect(
      screen.getByText('Accepted quote is missing an estimate snapshot for review.')
    ).toBeTruthy()
  })

  it('messages jobs with no accepted quote instead of linking to actuals or review', () => {
    useJobDetailPageMock.mockReturnValue(
      createController({
        linked_estimate_id: null,
        accepted_quote: null,
      })
    )

    render(<JobDetailPage />)

    expect(screen.getByRole('button', { name: 'Job actuals' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Estimate review' })).toBeDisabled()
    expect(screen.getByText('Accept a quote before entering job actuals.')).toBeTruthy()
    expect(screen.getByText('Accept a quote before reviewing the estimate.')).toBeTruthy()
  })

  it('keeps existing completed job workflow actions wired through the action rail', async () => {
    const user = userEvent.setup()
    const controller = createController({ job_actuals_status: 'submitted' })
    useJobDetailPageMock.mockReturnValue(controller)

    render(<JobDetailPage />)

    await user.click(screen.getByRole('button', { name: 'Open closeout' }))

    expect(controller.runWorkflowAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'open_closeout' })
    )
  })
})
