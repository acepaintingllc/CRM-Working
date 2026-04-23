import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuotePortalClient from '../QuotePortalClient'
import type { EstimatePublicSnapshot } from '@/lib/customer-estimates/types'
import { readFileSync } from 'fs'
import path from 'path'

const mockFetch = vi.fn()

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: vi.fn(async () => payload),
  }
}

function createWorkflowSnapshot(status: EstimatePublicSnapshot['status']) {
  return createPublicSnapshot({
    status,
    publicToken: 'public-token',
  })
}

function createPublicSnapshot({
  status = 'sent',
  publicToken = 'public-token',
}: {
  status?: EstimatePublicSnapshot['status']
  publicToken?: string
} = {}): EstimatePublicSnapshot {
  return {
    estimate_id: 'estimate-1',
    estimate_version_id: 'version-1',
    version_number: 1,
    status,
    public_token: publicToken,
    public_url: `https://example.com/quote/${publicToken}`,
    draft: {},
    snapshot_json: {
      document: {
        meta: {
          title: 'Kitchen Quote',
          version_name: 'Option A',
          status,
          flow_version: 'v2',
          quote_date: '2026-04-15',
          sent_at: null,
          viewed_at: null,
          accepted_at: null,
          declined_at: null,
          estimate_id: 'estimate-1',
          version_state: 'sent',
          public_token: publicToken,
        },
      },
    },
    document: {
      meta: {
        title: 'Kitchen Quote',
        version_name: 'Option A',
        status,
        flow_version: 'v2',
        quote_date: '2026-04-15',
        sent_at: null,
        viewed_at: null,
        accepted_at: null,
        declined_at: null,
        estimate_id: 'estimate-1',
        version_state: 'sent',
        public_token: publicToken,
      },
      company: {
        business_name: 'ACE Painting',
        timezone: 'America/Chicago',
        main_phone: '111-111-1111',
        business_email: 'hello@ace.com',
        address: '123 Main Street',
        website: 'https://acepainting.example.com',
        sender_signature: 'ACE',
        logo_url: '',
      },
      customer: {
        name: 'Jordan Customer',
        email: 'jordan@example.com',
        phone: '444-444-4444',
        address: '456 Customer Ave',
        street: '456 Customer Ave',
        city: 'Leland',
        state: 'IN',
        zip: '46052',
      },
      intro_paragraph: '',
      closing_paragraph: '',
      quote_validity_days: 30,
      deposit_language: '',
      card_fee_note: '',
      quote_rows: [],
      scopes: [],
      total: 1200,
      terms: [],
      source_meta: {
        company: {
          business_name: true,
          main_phone: true,
          business_email: true,
          address: true,
          website: true,
          sender_signature: true,
          logo_url: false,
        },
        settings: {
          quote_validity_days: true,
          terms_text: false,
        },
        overrides: {
          title: false,
          intro_paragraph: false,
          closing_paragraph: false,
          deposit_language: false,
          card_fee_note: false,
        },
      },
      header: {
        company_name: 'ACE Painting',
        contact_lines: ['111-111-1111', 'hello@ace.com'],
        logo_url: '',
        document_label: 'QUOTE',
        quote_date_label: '2026-04-15',
      },
      customer_block: {
        lines: ['Jordan Customer', '456 Customer Ave'],
      },
      pricing_block: {
        rows: [],
        total: 1200,
        footer_note: 'This quote is subject to the terms and conditions on page 2.',
      },
      terms_page: {
        title: 'QUOTE TERMS',
        sections: [
          {
            key: 'pricing_payment',
            title: 'Pricing & Payment Terms',
            paragraphs: ['[Deposit terms missing]', '[Card fee note missing]'],
          },
        ],
      },
      assembly_meta: {
        missing_company_fields: [],
        missing_payment_fields: ['[Deposit terms missing]', '[Card fee note missing]'],
        missing_legal_fields: ['[Insurance statement missing]'],
        used_placeholder_fallbacks: true,
        used_explicit_terms_text: false,
      },
    },
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    locked_at: null,
  }
}

