import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEstimatePublicTimelineEvents } from '../publicTimeline.ts'

test('buildEstimatePublicTimelineEvents maps sent, resend, viewed, and accepted events', () => {
  const events = buildEstimatePublicTimelineEvents({
    versions: [
      {
        id: 'public-version-1',
        estimate_id: 'estimate-1',
        version_number: 2,
        public_token: 'token-1',
      },
    ],
    publicEvents: [
      {
        id: 'event-sent-1',
        estimate_public_version_id: 'public-version-1',
        event_type: 'sent',
        actor_type: 'staff',
        metadata: { publicUrl: 'https://example.test/quote/token-1' },
        created_at: '2026-04-21T10:00:00.000Z',
        created_by: 'staff-1',
      },
      {
        id: 'event-sent-2',
        estimate_public_version_id: 'public-version-1',
        event_type: 'sent',
        actor_type: 'staff',
        metadata: { publicUrl: 'https://example.test/quote/token-1' },
        created_at: '2026-04-22T10:00:00.000Z',
        created_by: 'staff-1',
      },
      {
        id: 'event-viewed',
        estimate_public_version_id: 'public-version-1',
        event_type: 'viewed',
        actor_type: 'customer',
        metadata: {},
        created_at: '2026-04-22T11:00:00.000Z',
        created_by: null,
      },
      {
        id: 'event-accepted',
        estimate_public_version_id: 'public-version-1',
        event_type: 'accepted',
        actor_type: 'customer',
        metadata: {},
        created_at: '2026-04-22T12:00:00.000Z',
        created_by: null,
      },
    ],
  })

  assert.deepEqual(
    events.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      link_path: event.link_path,
      link_label: event.link_label,
    })),
    [
      {
        id: 'quote-event-event-accepted',
        type: 'quote_accepted',
        title: 'Quote accepted',
        link_path: 'https://example.test/quote/token-1',
        link_label: 'Open quote',
      },
      {
        id: 'quote-event-event-viewed',
        type: 'quote_viewed',
        title: 'Quote viewed',
        link_path: 'https://example.test/quote/token-1',
        link_label: 'Open quote',
      },
      {
        id: 'quote-event-event-sent-2',
        type: 'quote_resent',
        title: 'Quote resent',
        link_path: 'https://example.test/quote/token-1',
        link_label: 'Open quote',
      },
      {
        id: 'quote-event-event-sent-1',
        type: 'quote_sent',
        title: 'Quote sent',
        link_path: 'https://example.test/quote/token-1',
        link_label: 'Open quote',
      },
    ]
  )
})

test('buildEstimatePublicTimelineEvents falls back to accepted public version state when accepted event is missing', () => {
  const events = buildEstimatePublicTimelineEvents({
    versions: [
      {
        id: 'public-version-1',
        estimate_id: 'estimate-1',
        version_number: 2,
        public_token: 'token-1',
        status: 'accepted',
        accepted_at: '2026-04-22T12:00:00.000Z',
      },
    ],
    publicEvents: [
      {
        id: 'event-viewed',
        estimate_public_version_id: 'public-version-1',
        event_type: 'viewed',
        actor_type: 'customer',
        metadata: {},
        created_at: '2026-04-22T11:00:00.000Z',
        created_by: null,
      },
    ],
  })

  assert.deepEqual(
    events.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      created_at: event.created_at,
      link_path: event.link_path,
    })),
    [
      {
        id: 'quote-event-accepted-public-version-1',
        type: 'quote_accepted',
        title: 'Quote accepted',
        created_at: '2026-04-22T12:00:00.000Z',
        link_path: '/quote/token-1',
      },
      {
        id: 'quote-event-event-viewed',
        type: 'quote_viewed',
        title: 'Quote viewed',
        created_at: '2026-04-22T11:00:00.000Z',
        link_path: '/quote/token-1',
      },
    ]
  )
})
