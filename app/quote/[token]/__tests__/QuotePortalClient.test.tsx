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
  acceptedAt = null,
  declinedAt = null,
  acceptanceJson = null,
  sentAt = null,
  quoteValidityDays = 30,
}: {
  status?: EstimatePublicSnapshot['status']
  publicToken?: string
  acceptedAt?: string | null
  declinedAt?: string | null
  acceptanceJson?: EstimatePublicSnapshot['acceptance_json']
  sentAt?: string | null
  quoteValidityDays?: number
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
          sent_at: sentAt,
          viewed_at: null,
          accepted_at: acceptedAt,
          declined_at: declinedAt,
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
        sent_at: sentAt,
        viewed_at: null,
        accepted_at: acceptedAt,
        declined_at: declinedAt,
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
      quote_validity_days: quoteValidityDays,
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
    sent_at: sentAt,
    viewed_at: null,
    accepted_at: acceptedAt,
    declined_at: declinedAt,
    locked_at: null,
    acceptance_json: acceptanceJson,
  }
}

describe('QuotePortalClient', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    cleanup()
  })

  it('submits typed signature accept payload', async () => {
    mockFetch.mockResolvedValue(createResponse({ data: createWorkflowSnapshot('accepted') }))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    const legalName = screen.getByLabelText('Full legal name')
    fireEvent.change(legalName, { target: { value: 'Jordan Customer' } })

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'typed' } })
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
        customer_email: 'jordan@example.com',
        signature_type: 'typed',
        signature_value: 'Jordan Customer',
        accepted_terms: true,
      })
    })

    expect(await screen.findAllByText("Quote accepted. We'll contact you soon to confirm the next steps.")).toHaveLength(1)
  })

  it('defaults to typed signature mode', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    expect(screen.getByRole('combobox', { name: 'Signature mode' })).toHaveValue('typed')
    expect(screen.getByLabelText('Typed signature')).toBeTruthy()
    expect(screen.getByText('Signature preview')).toBeTruthy()
  })

  it('shows a cursive-style preview for typed signatures', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'typed' } })
    fireEvent.change(screen.getByLabelText('Typed signature'), { target: { value: 'Jordan Customer' } })

    expect(screen.getByText('Signature preview')).toBeTruthy()
    expect(screen.getByTestId('typed-signature-preview').textContent).toBe('Jordan Customer')
  })

  it('supports drawn signatures and submits canvas payload', async () => {
    mockFetch.mockResolvedValue(createResponse({ data: createWorkflowSnapshot('accepted') }))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'drawn' } })

    const signatureCanvas = screen.getByTestId('quote-signature-canvas') as HTMLCanvasElement
    signatureCanvas.toDataURL = vi.fn(() => 'data:image/png;base64,QUJDRA==')
    const agree = screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' })
    fireEvent.click(agree)

    const accept = screen.getByRole('button', { name: 'Accept Quote' })
    expect(accept).toBeDisabled()

    fireEvent.pointerDown(signatureCanvas, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(signatureCanvas, { pointerId: 1, clientX: 20, clientY: 12 })
    fireEvent.pointerMove(signatureCanvas, { pointerId: 1, clientX: 28, clientY: 11 })
    fireEvent.pointerUp(signatureCanvas, { pointerId: 1, clientX: 28, clientY: 11 })

    expect(accept).toBeEnabled()
    fireEvent.click(accept)

    await waitFor(() => {
      const [url, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(String(init?.body))
      expect(url).toBe('/api/quote-public/public-token/accept')
      expect(body.signature_type).toBe('drawn')
      expect(body.signature_value).toBe('data:image/png;base64,QUJDRA==')
    })
  })

  it('rejects tiny drawn marks but accepts a short intentional signature stroke', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'drawn' } })

    const signatureCanvas = screen.getByTestId('quote-signature-canvas') as HTMLCanvasElement
    signatureCanvas.toDataURL = vi.fn(() => 'data:image/png;base64,QUJDRA==')
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))

    const accept = screen.getByRole('button', { name: 'Accept Quote' })
    fireEvent.pointerDown(signatureCanvas, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(signatureCanvas, { pointerId: 1, clientX: 12, clientY: 10 })
    fireEvent.pointerUp(signatureCanvas, { pointerId: 1, clientX: 12, clientY: 10 })

    expect(accept).toBeDisabled()

    fireEvent.pointerDown(signatureCanvas, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(signatureCanvas, { pointerId: 1, clientX: 20, clientY: 12 })
    fireEvent.pointerMove(signatureCanvas, { pointerId: 1, clientX: 28, clientY: 11 })
    fireEvent.pointerUp(signatureCanvas, { pointerId: 1, clientX: 28, clientY: 11 })

    expect(accept).toBeEnabled()
  })

  it('shows submit disabled state while accepting', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveFetch = resolve
    })
    mockFetch.mockReturnValue(pending as Promise<never>)

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'typed' } })
    fireEvent.change(screen.getByLabelText('Typed signature'), { target: { value: 'Jordan Customer' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))
    const acceptButton = screen.getByRole('button', { name: 'Accept Quote' })
    fireEvent.click(acceptButton)

    expect(acceptButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decline Quote' })).toBeDisabled()
    expect(screen.getByText('Sending your acceptance...')).toBeTruthy()

    resolveFetch(createResponse({ data: createWorkflowSnapshot('accepted') }))

    expect(await screen.findAllByText("Quote accepted. We'll contact you soon to confirm the next steps.")).toHaveLength(1)
  })

  it('renders decline controls on the active sign page', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    expect(screen.getByLabelText('Decline note (optional)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decline Quote' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept Quote' })).toBeTruthy()
  })

  it('submits the existing public decline endpoint with an optional note', async () => {
    mockFetch.mockResolvedValue(createResponse({ data: createWorkflowSnapshot('declined') }))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByLabelText('Decline note (optional)'), {
      target: { value: 'Timing no longer works for us.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Decline Quote' }))

    await waitFor(() => {
      const [url, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(String(init?.body))
      expect(url).toBe('/api/quote-public/public-token/decline')
      expect(init?.method).toBe('POST')
      expect(body).toMatchObject({
        reason: 'Timing no longer works for us.',
      })
    })

    expect(
      await screen.findAllByText("Quote declined. We'll review your note and follow up if anything else is needed.")
    ).toHaveLength(2)
  })

  it('shows submit disabled state while declining', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveFetch = resolve
    })
    mockFetch.mockReturnValue(pending as Promise<never>)

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByLabelText('Decline note (optional)'), {
      target: { value: 'We are postponing this work.' },
    })
    const declineButton = screen.getByRole('button', { name: 'Decline Quote' })
    const acceptButton = screen.getByRole('button', { name: 'Accept Quote' })
    fireEvent.click(declineButton)

    expect(declineButton).toBeDisabled()
    expect(acceptButton).toBeDisabled()
    expect(screen.getByText('Sending your decline...')).toBeTruthy()

    resolveFetch(createResponse({ data: createWorkflowSnapshot('declined') }))

    expect(
      await screen.findAllByText("Quote declined. We'll review your note and follow up if anything else is needed.")
    ).toHaveLength(2)
  })

  it('renders an explicit locked expired state before the customer can accept', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'))

    render(
      <QuotePortalClient
        snapshot={createPublicSnapshot({
          sentAt: '2026-03-01T12:00:00.000Z',
          quoteValidityDays: 30,
        })}
      />
    )

    expect(screen.getByText('This quote has expired')).toBeTruthy()
    expect(
      screen.getByText(
        'This quote has expired. Please contact us for an updated quote.'
      )
    ).toBeTruthy()
    expect(
      screen.getAllByText(
        'This quote can no longer be accepted. Please contact us for an updated quote.'
      ).length
    ).toBeGreaterThan(0)
    expect(screen.getByText('Status: Expired')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
    expect(screen.queryByLabelText('Full legal name')).toBeNull()
    expect(screen.getByRole('button', { name: 'Print Quote' })).toBeTruthy()
  })

  it('renders locked content for accepted quote', () => {
    render(
      <QuotePortalClient
        snapshot={createPublicSnapshot({
          status: 'accepted',
          acceptedAt: '2026-04-15T15:30:00.000Z',
          acceptanceJson: {
            legal_name: 'Jordan Customer',
            signature_type: 'typed',
            signature_value: 'Jordan Customer',
            accepted_terms: true,
            accepted_at: '2026-04-15T15:30:00.000Z',
            user_agent: '',
            ip: '',
          },
        })}
      />
    )

    expect(screen.getAllByText("Quote accepted. We'll contact you soon to confirm the next steps.")).toHaveLength(1)
    expect(screen.getByText('Signed by Jordan Customer')).toBeTruthy()
    expect(screen.getByText(/Accepted Apr 15, 2026/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Print Quote' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'View quote' })).toBeNull()
    expect(screen.queryByText('Accepted quote record')).toBeNull()
    expect(screen.queryByText('Legal name')).toBeNull()
    expect(screen.getByText('Jordan Customer')).toBeTruthy()
    expect(screen.queryByText('Signature type')).toBeNull()
    expect(screen.queryByText('Typed')).toBeNull()
    expect(screen.queryByText('Public version')).toBeNull()
    expect(screen.queryByText('#1')).toBeNull()
    expect(screen.queryByText('IP address')).toBeNull()
    expect(screen.queryByText('User agent')).toBeNull()
    expect(screen.queryByText('Accepted quote link')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
  })

  it('renders locked content for declined quote', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot({ status: 'declined' })} />)

    expect(
      screen.getAllByText("Quote declined. We'll review your note and follow up if anything else is needed.")
    ).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Decline Quote' })).toBeNull()
  })

  it('renders read-only content for superseded quote', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot({ status: 'superseded' })} />)

    expect(screen.getAllByText('This quote is no longer current. Please contact us for the latest version.')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Decline Quote' })).toBeNull()
  })

  it('renders assembled placeholder policy copy from the document contract', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    expect(screen.getByText('[Deposit terms missing]')).toBeTruthy()
    expect(screen.getByText('[Card fee note missing]')).toBeTruthy()
  })

  it('normalizes declined-quote conflicts into customer-facing copy', async () => {
    mockFetch.mockResolvedValue(createResponse({ error: 'Cannot accept a declined quote' }, false))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'typed' } })
    fireEvent.change(screen.getByLabelText('Typed signature'), { target: { value: 'Jordan Customer' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept Quote' }))

    expect(
      await screen.findByText("This quote has already been declined. Please contact us if you'd like to revisit it.")
    ).toBeTruthy()
    expect(screen.queryByText("Quote accepted. We'll contact you soon to confirm the next steps.")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Decline Quote' })).toBeNull()
  })

  it('normalizes accepted-by-another-version conflicts into customer-facing copy', async () => {
    mockFetch.mockResolvedValue(
      createResponse({ error: 'Estimate is already accepted by another public version' }, false)
    )

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'typed' } })
    fireEvent.change(screen.getByLabelText('Typed signature'), { target: { value: 'Jordan Customer' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept Quote' }))

    expect(
      await screen.findByText(
        'This quote is no longer available because another version has already been approved.'
      )
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
  })

  it('normalizes accepted-quote conflicts into customer-facing copy', async () => {
    mockFetch.mockResolvedValue(createResponse({ error: 'Cannot decline an accepted quote' }, false))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Decline Quote' }))

    expect(
      await screen.findByText("This quote has already been accepted. We'll contact you soon to confirm the next steps.")
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Decline Quote' })).toBeNull()
  })

  it('normalizes superseded conflicts into customer-facing copy', async () => {
    mockFetch.mockResolvedValue(createResponse({ error: 'A newer quote is available.' }, false))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'typed' } })
    fireEvent.change(screen.getByLabelText('Typed signature'), { target: { value: 'Jordan Customer' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept Quote' }))

    expect(
      await screen.findAllByText('This quote is no longer current. Please contact us for the latest version.')
    ).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
  })

  it('keeps form data intact and allows immediate retry for transient accept failures', async () => {
    mockFetch.mockResolvedValue(createResponse({ error: 'Unexpected database timeout' }, false))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'typed' } })
    fireEvent.change(screen.getByLabelText('Full legal name'), { target: { value: 'Jordan Customer' } })
    fireEvent.change(screen.getByLabelText('Typed signature'), { target: { value: 'Jordan Customer' } })
    fireEvent.change(screen.getByLabelText('Message (optional)'), {
      target: { value: 'Please use the side gate.' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept Quote' }))

    expect(
      await screen.findByText("We couldn't update this quote right now. Please try again or contact us.")
    ).toBeTruthy()
    expect(screen.getByLabelText('Full legal name')).toHaveValue('Jordan Customer')
    expect(screen.getByLabelText('Typed signature')).toHaveValue('Jordan Customer')
    expect(screen.getByLabelText('Message (optional)')).toHaveValue('Please use the side gate.')
    expect(screen.getByRole('button', { name: 'Accept Quote' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Decline Quote' })).toBeEnabled()
    expect(screen.queryByText("Quote declined. We'll review your note and follow up if anything else is needed.")).toBeNull()
  })

  it('keeps decline form data intact and allows immediate retry for transient decline failures', async () => {
    mockFetch.mockResolvedValue(createResponse({ error: 'Unexpected database timeout' }, false))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByLabelText('Decline note (optional)'), {
      target: { value: 'We need to postpone this project.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Decline Quote' }))

    expect(
      await screen.findByText("We couldn't update this quote right now. Please try again or contact us.")
    ).toBeTruthy()
    expect(screen.getByLabelText('Decline note (optional)')).toHaveValue('We need to postpone this project.')
    expect(screen.getByRole('button', { name: 'Decline Quote' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Accept Quote' })).toBeTruthy()
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

  it('does not expose internal print diagnostics on the customer signing page', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'lib/customer-estimates/PublicEstimatePortal.tsx'),
      'utf8'
    )

    expect(source).toContain('showOverflowWarnings={false}')
    expect(source).not.toContain('<AcceptedQuoteRecord')
  })

  it('keeps the public signing portal usable on phone-sized screens', () => {
    const portalStyles = readFileSync(
      path.resolve(process.cwd(), 'lib/customer-estimates/PublicEstimatePortal.module.css'),
      'utf8'
    )
    const documentViewSource = readFileSync(
      path.resolve(process.cwd(), 'lib/customer-estimates/view.tsx'),
      'utf8'
    )

    expect(portalStyles).toContain('@media (max-width: 640px)')
    expect(portalStyles).toContain("data:image/svg+xml,%3Csvg")
    expect(portalStyles).toContain("polyline points='20 6 9 17 4 12'")
    expect(portalStyles).toContain('.documentWrap')
    expect(portalStyles).toContain('overflow-x: visible')
    expect(portalStyles).toContain('grid-template-columns: 1fr')
    expect(portalStyles).toContain('min-height: 54px')
    expect(documentViewSource).toContain('@media (max-width: 640px)')
    expect(documentViewSource).toContain('padding-top: 0 !important')
    expect(documentViewSource).toContain('position: static !important')
    expect(documentViewSource).toContain('padding: 22px 18px !important')
    expect(documentViewSource).toContain('font-size: 11.5px !important')
  })
})
