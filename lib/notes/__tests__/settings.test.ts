import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNotesSettingsDefaults } from '../settingsDefaults.ts'
import type { NotesSettingsRow } from '../types.ts'

function makeSettings(overrides: Partial<NotesSettingsRow> = {}): NotesSettingsRow {
  return {
    org_id: 'org-1',
    sender_user_id: null,
    daily_summary_email_to: null,
    daily_summary_time_local: '06:00',
    timezone: 'America/Chicago',
    show_upcoming_days: 3,
    last_daily_summary_attempted_on: null,
    last_daily_summary_sent_on: null,
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
    ...overrides,
  }
}

test('buildNotesSettingsDefaults normalizes timezone and clamps upcoming days', () => {
  const defaults = buildNotesSettingsDefaults({
    settings: makeSettings({
      timezone: 'Mars/Base',
      show_upcoming_days: 99,
    }),
    orgDefaults: {
      name: 'ACE CRM',
      timezone: 'America/Chicago',
      businessEmail: null,
    },
    fallbackUserId: 'user-1',
  })

  assert.equal(defaults.orgName, 'ACE CRM')
  assert.equal(defaults.timezone, 'America/Chicago')
  assert.equal(defaults.showUpcomingDays, 14)
})

test('buildNotesSettingsDefaults falls back and normalizes summary time', () => {
  const invalidTimeDefaults = buildNotesSettingsDefaults({
    settings: makeSettings({
      daily_summary_time_local: 'bad-value',
    }),
    orgDefaults: {
      name: 'ACE CRM',
      timezone: 'America/Chicago',
      businessEmail: null,
    },
    fallbackUserId: null,
  })

  const paddedTimeDefaults = buildNotesSettingsDefaults({
    settings: makeSettings({
      daily_summary_time_local: '07:05',
    }),
    orgDefaults: {
      name: 'ACE CRM',
      timezone: 'America/Chicago',
      businessEmail: null,
    },
    fallbackUserId: null,
  })

  assert.equal(invalidTimeDefaults.dailySummaryTimeLocal, '06:00')
  assert.equal(paddedTimeDefaults.dailySummaryTimeLocal, '07:05')
})

test('buildNotesSettingsDefaults preserves sender and email precedence', () => {
  const explicit = buildNotesSettingsDefaults({
    settings: makeSettings({
      daily_summary_email_to: 'owner@example.com',
      sender_user_id: 'user-explicit',
      show_upcoming_days: -5,
    }),
    orgDefaults: {
      name: 'ACE CRM',
      timezone: 'America/Chicago',
      businessEmail: 'org@example.com',
    },
    fallbackUserId: 'user-fallback',
  })

  const fallback = buildNotesSettingsDefaults({
    settings: makeSettings(),
    orgDefaults: {
      name: 'ACE CRM',
      timezone: 'America/Chicago',
      businessEmail: 'org@example.com',
    },
    fallbackUserId: 'user-fallback',
  })

  assert.equal(explicit.dailySummaryEmailTo, 'owner@example.com')
  assert.equal(explicit.senderUserId, 'user-explicit')
  assert.equal(explicit.showUpcomingDays, 0)
  assert.equal(fallback.dailySummaryEmailTo, 'org@example.com')
  assert.equal(fallback.senderUserId, 'user-fallback')
  assert.equal(fallback.showUpcomingDays, 3)
})
