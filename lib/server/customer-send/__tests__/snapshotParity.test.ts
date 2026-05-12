import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-role-key'

const state = vi.hoisted(() => ({
  store: null as ReturnType<
    typeof import('./customerSendContractHarness')['createPublicVersionStore']
  > | null,
}))

vi.mock('../repository', () => ({
  saveCustomerSendDraftVersion: vi.fn(async (params) => {
    if (!state.store) throw new Error('store not initialized')
    return { ok: true as const, data: state.store.persistDraft(params) }
  }),
  upgradeCustomerSendLegacyVersionSnapshot: vi.fn(async () => {
    throw new Error('legacy upgrade not expected in snapshot parity tests')
  }),
  writeEstimatePublicEvent: vi.fn(async () => ({ ok: true as const, data: null })),
}))

vi.mock('../delivery', () => ({
  submitCustomerSendMessage: vi.fn(async (params) => {
    if (!state.store) throw new Error('store not initialized')
    const sentVersion = state.store.markSent({
      version: params.version,
      publicToken: params.version.public_token ?? 'persisted-token',
      sentAt: '2026-05-07T18:00:00.000Z',
    })
    return {
      ok: true as const,
      data: {
        mode: params.mode,
        public_url: `https://example.test/quote/${sentVersion.public_token}`,
        version: sentVersion,
        document: sentVersion.snapshot_json?.document ?? null,
      },
    }
  }),
}))

vi.mock('../../accepted-estimates/service.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../accepted-estimates/service.ts')>()
  return {
    ...actual,
    applyAcceptedEstimateSideEffects: vi.fn(),
    ensureAcceptedEstimateOperationalSnapshot: vi.fn(),
  }
})

vi.mock('../../publicEstimateNotifications.ts', () => ({
  sendPublicEstimateAcceptanceNotifications: vi.fn(),
  sendPublicEstimateDeclineNotification: vi.fn(),
}))

vi.mock('../../org.ts', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table !== 'estimate_public_versions') {
        throw new Error(`Unexpected table ${table}`)
      }

      const selectFilters: Record<string, unknown> = {}
      const selectChain = {
        eq: vi.fn((column: string, value: unknown) => {
          selectFilters[column] = value
          return selectChain
        }),
        maybeSingle: vi.fn(async () => ({
          data:
            selectFilters.public_token && state.store
              ? state.store.getByToken(String(selectFilters.public_token))
              : state.store?.version ?? null,
          error: null,
        })),
      }

      const updateFilters: Record<string, unknown> = {}
      const updateChain = {
        eq: vi.fn((column: string, value: unknown) => {
          updateFilters[column] = value
          return updateChain
        }),
        in: vi.fn(() => updateChain),
        is: vi.fn(() => updateChain),
        select: vi.fn(() => updateChain),
        maybeSingle: vi.fn(async () => ({
          data:
            updateFilters.id && state.store
              ? state.store.markViewed('2026-05-07T18:05:00.000Z')
              : null,
          error: null,
        })),
      }

      return {
        select: vi.fn(() => selectChain),
        update: vi.fn(() => updateChain),
      }
    }),
  },
}))

import { loadAcceptedEstimateSource } from '../../accepted-estimates/service.ts'
import type { AcceptedEstimateOperationalSourcePayload } from '../../accepted-estimates/types.ts'
import { loadCustomerSendPageData, submitCustomerSendMutation } from '../service'
import {
  readCustomerSendVersionDocument,
  readCustomerSendVersionDraftInput,
} from '../types'
import {
  attachPersistedVersionToContext,
  buildCustomerSendContractContext,
  createPublicVersionStore,
} from './customerSendContractHarness'

const { loadPublicEstimatePortalSnapshot } = await import('../../estimatePublicPortal')

type MockQueryResponse = {
  data: Record<string, unknown> | null
  error: { message?: string } | null
}

