import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import {
  buildPublicEstimateAcceptedCustomerEmail,
  buildPublicEstimateAcceptedInternalEmail,
  buildPublicEstimateDeclinedInternalEmail,
  sendPublicEstimateAcceptanceNotifications,
  sendPublicEstimateDeclineNotification,
} from '../publicEstimateNotifications.ts'

type SentMessage = {
  origin: string
  orgId: string
  userId: string
  to: string
  subject: string
  bodyText: string
  bodyHtml?: string
}

type TestRuntimeConfig = {
  orgEmail: () => string | Promise<string | null> | null
}

const sentMessages: SentMessage[] = []

const buildRuntime = (config: TestRuntimeConfig) => ({
  loadOrgInternalNotificationEmail: async () => config.orgEmail(),
  sendGmailMessage: async (message: SentMessage) => {
    sentMessages.push(message)
    return { messageId: 'gmail-1' }
  },
})

const document = {
  meta: {
    title: 'Kitchen Quote',
    version_name: 'Option A',
  },
  company: {
    business_name: 'ACE Painting',
    business_email: 'office@example.com',
  },
  customer: {
    name: 'Taylor Customer',
    email: 'taylor@example.com',
    address: '123 Main St',
  },
  total: 4250,
}

describe('public estimate notifications', () => {
  let orgEmail: () => string | Promise<string | null> | null

  beforeEach(() => {
    sentMessages.length = 0
    orgEmail = () => 'owner@example.com'
  })

  it('builds internal accepted and declined notification emails with audit context', () => {
    const accepted = buildPublicEstimateAcceptedInternalEmail({
      document,
      acceptedBy: 'Taylor Customer',
      acceptedAt: '2026-04-29T10:00:00.000Z',
      publicUrl: 'https://example.test/quote/token-1',
    })
    assert.ok(accepted)
    assert.equal(accepted.to, 'office@example.com')
    assert.equal(accepted.subject, 'Quote accepted: Kitchen Quote')
    assert.ok(accepted.bodyText.includes('Accepted by: Taylor Customer'))
    assert.ok(accepted.bodyHtml?.includes('View accepted quote'))

    const declined = buildPublicEstimateDeclinedInternalEmail({
      document,
      declinedAt: '2026-04-29T10:00:00.000Z',
      publicUrl: 'https://example.test/quote/token-1',
      reason: 'Going another direction',
    })
    assert.ok(declined)
    assert.equal(declined.to, 'office@example.com')
    assert.equal(declined.subject, 'Quote declined: Kitchen Quote')
    assert.ok(declined.bodyText.includes('Reason: Going another direction'))
    assert.ok(declined.bodyHtml?.includes('Quote declined'))
  })

  it('builds a customer confirmation email after acceptance', () => {
    const email = buildPublicEstimateAcceptedCustomerEmail({
      document,
      acceptedAt: '2026-04-29T10:00:00.000Z',
      publicUrl: 'https://example.test/quote/token-1',
    })
    assert.ok(email)
    assert.equal(email.to, 'taylor@example.com')
    assert.equal(email.subject, 'Quote accepted: Kitchen Quote')
    assert.ok(email.bodyText.includes("We'll contact you to schedule."))
    assert.ok(email.bodyHtml?.includes('View accepted quote'))
  })

  it('sends internal and customer acceptance notifications when sender credentials are available', async () => {
    const result = await sendPublicEstimateAcceptanceNotifications(
      {
        origin: 'https://example.test',
        orgId: 'org-1',
        userId: 'user-1',
        document,
        publicToken: 'token-1',
        acceptedBy: 'Taylor Customer',
        acceptedAt: '2026-04-29T10:00:00.000Z',
      },
      buildRuntime({ orgEmail })
    )

    assert.deepEqual(result, {
      internal: { messageId: 'gmail-1' },
      customer: { messageId: 'gmail-1' },
    })
    assert.equal(sentMessages.length, 2)
    assert.equal(sentMessages[0]?.to, 'owner@example.com')
    assert.equal(sentMessages[0]?.subject, 'Quote accepted: Kitchen Quote')
    assert.ok(sentMessages[0]?.bodyHtml?.includes('View accepted quote'))
    assert.equal(sentMessages[1]?.to, 'taylor@example.com')
    assert.equal(sentMessages[1]?.subject, 'Quote accepted: Kitchen Quote')
    assert.ok(sentMessages[1]?.bodyHtml?.includes('View accepted quote'))
  })

  it('falls back to the quote snapshot company email when the org has no work email', async () => {
    orgEmail = () => ''

    const result = await sendPublicEstimateAcceptanceNotifications(
      {
        origin: 'https://example.test',
        orgId: 'org-1',
        userId: 'user-1',
        document,
        publicToken: 'token-1',
        acceptedBy: 'Taylor Customer',
        acceptedAt: '2026-04-29T10:00:00.000Z',
      },
      buildRuntime({ orgEmail })
    )

    assert.deepEqual(result.internal, { messageId: 'gmail-1' })
    assert.deepEqual(result.customer, { messageId: 'gmail-1' })
    assert.equal(sentMessages.length, 2)
    assert.equal(sentMessages[0]?.to, 'office@example.com')
    assert.equal(sentMessages[0]?.subject, 'Quote accepted: Kitchen Quote')
  })

  it('sends only the internal declined notification', async () => {
    const result = await sendPublicEstimateDeclineNotification(
      {
        origin: 'https://example.test',
        orgId: 'org-1',
        userId: 'user-1',
        document,
        publicToken: 'token-1',
        declinedAt: '2026-04-29T10:00:00.000Z',
        reason: 'Going another direction',
      },
      buildRuntime({ orgEmail })
    )

    assert.deepEqual(result, { internal: { messageId: 'gmail-1' } })
    assert.equal(sentMessages.length, 1)
    assert.equal(sentMessages[0]?.to, 'owner@example.com')
    assert.equal(sentMessages[0]?.subject, 'Quote declined: Kitchen Quote')
    assert.ok(sentMessages[0]?.bodyHtml?.includes('Quote declined'))
  })

  it('skips notifications when the public version has no sender user', async () => {
    const result = await sendPublicEstimateAcceptanceNotifications(
      {
        origin: 'https://example.test',
        orgId: 'org-1',
        userId: '',
        document,
        publicToken: 'token-1',
        acceptedBy: 'Taylor Customer',
        acceptedAt: '2026-04-29T10:00:00.000Z',
      },
      buildRuntime({ orgEmail })
    )

    assert.deepEqual(result, {
      internal: { skipped: true, reason: 'missing_sender_user' },
      customer: { skipped: true, reason: 'missing_sender_user' },
    })
    assert.equal(sentMessages.length, 0)
  })
})
