import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobDetailPage from '../page'
import { getJobWorkflowActions } from '@/lib/jobs/types'

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

function acceptedEstimate(overrides: Record<string, unknown> = {}) {
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
  const job = {
    id: 'job-1',
    title: 'Completed repaint',
    status: 'completed',
    linked_estimate_id: 'estimate-1',
    accepted_estimate: acceptedEstimate(),
    ...jobOverrides,
  } as Parameters<typeof getJobWorkflowActions>[1]

  return {
    id: 'job-1',
    router: { back: vi.fn(), push: vi.fn() },
    resource: {
      loading: false,
      error: null,
      refresh: vi.fn(),
    },
    job,
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
    workflowActions: getJobWorkflowActions('detail', job),
    copy: vi.fn(),
    patchJob: vi.fn(),
    updateEstimateDate: vi.fn(),
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
    expect(screen.getByRole('button', { name: 'Quote review' })).toBeDisabled()
    expect(screen.getByText('Submit job actuals before quote review.')).toBeTruthy()
  })

  it('links quote review after job actuals are submitted', () => {
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
    expect(screen.getByRole('link', { name: 'Quote review' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1/review'
    )
  })

  it('links job actuals for legacy accepted jobs even when linked_estimate_id is null and the snapshot is missing', () => {
    useJobDetailPageMock.mockReturnValue(
      createController({
        linked_estimate_id: null,
        accepted_estimate: acceptedEstimate({ estimate_snapshot_id: null }),
      })
    )

    render(<JobDetailPage />)

    expect(screen.getByRole('link', { name: 'Job actuals' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1/actuals'
    )
    expect(screen.getByRole('button', { name: 'Quote review' })).toBeDisabled()
    expect(screen.getByText('Submit job actuals before quote review.')).toBeTruthy()
  })

  it('links quote review when an accepted quote is missing its snapshot and actuals are submitted', () => {
    useJobDetailPageMock.mockReturnValue(
      createController({
        accepted_estimate: acceptedEstimate({ estimate_snapshot_id: null }),
        job_actuals_status: 'submitted',
      })
    )

    render(<JobDetailPage />)

    expect(screen.getByRole('link', { name: 'Job actuals' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1/actuals'
    )
    expect(screen.getByRole('link', { name: 'Quote review' })).toHaveAttribute(
      'href',
      '/crm/jobs/job-1/review'
    )
  })

  it('messages jobs with no accepted estimate instead of linking to actuals or review', () => {
    useJobDetailPageMock.mockReturnValue(
      createController({
        linked_estimate_id: null,
        accepted_estimate: null,
      })
    )

    render(<JobDetailPage />)

    expect(screen.getByRole('button', { name: 'Job actuals' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Quote review' })).toBeDisabled()
    expect(screen.getByText('Accept a quote before entering job actuals.')).toBeTruthy()
    expect(screen.getByText('Accept a quote before reviewing the quote.')).toBeTruthy()
  })

  it('keeps quote navigation fallback separate from accepted estimate workflow gates', () => {
    useJobDetailPageMock.mockReturnValue(
      createController({
        status: 'completed',
        linked_estimate_id: null,
        estimate_navigation_id: 'draft-estimate',
        accepted_estimate: null,
        job_actuals_status: 'submitted',
      })
    )

    render(<JobDetailPage />)

    expect(screen.getByRole('link', { name: 'Open quote' })).toHaveAttribute(
      'href',
      '/crm/quotes/draft-estimate'
    )
    expect(screen.getByRole('button', { name: 'Job actuals' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Quote review' })).toBeDisabled()
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