function createAcceptedReadDb(responses: Record<string, MockQueryResponse>) {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const notFilters: Array<{ column: string; operator: string; value: unknown }> = []
      let orderBy: { column: string; ascending: boolean } | null = null
      let limit: number | null = null

      return {
        select() {
          return this
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return this
        },
        not(column: string, operator: string, value: unknown) {
          notFilters.push({ column, operator, value })
          return this
        },
        order(column: string, options?: { ascending?: boolean }) {
          orderBy = { column, ascending: options?.ascending ?? true }
          return this
        },
        limit(count: number) {
          limit = count
          return this
        },
        maybeSingle() {
          void filters
          void notFilters
          void orderBy
          void limit
          return Promise.resolve(responses[table] ?? { data: null, error: null })
        },
      }
    },
  }
}

function sendCopy() {
  return {
    sendNotice: 'Quote sent.',
    sendFailureMessage: 'Unable to send quote',
    lockFailureMessage: 'Unable to lock quote',
  }
}

function acceptedEstimateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'estimate-1',
    org_id: 'org-1',
    job_id: 'job-1',
    customer_id: 'customer-1',
    version_name: 'Kitchen Quote',
    version_state: 'live',
    accepted_at: '2026-05-07T18:00:00.000Z',
    accepted_public_version_id: 'public-version-1',
    ...overrides,
  }
}

function readCustomerArtifactOperationalPrejobRows(snapshotJson: Record<string, unknown>) {
  const operational = snapshotJson.operational_snapshot as
    | {
        estimate_response?: {
          inputs?: {
            prejob?: unknown[]
          }
        }
      }
    | undefined
  return operational?.estimate_response?.inputs?.prejob ?? []
}

function acceptedOperationalInputs(overrides: Record<string, unknown> = {}) {
  return {
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
    prejob: [],
    trim_items: [],
    other: [],
    jobsettings: {},
    org_defaults: {
      default_template_key: 'default',
      quote_validity_days: 30,
      terms_text: 'Standard quote terms.',
      walls_paint_id: null,
      walls_primer_id: null,
      ceiling_paint_id: null,
      ceiling_primer_id: null,
      trim_paint_id: null,
      trim_primer_id: null,
      labor_day_policy_enabled: true,
      dayhours: 8,
      rounding_increment_hours: 4,
      override_labor_rate: 0,
      job_minimum_enabled: false,
      job_minimum_amount: 0,
      standard_door_deduction_sf: 21,
      standard_window_deduction_sf: 15,
      baseboard_opening_deduction_lf: 3,
    },
    ...overrides,
  }
}

function acceptedOperationalPricing(finalTotal: number) {
  return {
    pricing_summary: { finalTotal },
    final_total: finalTotal,
    wall_calculations: { scopes: [] },
    ceiling_calculations: { scopes: [] },
    trim_calculations: { scopes: [] },
    door_calculations: { scopes: [] },
    drywall_calculations: { scopes: [] },
  }
}

function acceptedSnapshotRow(snapshotJson: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const prejob = readCustomerArtifactOperationalPrejobRows(snapshotJson)
  return {
    id: 'snapshot-1',
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_id: 'estimate-1',
    customer_id: 'customer-1',
    accepted_public_version_id: 'public-version-1',
    estimate_version_name: 'Kitchen Quote',
    estimate_version_state: 'live',
    estimated_labor_hours: 10,
    estimated_paint_gallons: 2,
    estimated_supplies_cost: 25,
    estimated_access_cost: 250,
    estimated_other_cost: 10,
    estimated_total: 4250,
    source_payload_json: {
      artifact_kind: 'accepted_estimate_operational_snapshot_source',
      artifact_version: 1,
      customer_artifact: snapshotJson,
      accepted_public_version: {
        id: 'public-version-1',
        version_number: 2,
        public_token: 'persisted-token',
        accepted_at: '2026-05-07T18:00:00.000Z',
        acceptance_json: {
          legal_name: 'Taylor Smith',
          signature_type: 'typed',
        },
      },
      internal_operational_estimate: {
        inputs: acceptedOperationalInputs({
          rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
          prejob,
        }),
        pricing: acceptedOperationalPricing(4250),
      },
    },
    ...overrides,
  }
}

