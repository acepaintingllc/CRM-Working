import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quoteRouteFamily } from '@/app/crm/estimates/[id]/estimateRouteFamily'
import {
  buildCustomerSendComposerDraft,
  buildCustomerSendReviewDraft,
  customerSendUrl,
  deriveCustomerSendLabels,
  isPositiveInteger,
  isValidRecipientList,
  normalizeCustomerSendVersion,
  useCustomerSendWorkflow,
} from '../customerSendWorkflow'

const {
  loadCustomerSendPage,
  saveCustomerSendDraft,
  submitCustomerSend,
} = vi.hoisted(() => ({
  loadCustomerSendPage: vi.fn(),
  saveCustomerSendDraft: vi.fn(),
  submitCustomerSend: vi.fn(),
}))

vi.mock('@/lib/customer-send/client', () => ({
  loadCustomerSendPage,
  saveCustomerSendDraft,
  submitCustomerSend,
}))

const basePayload = {
  job: {
    customer_email: 'customer@example.com',
    estimate_date: '2026-04-22',
  },
  company: {
    business_name: 'ACE Painting',
    business_email: 'owner@example.com',
  },
  settings: {
    default_template_key: 'friendly',
    quote_validity_days: 90,
    terms_text: 'Configured quote terms.',
  },
  draft: {
    template_key: 'default',
    scope_text_edits: {
      walls: 'Custom walls copy',
    },
  },
  version: {
    status: 'draft',
    updated_at: '2026-04-22T12:00:00.000Z',
  },
  public_url: null,
  document: {
    meta: {
      estimate_id: 'estimate-1',
      version_name: 'Kitchen Quote',
      version_state: 'draft',
      title: 'Kitchen Quote',
      flow_version: 'v2',
      quote_date: '2026-04-22',
      sent_at: null,
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      status: 'draft',
      public_token: null,
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '',
      business_email: 'owner@example.com',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    customer: {
      name: 'Taylor',
      email: 'customer@example.com',
      phone: '',
      address: '',
      street: '',
      city: '',
      state: '',
      zip: '',
    },
    intro_paragraph: 'Hello',
    closing_paragraph: 'Thanks',
    quote_validity_days: 90,
    deposit_language: 'Deposit due on scheduling.',
    card_fee_note: 'Card payments include a fee.',
    quote_rows: [
      {
        key: 'walls',
        label: 'Walls',
        description: 'Prep and paint 2 coats on walls in Kitchen.',
        price: 700,
      },
      {
        key: 'ceilings',
        label: 'Ceilings',
        description: 'Prep and paint 2 coats on ceilings in Kitchen.',
        price: 300,
      },
    ],
    scopes: [
      {
        key: 'walls',
        label: 'Walls',
        text: 'Prep and paint 2 coats on walls in Kitchen.',
        total: 700,
      },
      {
        key: 'ceilings',
        label: 'Ceilings',
        text: 'Prep and paint 2 coats on ceilings in Kitchen.',
        total: 300,
      },
    ],
    total: 1200,
    terms: ['Configured quote terms.'],
    source_meta: {
      company: {
        business_name: true,
        main_phone: false,
        business_email: true,
        address: false,
        website: false,
        sender_signature: false,
        logo_url: false,
      },
      settings: {
        quote_validity_days: true,
        terms_text: true,
        terms_sections: false,
      },
      overrides: {
        title: true,
        intro_paragraph: false,
        closing_paragraph: false,
        deposit_language: true,
        card_fee_note: true,
      },
    },
    header: {
      company_name: 'ACE Painting',
      contact_lines: ['owner@example.com'],
      logo_url: '',
      document_label: 'Quote',
      quote_date_label: '2026-04-22',
    },
    customer_block: {
      lines: ['Taylor'],
    },
    pricing_block: {
      rows: [
        {
          key: 'walls',
          label: 'Walls',
          description: 'Prep and paint 2 coats on walls in Kitchen.',
          price: 700,
        },
        {
          key: 'ceilings',
          label: 'Ceilings',
          description: 'Prep and paint 2 coats on ceilings in Kitchen.',
          price: 300,
        },
      ],
      total: 1200,
      footer_note: '',
    },
    terms_page: {
      title: 'QUOTE TERMS',
      sections: [],
    },
    assembly_meta: {
      missing_company_fields: [],
      missing_payment_fields: [],
      missing_legal_fields: [],
      used_placeholder_fallbacks: false,
      used_explicit_terms_text: true,
    },
  },
  readiness: {
    blockers: [],
    warnings: [],
    readyToSend: true,
  },
}

describe('customerSendWorkflow', () => {
  beforeEach(() => {
    loadCustomerSendPage.mockReset()
    saveCustomerSendDraft.mockReset()
    submitCustomerSend.mockReset()
  })

  it('builds draft defaults and derives quote labels from flow metadata', () => {
    const draft = buildCustomerSendComposerDraft(basePayload as never, basePayload.draft, true)

    expect(draft.to_email).toBe('customer@example.com')
    expect(draft.bcc_email).toBe('owner@example.com')
    expect(draft.scope_text_edits.walls).toBe('Custom walls copy')
    expect(draft.scope_text_edits.ceilings).toBe(
      'Prep and paint 2 coats on ceilings in Kitchen.'
    )
    expect(customerSendUrl('estimate-1', 'v2')).toBe('/api/estimates/estimate-1/customer-send?v2=1')
    expect(customerSendUrl('estimate-1', 'v2', quoteRouteFamily)).toBe(
      '/api/quotes/estimate-1/customer-send?v2=1'
    )
    expect(deriveCustomerSendLabels(basePayload as never).document).toBe('Quote')
  })

  it('prefills scope wording edits from document text and preserves saved overrides', () => {
    const noOverrideDraft = buildCustomerSendComposerDraft(
      {
        ...basePayload,
        draft: { scope_text_edits: {} },
      } as never,
      {},
      true
    )
    const overrideDraft = buildCustomerSendReviewDraft(basePayload as never, basePayload.draft)

    expect(noOverrideDraft.scope_text_edits.walls).toBe(
      'Prep and paint 2 coats on walls in Kitchen.'
    )
    expect(noOverrideDraft.scope_text_edits.ceilings).toBe(
      'Prep and paint 2 coats on ceilings in Kitchen.'
    )
    expect(overrideDraft.scope_text_edits.walls).toBe('Custom walls copy')
    expect(overrideDraft.scope_text_edits.ceilings).toBe(
      'Prep and paint 2 coats on ceilings in Kitchen.'
    )
    expect(
      buildCustomerSendComposerDraft(
        basePayload as never,
        { bcc_email: 'bookkeeper@example.com' },
        true
      ).bcc_email
    ).toBe('bookkeeper@example.com')
  })

  it('replaces stale internal To drafts with the customer email', () => {
    const composerDraft = buildCustomerSendComposerDraft(
      basePayload as never,
      { to_email: ' OWNER@example.com ' },
      true
    )
    const reviewDraft = buildCustomerSendReviewDraft(
      basePayload as never,
      { to_email: 'owner@example.com' }
    )

    expect(composerDraft.to_email).toBe('customer@example.com')
    expect(reviewDraft.to_email).toBe('customer@example.com')
  })

  it('preserves a manually entered non-internal To recipient', () => {
    const draft = buildCustomerSendComposerDraft(
      basePayload as never,
      { to_email: 'billing@example.com' },
      true
    )

    expect(draft.to_email).toBe('billing@example.com')
  })

  it('derives estimate labels when the flow is not the quote alias', () => {
    expect(
      deriveCustomerSendLabels({
        ...basePayload,
        document: {
          ...basePayload.document,
          meta: {
            ...basePayload.document.meta,
            flow_version: 'estimate',
          },
        },
      } as never).document
    ).toBe('Estimate')
  })

  it('uses the latest persisted server document for preview state', async () => {
    loadCustomerSendPage.mockResolvedValue({
      ...basePayload,
      document: {
        ...basePayload.document,
        total: 999,
        pricing_block: {
          ...basePayload.document.pricing_block,
          total: 999,
        },
      },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.liveDocument?.total).toBe(999)
    })

    expect(result.current.liveDocument?.pricing_block.total).toBe(999)
  })

  it('loads, saves, and submits through the shared workflow hook', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)
    saveCustomerSendDraft.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'draft' },
      document: {
        ...basePayload.document,
        meta: {
          ...basePayload.document.meta,
          title: 'Saved Kitchen Quote',
        },
      },
      readiness: { blockers: [], warnings: [], readyToSend: true },
    })
    submitCustomerSend.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'sent', sent_at: '2026-04-22T12:00:00.000Z' },
      document: {
        ...basePayload.document,
        meta: {
          ...basePayload.document.meta,
          title: 'Saved Kitchen Quote',
        },
      },
      readiness: { blockers: [], warnings: [], readyToSend: true },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.form?.title).toBe('Kitchen Quote')
    })

    await act(async () => {
      await result.current.persistDraft()
    })

    expect(saveCustomerSendDraft).toHaveBeenCalledWith(
      '/api/estimates/estimate-1/customer-send?v2=1',
      expect.objectContaining({ title: 'Kitchen Quote' })
    )
    expect(result.current.liveDocument?.meta.title).toBe('Saved Kitchen Quote')
    expect(result.current.hasUnsavedChanges).toBe(false)

    await act(async () => {
      await result.current.submit('send')
    })

    expect(submitCustomerSend).toHaveBeenCalledWith(
      '/api/estimates/estimate-1/customer-send?v2=1',
      expect.objectContaining({ mode: 'send' })
    )
    expect(result.current.publicUrl).toBe('https://example.test/quote')
    expect(result.current.message).toBe('Quote sent.')
    expect(result.current.isLive).toBe(true)
    expect(result.current.hasLiveLink).toBe(true)
    expect(result.current.version).toEqual({
      status: 'sent',
      sent_at: '2026-04-22T12:00:00.000Z',
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      public_token: null,
    })
  })

  it('keeps the persisted server preview unchanged until the draft is saved', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)
    saveCustomerSendDraft.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'draft' },
      document: {
        ...basePayload.document,
        meta: {
          ...basePayload.document.meta,
          title: 'Persisted After Save',
        },
      },
      readiness: { blockers: [], warnings: [], readyToSend: true },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.liveDocument?.meta.title).toBe('Kitchen Quote')
    })

    act(() => {
      result.current.setForm((current) =>
        current
          ? {
              ...current,
              title: 'Locally Edited Quote',
            }
          : current
      )
    })

    expect(result.current.hasUnsavedChanges).toBe(true)
    expect(result.current.liveDocument?.meta.title).toBe('Kitchen Quote')

    await act(async () => {
      await result.current.persistDraft()
    })

    expect(result.current.hasUnsavedChanges).toBe(false)
    expect(result.current.liveDocument?.meta.title).toBe('Persisted After Save')
  })

  it('uses quote route overrides when the alias family is provided', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        routeFamily: quoteRouteFamily,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.form?.title).toBe('Kitchen Quote')
    })

    expect(loadCustomerSendPage).toHaveBeenCalledWith(
      '/api/quotes/estimate-1/customer-send?v2=1'
    )
  })

  it('distinguishes test send from live send state transitions', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)
    submitCustomerSend.mockResolvedValue({
      version: { viewed_at: '2026-04-23T12:00:00.000Z' },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.form?.title).toBe('Kitchen Quote')
    })

    await act(async () => {
      await result.current.submit('test', { testRecipient: 'qa@example.com' })
    })

    expect(result.current.message).toBe('Test message sent.')
    expect(result.current.isLive).toBe(false)
    expect(result.current.hasLiveLink).toBe(false)
    expect(result.current.version).toEqual({
      status: 'draft',
      sent_at: null,
      viewed_at: '2026-04-23T12:00:00.000Z',
      accepted_at: null,
      declined_at: null,
      public_token: null,
    })
  })

  it('blocks live send from persisted server readiness and still allows test mode', async () => {
    saveCustomerSendDraft.mockResolvedValue({
      version: { status: 'draft' },
      document: {
        ...basePayload.document,
        total: 0,
        pricing_block: {
          ...basePayload.document.pricing_block,
          total: 0,
        },
      },
      readiness: {
        blockers: [{ code: 'document_total_non_positive', message: 'Quote total is $0.' }],
        warnings: [],
        readyToSend: false,
      },
    })
    loadCustomerSendPage.mockResolvedValue({
      ...basePayload,
      document: {
        ...basePayload.document,
        total: 0,
        pricing_block: {
          ...basePayload.document.pricing_block,
          total: 0,
        },
      },
      readiness: {
        blockers: [{ code: 'document_total_non_positive', message: 'Quote total is $0.' }],
        warnings: [],
        readyToSend: false,
      },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.form?.title).toBe('Kitchen Quote')
    })

    act(() => {
      result.current.setForm((current) =>
        current
          ? {
              ...current,
              title: 'Locally Edited Quote',
            }
          : current
      )
    })

    await act(async () => {
      await result.current.submit('send')
    })

    expect(result.current.error).toBe('Save the draft to refresh the server preview before sending this quote.')
    expect(submitCustomerSend).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.persistDraft()
    })

    await act(async () => {
      await result.current.submit('send')
    })

    expect(result.current.error).toBe('Quote total is $0.')
    expect(submitCustomerSend).not.toHaveBeenCalled()

    submitCustomerSend.mockResolvedValueOnce({
      version: { status: 'draft' },
    })

    await act(async () => {
      await result.current.submit('test', { testRecipient: 'qa@example.com' })
    })

    expect(submitCustomerSend).toHaveBeenCalledWith(
      '/api/estimates/estimate-1/customer-send?v2=1',
      expect.objectContaining({
        mode: 'test',
      })
    )
  })

  it('surfaces a live link recovery state when email delivery fails after link activation', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    submitCustomerSend.mockResolvedValue({
      public_url: 'https://example.test/quote/live-token',
      version: {
        status: 'sent',
        sent_at: '2026-04-22T12:00:00.000Z',
        public_token: 'live-token',
      },
      delivery_error: 'Gmail not configured',
    })

    try {
      const { result } = renderHook(() =>
        useCustomerSendWorkflow({
          estimateId: 'estimate-1',
          catalogSource: 'v2' as const,
          buildForm: buildCustomerSendComposerDraft,
          draftPayload: (form) => form,
          loadErrorMessage: 'Unable to load quote send page',
        })
      )

      await waitFor(() => {
        expect(result.current.form?.title).toBe('Kitchen Quote')
      })

      let submitted = true
      await act(async () => {
        submitted = await result.current.submit('send')
      })

      expect(submitted).toBe(false)
      expect(result.current.publicUrl).toBe('https://example.test/quote/live-token')
      expect(result.current.hasLiveLink).toBe(true)
      expect(result.current.message).toBe(
        'Customer link is ready. Copy the link or try sending the email again.'
      )
      expect(result.current.error).toBe('Email delivery did not complete.')
      expect(result.current.error).not.toContain('Gmail not configured')
      expect(consoleError).toHaveBeenCalledWith(
        'Customer send delivery failed after public link creation',
        expect.objectContaining({
          estimateId: 'estimate-1',
          documentType: 'quote',
          deliveryError: 'Gmail not configured',
        })
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('supports hard reloads and clears prior status messages', async () => {
    loadCustomerSendPage
      .mockResolvedValueOnce(basePayload)
      .mockResolvedValueOnce({
        ...basePayload,
        public_url: 'https://example.test/quote/reloaded',
        version: {
          status: 'sent',
          sent_at: '2026-04-23T08:00:00.000Z',
          public_token: 'reloaded-token',
        },
      })
    saveCustomerSendDraft.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'draft' },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.form?.title).toBe('Kitchen Quote')
    })

    await act(async () => {
      await result.current.persistDraft()
    })
    expect(result.current.message).toBe('Draft saved.')

    await act(async () => {
      await result.current.reload({ hard: true })
    })

    expect(result.current.message).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.publicUrl).toBe('https://example.test/quote/reloaded')
    expect(result.current.version).toEqual({
      status: 'sent',
      sent_at: '2026-04-23T08:00:00.000Z',
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      public_token: 'reloaded-token',
    })
  })

  it('recovers from an initial load failure when reloaded successfully', async () => {
    loadCustomerSendPage
      .mockRejectedValueOnce(new Error('Unable to load quote send page'))
      .mockResolvedValueOnce(basePayload)

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Unable to load quote send page')
    expect(result.current.data).toBeNull()
    expect(result.current.form).toBeNull()

    let reloaded = false
    await act(async () => {
      reloaded = await result.current.reload()
    })

    expect(reloaded).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.data).not.toBeNull()
    expect(result.current.form?.title).toBe('Kitchen Quote')
  })

  it('fills missing mutation version fields from canonical defaults', () => {
    expect(
      normalizeCustomerSendVersion({ viewed_at: '2026-04-23T08:00:00.000Z' }, 'sent')
    ).toEqual({
      status: 'sent',
      sent_at: null,
      viewed_at: '2026-04-23T08:00:00.000Z',
      accepted_at: null,
      declined_at: null,
      public_token: null,
    })
  })

  it('validates email lists and validity days helpers', () => {
    expect(isValidRecipientList('person@example.com')).toBe(true)
    expect(isValidRecipientList('first@example.com, second@example.com')).toBe(true)
    expect(isValidRecipientList('bad-address')).toBe(false)
    expect(isPositiveInteger('90')).toBe(true)
    expect(isPositiveInteger('0')).toBe(false)
    expect(isPositiveInteger('12.5')).toBe(false)
  })

  it('requires a separate internal test recipient and routes test sends there', async () => {
    loadCustomerSendPage.mockResolvedValue({
      ...basePayload,
      draft: {
        ...basePayload.draft,
        cc_email: 'team@example.com',
        bcc_email: 'owner@example.com',
      },
    })
    submitCustomerSend.mockResolvedValue({
      version: { status: 'draft' },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.form?.title).toBe('Kitchen Quote')
    })

    await act(async () => {
      await result.current.submit('test')
    })
    expect(result.current.error).toBe('Test recipient email is required.')
    expect(submitCustomerSend).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.submit('test', { testRecipient: 'customer@example.com' })
    })
    expect(result.current.error).toBe('Use an internal test recipient, not the customer To address.')
    expect(submitCustomerSend).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.submit('test', { testRecipient: 'qa@example.com' })
    })

    expect(submitCustomerSend).toHaveBeenCalledWith(
      '/api/estimates/estimate-1/customer-send?v2=1',
      expect.objectContaining({
        mode: 'test',
        draft: expect.objectContaining({
          to_email: 'qa@example.com',
          cc_email: '',
          bcc_email: '',
        }),
      })
    )
  })
})
