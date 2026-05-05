import { cleanup, render, screen } from '@testing-library/react'
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

vi.mock('@/app/crm/jobs/[id]/_components/JobActionRail', () => ({
  default: () => <div aria-label="workflow actions" />,
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

function createController(photosFolderUrl: string | null) {
  return {
    id: 'job-1',
    router: { back: vi.fn() },
    resource: {
      loading: false,
      error: null,
      refresh: vi.fn(),
    },
    job: {
      id: 'job-1',
      title: 'Exterior repaint',
      status: 'estimate_scheduled',
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
    photosFolderUrl,
    photosLoading: false,
    workflowActions: [],
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

describe('JobDetailPhotosLink', () => {
  beforeEach(() => {
    useJobDetailPageMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows Open Photos when a photos folder URL exists', () => {
    useJobDetailPageMock.mockReturnValue(createController('https://drive.google.com/folders/job-1'))

    render(<JobDetailPage />)

    const link = screen.getByRole('link', { name: 'Open Photos' })
    expect(link).toHaveAttribute('href', 'https://drive.google.com/folders/job-1')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('does not show Open Photos when no photos folder URL exists', () => {
    useJobDetailPageMock.mockReturnValue(createController(null))

    render(<JobDetailPage />)

    expect(screen.queryByRole('link', { name: 'Open Photos' })).toBeNull()
  })
})