describe('QuotePortalClient', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('submits typed signature accept payload', async () => {
    mockFetch.mockResolvedValue(createResponse({ data: createWorkflowSnapshot('accepted') }))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    const legalName = screen.getByLabelText('Full legal name')
    fireEvent.change(legalName, { target: { value: 'Jordan Customer' } })

    const typedSignature = screen.getByLabelText('Typed signature')
    fireEvent.change(typedSignature, { target: { value: 'Jordan Customer' } })

    const agreement = screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' })
    fireEvent.click(agreement)

    fireEvent.click(screen.getByRole('button', { name: 'Accept Quote' }))

    await waitFor(() => {
      const [url, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(String(init?.body))
      expect(url).toBe('/api/quote-public/public-token/accept')
      expect(init?.method).toBe('POST')
      expect(body).toMatchObject({
        legal_name: 'Jordan Customer',
        signature_type: 'typed',
        signature_value: 'Jordan Customer',
        accepted_terms: true,
      })
    })

    expect(await screen.findByText('This quote has been accepted and locked.')).toBeTruthy()
  })

  it('supports drawn signatures and submits canvas payload', async () => {
    mockFetch.mockResolvedValue(createResponse({ data: createWorkflowSnapshot('accepted') }))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'drawn' } })

    const signatureCanvas = screen.getByTestId('quote-signature-canvas') as HTMLCanvasElement
    signatureCanvas.toDataURL = vi.fn(() => 'data:image/png;base64,drawn-signature')
    const agree = screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' })
    fireEvent.click(agree)

    const accept = screen.getByRole('button', { name: 'Accept Quote' })
    expect(accept).toBeDisabled()

    fireEvent.pointerDown(signatureCanvas, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(signatureCanvas, { pointerId: 1, clientX: 12, clientY: 12 })
    fireEvent.pointerUp(signatureCanvas, { pointerId: 1, clientX: 12, clientY: 12 })

    expect(accept).toBeEnabled()
    fireEvent.click(accept)

    await waitFor(() => {
      const [url, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(String(init?.body))
      expect(url).toBe('/api/quote-public/public-token/accept')
      expect(body.signature_type).toBe('drawn')
      expect(body.signature_value).toBe('data:image/png;base64,drawn-signature')
    })
  })

  it('shows submit disabled state while accepting', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveFetch = resolve
    })
    mockFetch.mockReturnValue(pending as Promise<never>)

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))
    const acceptButton = screen.getByRole('button', { name: 'Accept Quote' })
    const declineButton = screen.getByRole('button', { name: 'Decline' })
    fireEvent.click(acceptButton)

    expect(acceptButton).toBeDisabled()
    expect(declineButton).toBeDisabled()
    expect(screen.getByText('Submitting quote acceptance...')).toBeTruthy()

    resolveFetch(createResponse({ data: createWorkflowSnapshot('accepted') }))

    expect(await screen.findByText('This quote has been accepted and locked.')).toBeTruthy()
  })

  it('renders locked content for accepted quote', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot({ status: 'accepted' })} />)

    expect(screen.getByText('This quote has been accepted and locked.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
  })

  it('renders locked content for declined quote', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot({ status: 'declined' })} />)

    expect(screen.getByText('This quote has been declined and locked.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
  })

  it('renders assembled placeholder policy copy from the document contract', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    expect(screen.getByText('[Deposit terms missing]')).toBeTruthy()
    expect(screen.getByText('[Card fee note missing]')).toBeTruthy()
  })

  it('renders submit errors without mutating the locked state', async () => {
    mockFetch.mockResolvedValue(createResponse({ error: 'Cannot accept a declined quote' }, false))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept Quote' }))

    expect(await screen.findByText('Cannot accept a declined quote')).toBeTruthy()
    expect(screen.queryByText('This quote has been accepted and locked.')).toBeNull()
  })

  it('keeps the quote portal client as a thin wrapper over the shared public portal', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/quote/[token]/QuotePortalClient.tsx'),
      'utf8'
    )
    const imports = Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g), (match) => match[1]).sort()

    expect(imports).toEqual([
      './quotePortalCopy',
      '@/lib/customer-estimates/PublicEstimatePortal',
      '@/lib/customer-estimates/types',
    ])
    expect(source.includes('buildCustomerEstimateDocument')).toBe(false)
    expect(source.includes('assembleCustomerEstimateDocument')).toBe(false)
  })
})
