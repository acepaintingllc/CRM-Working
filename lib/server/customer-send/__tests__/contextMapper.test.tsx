import { describe, expect, it } from 'vitest'
import {
  buildEstimateCustomerSendContext,
  selectEstimateCustomerSendVersions,
} from '../contextMapper'
import type { EstimateCustomerSendRawResources } from '../contextTypes'

const baseResources: EstimateCustomerSendRawResources = {
  estimate: {
    id: 'estimate-1',
    job_id: 'job-1',
    customer_id: 'customer-1',
    status: 'draft',
    version_name: 'Kitchen Quote',
    version_state: 'draft',
    version_kind: 'standard',
    version_sort_order: 1,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-02T00:00:00.000Z',
  },
  job: {
    id: 'job-1',
    title: 'Kitchen',
    estimate_date: '2026-04-22',
  },
  customer: {
    id: 'customer-1',
    name: 'Taylor',
    email: 'taylor@example.com',
    phone: '555-1212',
    address: '123 Main',
    street: '123 Main',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
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
  quoteDefaults: {
    default_template_key: 'default',
    quote_validity_days: 90,
    terms_text: 'Standard terms',
  },
  settingsRow: {
    updated_at: null,
  },
  jobsettings: {},
  rooms: [{ room_id: 'room-1' }],
  wallScopes: [{ room_id: 'room-1' }],
  segments: [{ id: 'segment-1' }],
  wallSegments: [{ id: 'wall-segment-1' }],
  ceilingSegments: [{ id: 'ceiling-segment-1' }],
  ceilingScopes: [{ room_id: 'room-1' }],
  ceilingScopeSegments: [{ id: 'ceiling-scope-segment-1' }],
  trimScopes: [{ room_id: 'room-1' }],
  trimItems: [{ id: 'trim-1' }],
  other: [{ id: 'other-1' }],
  publicVersions: [],
  catalogs: { paints: [] },
}

describe('customer send context mapper', () => {
  it('prefers latest draft, then latest sent, then newest version for preview selection', () => {
    const draftPreferred = selectEstimateCustomerSendVersions([
      { id: 'version-3', status: 'draft' },
      { id: 'version-2', status: 'sent', public_token: 'abc' },
      { id: 'version-1', status: 'accepted', public_token: 'def' },
    ])
    expect(draftPreferred.latestDraftVersion?.id).toBe('version-3')
    expect(draftPreferred.latestSentVersion?.id).toBe('version-2')
    expect(draftPreferred.previewVersion?.id).toBe('version-3')

    const sentFallback = selectEstimateCustomerSendVersions([
      { id: 'version-2', status: 'accepted', public_token: 'abc' },
      { id: 'version-1', status: 'superseded' },
    ])
    expect(sentFallback.latestDraftVersion).toBeNull()
    expect(sentFallback.latestSentVersion?.id).toBe('version-2')
    expect(sentFallback.previewVersion?.id).toBe('version-2')

    const newestFallback = selectEstimateCustomerSendVersions([{ id: 'version-1', status: 'drafted?' }])
    expect(newestFallback.previewVersion?.id).toBe('version-1')
  })

  it('assembles the final send context shape with derived job and public version fields', () => {
    const context = buildEstimateCustomerSendContext({
      origin: 'https://example.test',
      resources: {
        ...baseResources,
        publicVersions: [
          { id: 'version-2', status: 'draft' },
          { id: 'version-1', status: 'sent', public_token: 'token-1' },
        ],
      },
      calculated: {
        quoteWallScopes: [{ id: 'wall-calculated' }],
        quoteCeilingScopes: [{ id: 'ceiling-calculated' }],
        quoteTrimScopes: [{ id: 'trim-calculated' }],
        pricingSummary: { finalTotal: 2500 },
      },
    })

    expect(context.job).toEqual({
      id: 'job-1',
      title: 'Kitchen',
      estimate_date: '2026-04-22',
      customer_name: 'Taylor',
      customer_email: 'taylor@example.com',
      customer_phone: '555-1212',
      customer_address: '123 Main',
    })
    expect(context.settings).toEqual({
      default_template_key: 'default',
      quote_validity_days: 90,
      terms_text: 'Standard terms',
      updated_at: null,
    })
    expect(context.inputs.room_wall_scopes).toEqual([{ id: 'wall-calculated' }])
    expect(context.inputs.room_ceiling_scopes).toEqual([{ id: 'ceiling-calculated' }])
    expect(context.inputs.room_trim_scopes).toEqual([{ id: 'trim-calculated' }])
    expect(context.pricing_summary).toEqual({ finalTotal: 2500 })
    expect(context.latest_draft_version?.id).toBe('version-2')
    expect(context.latest_sent_version?.id).toBe('version-1')
    expect(context.latest_public_version?.id).toBe('version-2')
    expect(context.public_url).toBe('https://example.test/quote/token-1')
  })
})
