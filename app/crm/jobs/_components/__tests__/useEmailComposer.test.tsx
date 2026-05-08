import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchStageEmailComposerData, mockSendStageEmail } = vi.hoisted(() => ({
  mockFetchStageEmailComposerData: vi.fn(),
  mockSendStageEmail: vi.fn(),
}))

vi.mock('@/lib/jobs/actions', () => ({
  fetchStageEmailComposerData: mockFetchStageEmailComposerData,
  sendStageEmail: mockSendStageEmail,
}))

import { useEmailComposer } from '@/app/crm/jobs/_components/hooks/useEmailComposer'
import type { StageEmailComposerData } from '@/lib/jobs/actions'
import type { StageEmailStage } from '@/lib/jobs/types'

function buildComposerData(
  overrides: Partial<StageEmailComposerData> = {}
): StageEmailComposerData {
  return {
    job: {
      id: 'job-1',
      title: 'Kitchen repaint',
      customer_email: 'customer@example.com',
      customer_name: 'Jordan Customer',
      customer_phone: '812-555-0100',
      customer_address: '123 Main St',
      status: 'estimate_sent',
      scheduled_date: '2026-05-01T14:00:00.000Z',
      scheduled_end_date: '2026-05-01T18:00:00.000Z',
      scheduled_email_sent_at: null,
      completed_email_sent_at: null,
    },
    template: {
      stage: 'estimate_sent',
      subject: 'Quote {{estimateFileName}}',
      body: 'Files: {{estimateFileNames}}\nBlocks: {{scheduledBlocks}}',
    },
    scheduledBlocks: 'Block A',
    estimateFiles: [
      { id: 'file-1', name: 'Quote-v1.pdf', webViewLink: 'https://drive/file-1' },
      { id: 'file-2', name: 'Quote-v2.pdf', webViewLink: 'https://drive/file-2' },
    ],
    selectedEstimateFileIds: ['file-1'],
    blockingIssues: [],
    ...overrides,
  } as StageEmailComposerData
}

function renderEmailComposer(stage: StageEmailStage = 'estimate_sent') {
  return renderHook(() =>
    useEmailComposer({
      jobId: 'job-1',
      stage,
      open: true,
    })
  )
}

describe('useEmailComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchStageEmailComposerData.mockResolvedValue(buildComposerData())
    mockSendStageEmail.mockResolvedValue({
      stage: 'estimate_sent',
      status: 'sent',
      replayed: false,
      job: null,
      notice: 'Email sent.',
      warning: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('initial load populates subject, body, and blocking issues from fetchStageEmailComposerData', async () => {
    mockFetchStageEmailComposerData.mockResolvedValueOnce(
      buildComposerData({
        blockingIssues: ['Customer email is missing for this job.'],
      })
    )

    const { result } = renderEmailComposer()

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchStageEmailComposerData).toHaveBeenCalledWith('job-1', 'estimate_sent')
    expect(result.current.subject).toBe('Quote Quote-v1.pdf')
    expect(result.current.body).toContain('Files: Quote-v1.pdf')
    expect(result.current.body).toContain('Blocks: Block A')
    expect(result.current.blockingIssues).toEqual(['Customer email is missing for this job.'])
  })

  it('changing selected estimate file ids refreshes attachment-derived template values before manual edits', async () => {
    const { result } = renderEmailComposer()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.subject).toBe('Quote Quote-v1.pdf')

    act(() => {
      result.current.setSelectedEstimateFileIds(['file-2'])
    })

    await waitFor(() => expect(result.current.subject).toBe('Quote Quote-v2.pdf'))
    expect(result.current.body).toContain('Files: Quote-v2.pdf')
    expect(result.current.selectedEstimateFiles.map((file) => file.id)).toEqual(['file-2'])
  })

  it('preserves manual subject and body edits when attachment selection changes afterward', async () => {
    const { result } = renderEmailComposer()

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSubject('Custom subject')
      result.current.setBody('Custom body')
      result.current.setSelectedEstimateFileIds(['file-2'])
    })

    await waitFor(() => expect(result.current.selectedEstimateFiles.map((file) => file.id)).toEqual(['file-2']))
    expect(result.current.subject).toBe('Custom subject')
    expect(result.current.body).toBe('Custom body')
  })

  it.each([
    ['estimate_sent', ['file-1'], true],
    ['follow_up', ['file-1'], true],
    ['completed', undefined, false],
  ] as const)(
    'send passes selected estimate file ids only for quote/follow-up stages: %s',
    async (stage, expectedIds, needsEstimateAttachment) => {
      mockFetchStageEmailComposerData.mockResolvedValueOnce(
        buildComposerData({
          template: {
            stage,
            subject: 'Subject',
            body: 'Body',
          },
        })
      )
      mockSendStageEmail.mockResolvedValueOnce({
        stage,
        status: 'sent',
        replayed: false,
        job: null,
        notice: 'Email sent.',
        warning: null,
      })

      const { result } = renderEmailComposer(stage)

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.needsEstimateAttachment).toBe(needsEstimateAttachment)

      await act(async () => {
        await result.current.send()
      })

      expect(mockSendStageEmail).toHaveBeenLastCalledWith('job-1', {
        stage,
        subject: 'Subject',
        body: 'Body',
        estimateFileIds: expectedIds,
      })
    }
  )

  it('successful send merges returned partial job fields into local hook state', async () => {
    mockFetchStageEmailComposerData.mockResolvedValueOnce(
      buildComposerData({
        template: {
          stage: 'scheduled',
          subject: 'Scheduled',
          body: 'Body',
        },
        estimateFiles: [],
        selectedEstimateFileIds: [],
      })
    )
    mockSendStageEmail.mockResolvedValueOnce({
      stage: 'scheduled',
      status: 'sent',
      replayed: false,
      notice: 'Scheduled email sent.',
      warning: null,
      job: {
        status: 'scheduled',
        scheduled_email_sent_at: '2026-05-03T12:00:00.000Z',
      },
    })

    const { result } = renderEmailComposer('scheduled')

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.alreadySent).toBe(false)

    await act(async () => {
      await result.current.send()
    })

    await waitFor(() => expect(result.current.job?.scheduled_email_sent_at).toBe('2026-05-03T12:00:00.000Z'))
    expect(result.current.job).toMatchObject({
      id: 'job-1',
      title: 'Kitchen repaint',
      status: 'scheduled',
      scheduled_email_sent_at: '2026-05-03T12:00:00.000Z',
    })
    expect(result.current.alreadySent).toBe(true)
  })

  it('surfaces load failures as hook errors', async () => {
    mockFetchStageEmailComposerData.mockRejectedValueOnce(new Error('Composer load failed'))

    const { result } = renderEmailComposer()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Composer load failed')
    expect(result.current.subject).toBe('')
    expect(result.current.body).toBe('')
  })

  it('surfaces send failures as hook errors', async () => {
    mockSendStageEmail.mockRejectedValueOnce(new Error('Send failed'))

    const { result } = renderEmailComposer()

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      const sendResult = await result.current.send()
      expect(sendResult).toBeNull()
    })

    expect(result.current.error).toBe('Send failed')
    expect(result.current.sending).toBe(false)
  })
})
