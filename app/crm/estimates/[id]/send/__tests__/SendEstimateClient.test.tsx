import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SendEstimateClient from '../sendEstimateClient'

const workflowState = vi.hoisted(() => ({
  buildCustomerSendComposerDraft: vi.fn(),
  useCustomerSendWorkflow: vi.fn(),
}))

vi.mock('../../estimateRouteFamily', () => ({
  resolveEstimateRouteFamily: () => ({
    summaryHref: (id: string) => `/crm/estimates/${id}`,
  }),
}))

vi.mock('../_shared/customerSendWorkflow', async () => {
  return {
    asText: (value: unknown) => (value == null ? '' : String(value).trim()),
    buildCustomerSendComposerDraft: workflowState.buildCustomerSendComposerDraft,
    buildCustomerSendComposerPreview: vi.fn(),
    isPositiveInteger: (value: string) => /^[1-9]\d*$/.test(String(value).trim()),
    isValidRecipientList: () => true,
    resolveCustomerSendTemplatePresets: (settings: { template_presets?: unknown[] } | null | undefined) =>
      settings?.template_presets ?? [],
    useCustomerSendWorkflow: workflowState.useCustomerSendWorkflow,
  }
})

vi.mock('@/lib/customer-estimates/view', () => ({
  CustomerEstimateDocumentView: () => <div>Preview</div>,
}))

