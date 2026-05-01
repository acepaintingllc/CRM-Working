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