describe('customer-send persisted artifact reader parity', () => {
  beforeEach(() => {
    state.store = createPublicVersionStore()
  })

  it('reads the same persisted sent artifact through storage helpers, the public portal, and the accepted downstream reader', async () => {
    const initialContext = buildCustomerSendContractContext()
    initialContext.inputs.prejob = [
      {
        id: 'prejob-canonical-1',
        room_id: 'room-1',
        include: 'Y',
        trip_name: 'Customer walkthrough prep',
        trip_num: 1,
        trip_rate: 225,
        manual_adjustment: 25,
        calculated_total: 225,
        raw_total: 250,
        effective_total: 250,
        final_total: 250,
        notes: 'Use the calculated row for accepted snapshots.',
      },
    ]

    const preview = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: initialContext,
    })

    expect(preview.ok).toBe(true)
    if (!preview.ok) throw new Error(preview.message)
    const persistedDraftVersion = state.store?.version
    expect(persistedDraftVersion).toBeTruthy()
    if (!persistedDraftVersion) throw new Error('persisted draft version missing')

    const sendResult = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'taylor@example.test',
        },
      },
      context: attachPersistedVersionToContext(initialContext, persistedDraftVersion),
      copy: sendCopy(),
    })

    expect(sendResult.ok).toBe(true)
    if (!sendResult.ok) throw new Error(sendResult.message)
    const sentVersion = state.store?.version
    expect(sentVersion).toBeTruthy()
    if (!sentVersion) throw new Error('sent version missing')

    const publicSnapshot = await loadPublicEstimatePortalSnapshot({
      token: String(sentVersion.public_token),
      origin: 'https://example.test',
      actorType: 'customer',
      metadata: { route: 'public-quote' },
    })

    expect(publicSnapshot.ok).toBe(true)
    if (!publicSnapshot.ok) throw new Error(publicSnapshot.message)

    const acceptedSource = await loadAcceptedEstimateSource(
      createAcceptedReadDb({
        jobs: {
          data: {
            id: 'job-1',
            linked_estimate_id: 'estimate-1',
          },
          error: null,
        },
        estimates: {
          data: acceptedEstimateRow(),
          error: null,
        },
        estimate_snapshot: {
          data: acceptedSnapshotRow(sentVersion.snapshot_json as Record<string, unknown>),
          error: null,
        },
      }) as never,
      'org-1',
      'job-1'
    )

    expect(acceptedSource.ok).toBe(true)
    if (!acceptedSource.ok) throw new Error(acceptedSource.message)
    expect(readCustomerSendVersionDocument(sentVersion)).toEqual(preview.data.document)
    expect(readCustomerSendVersionDocument(sentVersion)).toEqual(sendResult.data.document)
    expect(readCustomerSendVersionDraftInput(sentVersion)).toEqual(
      expect.objectContaining({
        to_email: 'taylor@example.test',
      })
    )
    expect(publicSnapshot.data.document).toEqual(sendResult.data.document)
    expect(sentVersion.snapshot_json?.operational_snapshot).toEqual(
      expect.objectContaining({
        artifact_kind: 'customer_send_operational_snapshot',
      })
    )
    expect(acceptedSource.data.snapshot_json).toEqual(sentVersion.snapshot_json)
    const customerArtifactPrejob = readCustomerArtifactOperationalPrejobRows(
      sentVersion.snapshot_json as Record<string, unknown>
    )
    const acceptedSourcePayload =
      acceptedSource.data.source_payload_json as AcceptedEstimateOperationalSourcePayload
    expect(
      acceptedSourcePayload.internal_operational_estimate.inputs.prejob
    ).toEqual(customerArtifactPrejob)
    expect(acceptedSource.data.operational_source.prejob).toEqual(customerArtifactPrejob)
  })

  it('keeps downstream accepted readers anchored to the accepted persisted artifact instead of mutable public-version rows', async () => {
    const preview = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: buildCustomerSendContractContext(),
    })

    expect(preview.ok).toBe(true)
    if (!preview.ok) throw new Error(preview.message)
    const acceptedArtifact = state.store?.version?.snapshot_json as Record<string, unknown>
    const mutatedPublicVersionArtifact = {
      document: {
        title: 'Mutated live public version title',
      },
      draft: {
        to_email: 'mutated@example.test',
      },
    }

    const result = await loadAcceptedEstimateSource(
      createAcceptedReadDb({
        jobs: {
          data: {
            id: 'job-1',
            linked_estimate_id: 'estimate-1',
          },
          error: null,
        },
        estimates: {
          data: acceptedEstimateRow(),
          error: null,
        },
        estimate_snapshot: {
          data: acceptedSnapshotRow(acceptedArtifact as Record<string, unknown>, {
            source_payload_json: {
              artifact_kind: 'accepted_estimate_operational_snapshot_source',
              artifact_version: 1,
              customer_artifact: acceptedArtifact,
              accepted_public_version: {
                id: 'public-version-1',
                version_number: 2,
                public_token: 'persisted-token',
                accepted_at: '2026-05-07T18:00:00.000Z',
                acceptance_json: {
                  legal_name: 'Taylor Smith',
                  signature_type: 'typed',
                },
                snapshot_json: mutatedPublicVersionArtifact,
              },
              internal_operational_estimate: {
                inputs: acceptedOperationalInputs({
                  rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
                }),
                pricing: acceptedOperationalPricing(4250),
              },
            },
          }),
          error: null,
        },
      }) as never,
      'org-1',
      'job-1'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(result.data.snapshot_json).toEqual(acceptedArtifact)
    expect(result.data.snapshot_json).not.toEqual(mutatedPublicVersionArtifact)
  })

  it('fails closed for accepted downstream readers when the accepted persisted artifact is missing or corrupt', async () => {
    const missingArtifact = await loadAcceptedEstimateSource(
      createAcceptedReadDb({
        jobs: {
          data: {
            id: 'job-1',
            linked_estimate_id: 'estimate-1',
          },
          error: null,
        },
        estimates: {
          data: acceptedEstimateRow(),
          error: null,
        },
        estimate_snapshot: {
          data: acceptedSnapshotRow({}, {
            source_payload_json: {
              accepted_public_version: {
                id: 'public-version-1',
                version_number: 2,
                public_token: 'persisted-token',
                accepted_at: '2026-05-07T18:00:00.000Z',
                acceptance_json: {
                  legal_name: 'Taylor Smith',
                  signature_type: 'typed',
                },
                snapshot_json: {
                  document: {
                    title: 'Mutable public version fallback',
                  },
                },
              },
              internal_operational_estimate: {
                inputs: acceptedOperationalInputs({
                  rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
                }),
                pricing: acceptedOperationalPricing(4250),
              },
            },
          }),
          error: null,
        },
      }) as never,
      'org-1',
      'job-1'
    )

    expect(missingArtifact).toEqual({
      ok: false,
      kind: 'invalid_input',
      message:
        'Accepted estimate snapshot customer artifact is missing. Repair the snapshot before loading accepted estimate data.',
    })

    const corruptArtifact = await loadAcceptedEstimateSource(
      createAcceptedReadDb({
        jobs: {
          data: {
            id: 'job-1',
            linked_estimate_id: 'estimate-1',
          },
          error: null,
        },
        estimates: {
          data: acceptedEstimateRow(),
          error: null,
        },
        estimate_snapshot: {
          data: acceptedSnapshotRow(
            {
              document: {
                title: 'Corrupt incomplete artifact',
              },
            },
            {}
          ),
          error: null,
        },
      }) as never,
      'org-1',
      'job-1'
    )

    expect(corruptArtifact).toEqual({
      ok: false,
      kind: 'invalid_input',
      message:
        'Accepted estimate snapshot customer artifact is unreadable. Repair the snapshot before loading accepted estimate data.',
    })
  })
})
