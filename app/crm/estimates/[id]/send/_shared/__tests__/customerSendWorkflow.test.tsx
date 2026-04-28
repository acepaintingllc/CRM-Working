import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quoteRouteFamily } from '@/app/crm/estimates/[id]/estimateRouteFamily'
import {
  buildCustomerSendComposerDraft,
  buildCustomerSendComposerPreview,
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
  estimate: {},
  job: {
    customer_email: 'customer@example.com',
    estimate_date: '2026-04-22',
  },
  customer: {
    name: 'Taylor',
    email: 'customer@example.com',
  },
  company: {
    business_name: 'ACE Painting',
    business_email: 'owner@example.com',
  },
  inputs: {},
  catalogs: null,
  pricing_summary: { finalTotal: 1200 },
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
  },
  public_url: null,
  document: {
    meta: {
      title: 'Kitchen Quote',
      flow_version: 'v2',
    },
    customer: {
      name: 'Taylor',
      email: 'customer@example.com',
    },
    quote_validity_days: 90,
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
  },
  versions: [],
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

  it('builds the composer preview from configured quote terms', () => {
    const form = buildCustomerSendComposerDraft(basePayload as never, {}, true)
    const document = buildCustomerSendComposerPreview(basePayload as never, form, null)

    expect(document.terms_page.sections.find((section) => section.key === 'terms_and_conditions'))
      .toEqual(expect.objectContaining({ paragraphs: ['Configured quote terms.'] }))
    expect(document.assembly_meta.missing_payment_fields).toEqual([])
    expect(document.assembly_meta.missing_legal_fields).toEqual([])
  })

  it('loads, saves, and submits through the shared workflow hook', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)
    saveCustomerSendDraft.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'draft' },
    })
    submitCustomerSend.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'sent', sent_at: '2026-04-22T12:00:00.000Z' },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        buildDocument: (data) => data.document,
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

  it('uses quote route overrides when the alias family is provided', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        routeFamily: quoteRouteFamily,
        buildForm: buildCustomerSendComposerDraft,
        buildDocument: (data) => data.document,
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
        buildDocument: (data) => data.document,
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
        buildDocument: (data) => data.document,
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
        buildDocument: (data) => data.document,
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
