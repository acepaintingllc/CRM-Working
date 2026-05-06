import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import JobCompletionCloseoutModal from '../JobCompletionCloseoutModal'
import StageEmailModal from '../StageEmailModal'

const { mockUseCloseoutForm, mockUseEmailComposer } = vi.hoisted(() => ({
  mockUseCloseoutForm: vi.fn(),
  mockUseEmailComposer: vi.fn(),
}))

vi.mock('@/app/crm/jobs/_components/hooks/useEmailComposer', () => ({
  useEmailComposer: mockUseEmailComposer,
}))

vi.mock('@/app/crm/jobs/_components/hooks/useCloseoutForm', () => ({
  useCloseoutForm: mockUseCloseoutForm,
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteCatalogs: vi.fn(),
}))

describe('Job Center email composer textareas', () => {
  afterEach(() => {
    cleanup()
    mockUseCloseoutForm.mockReset()
    mockUseEmailComposer.mockReset()
  })

  it('gives the stage email body editor enough room to read the message', () => {
    mockUseEmailComposer.mockReturnValue({
      job: { customer_email: 'customer@example.com' },
      subject: 'Quote scheduled',
      setSubject: vi.fn(),
      body: 'Long stage email body',
      setBody: vi.fn(),
      loading: false,
      sending: false,
      error: null,
      blockingIssues: [],
      estimateFiles: [],
      selectedEstimateFiles: [],
      selectedEstimateFileIds: [],
      setSelectedEstimateFileIds: vi.fn(),
      showEstimatePicker: false,
      setShowEstimatePicker: vi.fn(),
      needsEstimateAttachment: false,
      missingEstimateSelection: false,
      canSend: true,
      closeLabel: 'Cancel',
      actionLabel: 'Send email',
      alreadySent: false,
      send: vi.fn(),
    })

    render(
      <StageEmailModal
        jobId="job-1"
        stage="estimate_scheduled"
        open
        onClose={vi.fn()}
      />
    )

    const bodyField = screen.getByDisplayValue('Long stage email body')
    expect(bodyField.className).toContain('min-h-[420px]')
    expect(bodyField).toHaveStyle({ minHeight: '420px' })
  })

  it('renders quote-facing attachment copy in the stage email modal', () => {
    mockUseEmailComposer.mockReturnValue({
      job: { customer_email: 'customer@example.com' },
      subject: 'Quote sent',
      setSubject: vi.fn(),
      body: 'Quote attachment email body',
      setBody: vi.fn(),
      loading: false,
      sending: false,
      error: null,
      blockingIssues: [],
      estimateFiles: [
        { id: 'file-1', name: 'Quote-v2.pdf' },
        { id: 'file-2', name: 'Quote-v1.pdf' },
      ],
      selectedEstimateFiles: [{ id: 'file-1', name: 'Quote-v2.pdf' }],
      selectedEstimateFileIds: ['file-1'],
      setSelectedEstimateFileIds: vi.fn(),
      showEstimatePicker: false,
      setShowEstimatePicker: vi.fn(),
      needsEstimateAttachment: true,
      missingEstimateSelection: false,
      canSend: true,
      closeLabel: 'Cancel',
      actionLabel: 'Send quote email',
      alreadySent: false,
      send: vi.fn(),
    })

    render(
      <StageEmailModal
        jobId="job-1"
        stage="estimate_sent"
        open
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Quote attachments ready: 1 selected')).toBeTruthy()
    expect(screen.getByText('Quote attachments')).toBeTruthy()
    expect(screen.getByText('Select which quote PDFs go out with this stage email.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose quote PDFs' })).toBeTruthy()
  })

  it('gives the completion review email body editor enough room to read the message', () => {
    mockUseCloseoutForm.mockReturnValue({
      job: { title: 'Kitchen repaint', customer_email: 'customer@example.com' },
      loading: false,
      saving: false,
      sendingEmail: false,
      subject: 'Review request',
      setSubject: vi.fn(),
      body: 'Long completion review body',
      setBody: vi.fn(),
      closeoutNotes: '',
      setCloseoutNotes: vi.fn(),
      paintRows: [],
      updateRow: vi.fn(),
      removeRow: vi.fn(),
      addRow: vi.fn(),
      paintOptions: [],
      colorOptions: [],
      error: null,
      emailNotice: null,
      templateMissing: false,
      emailSkipped: false,
      canSendEmail: true,
      sendReviewEmail: vi.fn(),
      skipEmail: vi.fn(),
      saveAndClose: vi.fn(),
      defaultWhereUsedOptions: [],
      defaultSheenOptions: [],
    })

    render(<JobCompletionCloseoutModal jobId="job-1" open onClose={vi.fn()} />)

    const bodyField = screen.getByDisplayValue('Long completion review body')
    expect(bodyField.className).toContain('min-h-[420px]')
    expect(bodyField).toHaveStyle({ minHeight: '420px' })
  })
})