describe('SendEstimateClient', () => {
  afterEach(() => {
    cleanup()
    workflowState.buildCustomerSendComposerDraft.mockReset()
    workflowState.useCustomerSendWorkflow.mockReset()
  })

  it('shows curated retry copy alongside return to internal review for initial load failures', () => {
    const reload = vi.fn(async () => true)
    workflowState.buildCustomerSendComposerDraft.mockReturnValue({
      to_email: '',
      cc_email: '',
      bcc_email: '',
      template_key: 'friendly',
      subject: '',
      body: '',
      title: '',
      quote_validity_days: '90',
      scope_text_edits: {
        walls: '',
        ceilings: '',
        trim: '',
        doors: '',
        drywall: '',
        cabinets: '',
        other: '',
      },
    })
    workflowState.useCustomerSendWorkflow.mockReturnValue({
      loading: false,
      busy: false,
      message: null,
      setMessage: vi.fn(),
      error: 'Unable to load quote send page',
      setError: vi.fn(),
      data: null,
      publicUrl: null,
      form: null,
      setForm: vi.fn(),
      reload,
      persistDraft: vi.fn(),
      submit: vi.fn(),
      labels: {
        document: 'Quote',
        documentLower: 'quote',
        shell: 'Customer Quote',
        action: 'Send Quote',
      },
      liveDocument: null,
      readiness: null,
      hasSendBlockers: false,
      currentTemplate: {
        key: 'friendly',
        label: 'Friendly',
        subject: 'Hi',
        body: 'Body',
      },
      hasLiveLink: false,
      version: { status: 'draft' },
    })

    render(<SendEstimateClient estimateId="estimate-1" />)

    expect(
      screen.getByText("We couldn't load this send page. Try again or return to internal review.")
    ).toBeInTheDocument()
    expect(screen.queryByText('Unable to load quote send page')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to internal review' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows shared readiness blockers and warnings and disables live send only', () => {
    workflowState.buildCustomerSendComposerDraft.mockReturnValue({
      to_email: 'customer@example.com',
      cc_email: '',
      bcc_email: 'owner@example.com',
      template_key: 'friendly',
      subject: 'Hi',
      body: 'Body',
      title: 'Kitchen Quote',
      quote_validity_days: '90',
      scope_text_edits: {
        walls: '',
        ceilings: '',
        trim: '',
        doors: '',
        drywall: '',
        cabinets: '',
        other: '',
      },
    })
    workflowState.useCustomerSendWorkflow.mockReturnValue({
      loading: false,
      busy: false,
      message: null,
      setMessage: vi.fn(),
      error: null,
      setError: vi.fn(),
      data: {
        settings: {
          updated_at: '2026-05-01T15:30:00.000Z',
          template_presets: [{ key: 'friendly', label: 'Friendly', subject: 'Hi', body: 'Body' }],
        },
        draft: {},
        estimate: {
          updated_at: '2026-05-01T15:30:00.000Z',
        },
        version: {
          updated_at: '2026-05-01T15:30:00.000Z',
        },
        document: {
          customer: { name: 'Taylor' },
          meta: { title: 'Kitchen Quote' },
        },
      },
      publicUrl: null,
      form: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: 'owner@example.com',
        template_key: 'friendly',
        subject: 'Hi',
        body: 'Body',
        title: 'Kitchen Quote',
        quote_validity_days: '90',
        scope_text_edits: {
          walls: '',
          ceilings: '',
          trim: '',
          doors: '',
          drywall: '',
          cabinets: '',
          other: '',
        },
      },
      setForm: vi.fn(),
      reload: vi.fn(),
      persistDraft: vi.fn(),
      submit: vi.fn(),
      labels: {
        document: 'Quote',
        documentLower: 'quote',
        shell: 'Customer Quote',
        action: 'Send Quote',
      },
      liveDocument: {
        customer: { name: 'Taylor' },
        meta: { title: 'Kitchen Quote' },
      },
      readiness: {
        blockers: [
          { code: 'document_company_placeholders', message: 'Company name is missing.' },
          { code: 'document_total_non_positive', message: 'Quote total is $0.' },
        ],
        warnings: [
          {
            code: 'document_payment_placeholders',
            message: 'Payment terms still contain placeholder copy.',
          },
        ],
        readyToSend: false,
      },
      hasSendBlockers: true,
      hasUnsavedChanges: false,
      isSavingDraft: false,
      currentTemplate: {
        key: 'friendly',
        label: 'Friendly',
        subject: 'Hi',
        body: 'Body',
      },
      hasLiveLink: false,
      version: {
        status: 'draft',
      },
    })

    render(<SendEstimateClient estimateId="estimate-1" />)

    expect(screen.getByText('Server-Saved Preview')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This preview and total reflect the last saved quote data from the server. Unsaved editor changes are not included.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Last saved server update:/)).toBeInTheDocument()
    expect(screen.getByText('Before Sending')).toBeInTheDocument()
    expect(screen.getByText('Blockers')).toBeInTheDocument()
    expect(screen.getByText('Warnings')).toBeInTheDocument()
    expect(screen.getByText('Company name is missing.')).toBeInTheDocument()
    expect(screen.getByText('Quote total is $0.')).toBeInTheDocument()
    expect(
      screen.getByText('Payment terms still contain placeholder copy.')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Resolve blockers before sending' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send Test' })).toBeEnabled()
  })

  it('surfaces stale preview state when local edits are not yet persisted', () => {
    workflowState.buildCustomerSendComposerDraft.mockReturnValue({
      to_email: 'customer@example.com',
      cc_email: '',
      bcc_email: 'owner@example.com',
      template_key: 'friendly',
      subject: 'Hi',
      body: 'Body',
      title: 'Kitchen Quote',
      quote_validity_days: '90',
      scope_text_edits: {
        walls: '',
        ceilings: '',
        trim: '',
        doors: '',
        drywall: '',
        cabinets: '',
        other: '',
      },
    })
    workflowState.useCustomerSendWorkflow.mockReturnValue({
      loading: false,
      busy: false,
      message: null,
      setMessage: vi.fn(),
      error: null,
      setError: vi.fn(),
      data: {
        settings: {
          updated_at: '2026-05-01T15:30:00.000Z',
          template_presets: [{ key: 'friendly', label: 'Friendly', subject: 'Hi', body: 'Body' }],
        },
        draft: {},
        estimate: {
          updated_at: '2026-05-01T15:30:00.000Z',
        },
        version: {
          updated_at: '2026-05-01T15:30:00.000Z',
        },
        document: {
          customer: { name: 'Taylor' },
          meta: { title: 'Kitchen Quote' },
        },
      },
      publicUrl: null,
      form: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: 'owner@example.com',
        template_key: 'friendly',
        subject: 'Hi',
        body: 'Body',
        title: 'Locally Edited Quote',
        quote_validity_days: '90',
        scope_text_edits: {
          walls: '',
          ceilings: '',
          trim: '',
          doors: '',
          drywall: '',
          cabinets: '',
          other: '',
        },
      },
      setForm: vi.fn(),
      reload: vi.fn(),
      persistDraft: vi.fn(),
      submit: vi.fn(),
      labels: {
        document: 'Quote',
        documentLower: 'quote',
        shell: 'Customer Quote',
        action: 'Send Quote',
      },
      liveDocument: {
        customer: { name: 'Taylor' },
        meta: { title: 'Kitchen Quote' },
      },
      readiness: { blockers: [], warnings: [], readyToSend: true },
      hasSendBlockers: false,
      hasUnsavedChanges: true,
      isSavingDraft: false,
      currentTemplate: {
        key: 'friendly',
        label: 'Friendly',
        subject: 'Hi',
        body: 'Body',
      },
      hasLiveLink: false,
      version: {
        status: 'draft',
      },
    })

    render(<SendEstimateClient estimateId="estimate-1" />)

    expect(
      screen.getByText('You have unsaved edits. Save Draft to refresh the server quote preview and blocker state.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Save draft to refresh preview before sending' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled()
  })

  it('uses the shared confirmation dialog before replacing edited subject and message copy', async () => {
    const setForm = vi.fn()
    workflowState.buildCustomerSendComposerDraft.mockReturnValue({
      to_email: 'customer@example.com',
      cc_email: '',
      bcc_email: '',
      template_key: 'friendly',
      subject: 'Hi',
      body: 'Body',
      title: 'Kitchen Quote',
      quote_validity_days: '90',
      scope_text_edits: {
        walls: '',
        ceilings: '',
        trim: '',
        doors: '',
        drywall: '',
        cabinets: '',
        other: '',
      },
    })
    workflowState.useCustomerSendWorkflow.mockReturnValue({
      loading: false,
      busy: false,
      message: null,
      setMessage: vi.fn(),
      error: null,
      setError: vi.fn(),
      data: {
        settings: {
          updated_at: '2026-05-01T15:30:00.000Z',
          template_presets: [
            { key: 'friendly', label: 'Friendly', subject: 'Hi', body: 'Body' },
            { key: 'formal', label: 'Formal', subject: 'Formal hello', body: 'Formal body' },
          ],
        },
        draft: {},
        estimate: { updated_at: '2026-05-01T15:30:00.000Z' },
        version: { updated_at: '2026-05-01T15:30:00.000Z' },
        document: {
          customer: { name: 'Taylor' },
          meta: { title: 'Kitchen Quote' },
        },
      },
      publicUrl: null,
      form: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: '',
        template_key: 'friendly',
        subject: 'Custom subject',
        body: 'Custom body',
        title: 'Kitchen Quote',
        quote_validity_days: '90',
        scope_text_edits: {
          walls: '',
          ceilings: '',
          trim: '',
          doors: '',
          drywall: '',
          cabinets: '',
          other: '',
        },
      },
      setForm,
      reload: vi.fn(),
      persistDraft: vi.fn(),
      submit: vi.fn(),
      labels: {
        document: 'Quote',
        documentLower: 'quote',
        shell: 'Customer Quote',
        action: 'Send Quote',
      },
      liveDocument: {
        customer: { name: 'Taylor' },
        meta: { title: 'Kitchen Quote' },
      },
      readiness: { blockers: [], warnings: [], readyToSend: true },
      hasSendBlockers: false,
      hasUnsavedChanges: true,
      isSavingDraft: false,
      currentTemplate: {
        key: 'friendly',
        label: 'Friendly',
        subject: 'Hi',
        body: 'Body',
      },
      hasLiveLink: false,
      version: { status: 'draft' },
    })

    render(<SendEstimateClient estimateId="estimate-1" />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'formal' } })

    expect(screen.getByRole('dialog', { name: 'Replace your message edits?' })).toBeInTheDocument()
    expect(setForm).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Replace your message edits?' })).not.toBeInTheDocument()
    expect(setForm).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'formal' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Replace current subject and message with selected template' })
    )

    await waitFor(() => expect(setForm).toHaveBeenCalledTimes(1))
  })

  it('uses the shared confirmation dialog before reloading and allows cancel', async () => {
    const reload = vi.fn(async () => undefined)
    const setMessage = vi.fn()
    workflowState.buildCustomerSendComposerDraft.mockReturnValue({
      to_email: 'customer@example.com',
      cc_email: '',
      bcc_email: '',
      template_key: 'friendly',
      subject: 'Hi',
      body: 'Body',
      title: 'Kitchen Quote',
      quote_validity_days: '90',
      scope_text_edits: {
        walls: '',
        ceilings: '',
        trim: '',
        doors: '',
        drywall: '',
        cabinets: '',
        other: '',
      },
    })
    workflowState.useCustomerSendWorkflow.mockReturnValue({
      loading: false,
      busy: false,
      message: null,
      setMessage,
      error: null,
      setError: vi.fn(),
      data: {
        settings: {
          updated_at: '2026-05-01T15:30:00.000Z',
          template_presets: [{ key: 'friendly', label: 'Friendly', subject: 'Hi', body: 'Body' }],
        },
        draft: {},
        estimate: { updated_at: '2026-05-01T15:30:00.000Z' },
        version: { updated_at: '2026-05-01T15:30:00.000Z' },
        document: {
          customer: { name: 'Taylor' },
          meta: { title: 'Kitchen Quote' },
        },
      },
      publicUrl: null,
      form: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: '',
        template_key: 'friendly',
        subject: 'Changed subject',
        body: 'Changed body',
        title: 'Kitchen Quote',
        quote_validity_days: '90',
        scope_text_edits: {
          walls: '',
          ceilings: '',
          trim: '',
          doors: '',
          drywall: '',
          cabinets: '',
          other: '',
        },
      },
      setForm: vi.fn(),
      reload,
      persistDraft: vi.fn(),
      submit: vi.fn(),
      labels: {
        document: 'Quote',
        documentLower: 'quote',
        shell: 'Customer Quote',
        action: 'Send Quote',
      },
      liveDocument: {
        customer: { name: 'Taylor' },
        meta: { title: 'Kitchen Quote' },
      },
      readiness: { blockers: [], warnings: [], readyToSend: true },
      hasSendBlockers: false,
      hasUnsavedChanges: true,
      isSavingDraft: false,
      currentTemplate: {
        key: 'friendly',
        label: 'Friendly',
        subject: 'Hi',
        body: 'Body',
      },
      hasLiveLink: false,
      version: { status: 'draft' },
    })

    render(<SendEstimateClient estimateId="estimate-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Reload Latest' }))

    expect(screen.getByRole('dialog', { name: 'Reload latest quote?' })).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Reload latest quote?' })).not.toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Reload Latest' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Reload latest quote data and discard unsaved changes' })
    )

    await waitFor(() => expect(reload).toHaveBeenCalledWith({ hard: true }))
    expect(setMessage).toHaveBeenCalledWith('Reloaded latest quote data.')
  })

  it('renders curated link-live delivery failure copy and keeps copy/resend actions available', async () => {
    const setMessage = vi.fn()
    const submit = vi.fn()
    const clipboardWriteText = vi.fn(async () => undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteText,
      },
    })

    workflowState.buildCustomerSendComposerDraft.mockReturnValue({
      to_email: 'customer@example.com',
      cc_email: '',
      bcc_email: 'owner@example.com',
      template_key: 'friendly',
      subject: 'Hi',
      body: 'Body',
      title: 'Kitchen Quote',
      quote_validity_days: '90',
      scope_text_edits: {
        walls: '',
        ceilings: '',
        trim: '',
        doors: '',
        drywall: '',
        cabinets: '',
        other: '',
      },
    })
    workflowState.useCustomerSendWorkflow.mockReturnValue({
      loading: false,
      busy: false,
      message: 'Customer link is ready. Copy the link or try sending the email again.',
      setMessage,
      error: 'Email delivery did not complete.',
      setError: vi.fn(),
      data: {
        settings: {
          updated_at: '2026-05-01T15:30:00.000Z',
          template_presets: [{ key: 'friendly', label: 'Friendly', subject: 'Hi', body: 'Body' }],
        },
        draft: {},
        estimate: { updated_at: '2026-05-01T15:30:00.000Z' },
        version: { updated_at: '2026-05-01T15:30:00.000Z' },
        document: {
          customer: { name: 'Taylor' },
          meta: { title: 'Kitchen Quote' },
        },
      },
      publicUrl: 'https://example.test/quote/live-token',
      form: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: 'owner@example.com',
        template_key: 'friendly',
        subject: 'Hi',
        body: 'Body',
        title: 'Kitchen Quote',
        quote_validity_days: '90',
        scope_text_edits: {
          walls: '',
          ceilings: '',
          trim: '',
          doors: '',
          drywall: '',
          cabinets: '',
          other: '',
        },
      },
      setForm: vi.fn(),
      reload: vi.fn(),
      persistDraft: vi.fn(),
      submit,
      labels: {
        document: 'Quote',
        documentLower: 'quote',
        shell: 'Customer Quote',
        action: 'Send Quote',
      },
      liveDocument: {
        customer: { name: 'Taylor' },
        meta: { title: 'Kitchen Quote' },
      },
      readiness: { blockers: [], warnings: [], readyToSend: true },
      hasSendBlockers: false,
      currentTemplate: {
        key: 'friendly',
        label: 'Friendly',
        subject: 'Hi',
        body: 'Body',
      },
      hasLiveLink: true,
      version: { status: 'sent' },
    })

    render(<SendEstimateClient estimateId="estimate-1" />)

    expect(
      screen.getByText('Customer link is ready. Copy the link or try sending the email again.')
    ).toBeInTheDocument()
    expect(screen.getByText('Email delivery did not complete.')).toBeInTheDocument()
    expect(screen.queryByText('Gmail not configured')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send Quote' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }))
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith('https://example.test/quote/live-token')
    })
    expect(setMessage).toHaveBeenCalledWith('Customer link copied.')

    fireEvent.click(screen.getByRole('button', { name: 'Send Quote' }))
    expect(submit).toHaveBeenCalledWith('send')
  })
})
