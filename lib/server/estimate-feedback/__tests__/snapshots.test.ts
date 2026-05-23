import { describe, expect, it } from 'vitest'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import type { EstimateV2GetResponse } from '@/types/estimator/v2Summary'
import { buildEstimateSnapshotRows } from '../snapshots.ts'

function customerDocument(total: number): CustomerEstimateDocument {
  return {
    meta: {
      estimate_id: 'estimate-1',
      version_name: 'Kitchen Quote',
      version_state: 'accepted',
      flow_version: 'v2',
      title: 'Kitchen Quote',
      quote_date: '2026-05-11',
      sent_at: '2026-05-10T15:00:00.000Z',
      viewed_at: null,
      accepted_at: '2026-05-11T15:00:00.000Z',
      declined_at: null,
      status: 'accepted',
      public_token: 'public-token-1',
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '',
      business_email: '',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    customer: {
      name: 'Taylor Smith',
      email: 'taylor@example.test',
      phone: '',
      address: '',
      street: '',
      city: '',
      state: '',
      zip: '',
    },
    intro_paragraph: '',
    closing_paragraph: '',
    quote_validity_days: 30,
    deposit_language: '',
    card_fee_note: '',
    quote_rows: [],
    scopes: [],
    total,
    terms: [],
    source_meta: {
      company: {
        business_name: true,
        main_phone: false,
        business_email: false,
        address: false,
        website: false,
        sender_signature: false,
        logo_url: false,
      },
      settings: {
        quote_validity_days: true,
        terms_text: false,
        terms_sections: false,
      },
      overrides: {
        title: true,
        intro_paragraph: false,
        closing_paragraph: false,
        deposit_language: false,
        card_fee_note: false,
      },
    },
    header: {
      company_name: 'ACE Painting',
      contact_lines: [],
      logo_url: '',
      document_label: 'QUOTE',
      quote_date_label: '2026-05-11',
    },
    customer_block: {
      lines: ['Taylor Smith'],
    },
    pricing_block: {
      rows: [],
      total,
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
      used_explicit_terms_text: false,
    },
  }
}

function estimateResponse(): EstimateV2GetResponse {
  return {
    estimate: {
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Kitchen Quote',
    },
    inputs: {
      rooms: [],
      room_wall_scopes: [],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [],
      ceiling_scope_segments: [],
      room_trim_scopes: [],
      room_door_scopes: [],
      drywall_repairs: [],
      access_fees: [],
      prejob: [
        {
          id: 'prejob-raw-1',
          room_id: 'room-1',
          active: 'Y',
          trip_name: 'Wallpaper prep',
          trip_num: 2,
          trip_rate: 75,
          manual_adjustment: 25,
        },
      ],
      trim_items: [],
      other: [],
      jobsettings: {},
      org_defaults: {},
    },
    wall_calculations: { scopes: [] },
    ceiling_calculations: { scopes: [] },
    trim_calculations: { scopes: [] },
    door_calculations: { scopes: [] },
    drywall_calculations: { scopes: [] },
    pricing_summary: { finalTotal: 175, prepTripCost: 175 },
  } as unknown as EstimateV2GetResponse
}

describe('estimate feedback snapshots', () => {
  it('calculates raw prejob rows into accepted snapshot payloads and lines', () => {
    const built = buildEstimateSnapshotRows({
      orgId: 'org-1',
      estimateResponse: estimateResponse(),
      job: { id: 'job-1', customer_id: 'customer-1' },
      publicVersion: {
        id: 'public-version-1',
        estimate_id: 'estimate-1',
        status: 'accepted',
        accepted_at: '2026-05-11T15:00:00.000Z',
        public_token: 'public-token-1',
        version_number: 1,
        acceptance_json: {
          legal_name: 'Taylor Smith',
          signature_type: 'typed',
          signature_value: 'Taylor Smith',
          accepted_terms: true,
          accepted_at: '2026-05-11T15:00:00.000Z',
          user_agent: 'Vitest',
          ip: '127.0.0.1',
        },
        snapshot_json: {
          artifact_kind: 'customer_estimate_artifact',
          artifact_version: 1,
          document: customerDocument(175),
        },
      },
      createdBy: 'user-1',
    })

    expect(built.snapshot.estimated_total).toBe(175)

    const sourcePayload = built.snapshot.source_payload_json as {
      internal_operational_estimate: {
        inputs: {
          prejob: Array<Record<string, unknown>>
        }
      }
    }
    expect(sourcePayload.internal_operational_estimate.inputs.prejob[0]).toEqual(
      expect.objectContaining({
        calculated_total: 150,
        raw_total: 175,
        effective_total: 175,
        final_total: 175,
      })
    )

    const prejobLine = built.lines.find((line) => line.line_kind === 'prejob')
    expect(prejobLine).toEqual(
      expect.objectContaining({
        line_kind: 'prejob',
        source_table: 'estimate_prejob',
        source_row_id: 'prejob-raw-1',
        estimated_total: 175,
        label: 'Wallpaper prep',
      })
    )
    expect(prejobLine?.output_json).toEqual(
      expect.objectContaining({
        calculated_total: 150,
        raw_total: 175,
        effective_total: 175,
        final_total: 175,
      })
    )
  })
})
