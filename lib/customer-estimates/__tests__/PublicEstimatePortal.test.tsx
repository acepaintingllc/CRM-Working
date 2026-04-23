import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { PublicEstimatePortal } from '../PublicEstimatePortal'
import type { EstimatePublicSnapshot } from '../types'

vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: null }),
  }))
)

function createSnapshot(): EstimatePublicSnapshot {
  return {
    estimate_id: 'estimate-1',
    estimate_version_id: 'version-1',
    version_number: 1,
    status: 'sent',
    public_token: 'token-1',
    public_url: 'https://example.test/quote/token-1',
    draft: {
      template_key: 'default',
      scope_text_edits: { walls: 'raw draft should stay hidden' },
      internal_only: 'do-not-render',
    },
    snapshot_json: {
      document: {
        meta: {
          title: 'Kitchen Quote',
          version_name: 'Option A',
          version_state: 'sent',
          flow_version: 'v2',
          quote_date: '2026-04-20',
          estimate_id: 'estimate-1',
          sent_at: null,
          viewed_at: null,
          accepted_at: null,
          declined_at: null,
          status: 'sent',
          public_token: 'token-1',
        },
      },
    },
    document: {
      meta: {
        title: 'Kitchen Quote',
        version_name: 'Option A',
        version_state: 'sent',
        flow_version: 'v2',
        quote_date: '2026-04-20',
        estimate_id: 'estimate-1',
        sent_at: null,
        viewed_at: null,
        accepted_at: null,
        declined_at: null,
        status: 'sent',
        public_token: 'token-1',
      },
      company: {
        business_name: 'ACE Painting',
        timezone: 'America/Chicago',
        main_phone: '111-111-1111',
        business_email: 'hello@ace.com',
        address: '',
        website: '',
        sender_signature: '',
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
      deposit_language: 'Half due on booking.',
      card_fee_note: 'Cards add 3%.',
      quote_rows: [
        {
          key: 'walls',
          label: 'Walls',
          description: 'Customer-approved wall scope.',
          price: 1200,
        },
      ],
      scopes: [
        {
          key: 'walls',
          label: 'Walls',
          text: 'Customer-approved wall scope.',
          price: 1200,
        },
      ],
      total: 1200,
      terms: ['Line one.'],
      source_meta: {
        company: {
          business_name: true,
          main_phone: true,
          business_email: true,
          address: false,
          website: false,
          sender_signature: false,
          logo_url: false,
        },
        settings: {
          quote_validity_days: true,
          terms_text: true,
        },
        overrides: {
          title: false,
          intro_paragraph: false,
          closing_paragraph: false,
          deposit_language: true,
          card_fee_note: true,
        },
      },
      header: {
        company_name: 'ACE Painting',
        contact_lines: ['111-111-1111', 'hello@ace.com'],
        logo_url: '',
        document_label: 'QUOTE',
        quote_date_label: '2026-04-20',
      },
      customer_block: {
        lines: ['Jordan Customer', '456 Customer Ave'],
      },
      pricing_block: {
        rows: [
          {
            key: 'walls',
            label: 'Walls',
            description: 'Customer-approved wall scope.',
            price: 1200,
          },
        ],
        total: 1200,
        footer_note: 'This quote is subject to the terms and conditions on page 2.',
      },
      terms_page: {
        title: 'QUOTE TERMS',
        sections: [
          {
            key: 'pricing_payment',
            title: 'Pricing & Payment Terms',
            paragraphs: ['Half due on booking.', 'Cards add 3%.'],
          },
        ],
      },
      assembly_meta: {
        missing_company_fields: [],
        missing_payment_fields: [],
        missing_legal_fields: ['[Insurance statement missing]'],
        used_placeholder_fallbacks: true,
        used_explicit_terms_text: true,
      },
    },
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    locked_at: null,
  }
}

describe('PublicEstimatePortal boundaries', () => {
  it('renders the assembled document contract without exposing raw draft payloads', () => {
    render(
      <PublicEstimatePortal
        initialSnapshot={createSnapshot()}
        apiBasePath="/api/quote-public"
        copy={{
          shellTitle: 'Customer Quote',
          documentLabel: 'Quote',
          acceptanceTitle: 'Review and accept this quote',
          agreementText: 'I agree to the scope, pricing, and terms shown above.',
          downloadLabel: 'Download PDF',
          unavailableTitle: 'Unavailable',
          unavailableMessage: 'Unavailable',
        }}
      />
    )

    expect(screen.getByText('Kitchen Quote')).toBeTruthy()
    expect(screen.getByText('Customer-approved wall scope.')).toBeTruthy()
    expect(screen.queryByText('raw draft should stay hidden')).toBeNull()
    expect(screen.queryByText('do-not-render')).toBeNull()
  })

  it('keeps the shared public portal renderer free of build and server composition imports', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'lib/customer-estimates/PublicEstimatePortal.tsx'),
      'utf8'
    )

    expect(source.includes("from './build'")).toBe(false)
    expect(source.includes("from './assemble'")).toBe(false)
    expect(source.includes("from '@/lib/server/")).toBe(false)
    expect(source.includes("from './view'")).toBe(true)
  })
})
