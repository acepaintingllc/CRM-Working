import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCustomerSendPersistedSnapshot } from '../types'

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
  upgradeCustomerSendLegacyVersionSnapshot: vi.fn(async (params) => {
    if (!state.store) throw new Error('store not initialized')
    const upgraded = {
      ...params.version,
      draft_json: null,
      snapshot_json: buildCustomerSendPersistedSnapshot({
        document: params.document,
        draft: params.draft,
      }),
    }
    state.store.setVersion(upgraded)
    return { ok: true as const, data: upgraded }
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

import {
  loadCustomerSendPageData,
  saveCustomerSendDraftMutation,
  submitCustomerSendMutation,
} from '../service'
import { buildCustomerDocumentFromSendContext } from '../document'
import {
  attachPersistedVersionToContext,
  buildCustomerSendContractContext,
  createPublicVersionStore,
} from './customerSendContractHarness'

const { loadPublicEstimatePortalSnapshot } = await import('../../estimatePublicPortal')

function sendCopy() {
  return {
    sendNotice: 'Quote sent.',
    sendFailureMessage: 'Unable to send quote',
    lockFailureMessage: 'Unable to lock quote',
  }
}

function countEvents(type: string) {
  return state.store?.events.filter((event) => event.type === type).length ?? 0
}

function readOperationalSnapshotForTest(snapshot: unknown) {
  return snapshot as
    | {
        artifact_kind?: unknown
        estimate_response?: {
          wall_calculations?: {
            scopes?: unknown[]
          }
        }
      }
    | undefined
}

describe('customer-send canonical artifact parity', () => {
  beforeEach(() => {
    state.store = createPublicVersionStore()
  })

  it('persists one preview artifact, then reuses it unchanged across preview, send, and public render', async () => {
    const initialContext = buildCustomerSendContractContext()

    const preview1 = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: initialContext,
    })

    expect(preview1.ok).toBe(true)
    if (!preview1.ok) throw new Error(preview1.message)
    expect(countEvents('draft_saved')).toBe(1)

    const persistedVersion = state.store?.version
    expect(persistedVersion).toBeTruthy()
    if (!persistedVersion) throw new Error('preview version missing')
    const artifactA = persistedVersion.snapshot_json
    const operationalSnapshotA = readOperationalSnapshotForTest(
      artifactA?.operational_snapshot
    )
    expect(operationalSnapshotA).toEqual(
      expect.objectContaining({
        artifact_kind: 'customer_send_operational_snapshot',
      })
    )
    expect(
      operationalSnapshotA?.estimate_response?.wall_calculations?.scopes
    ).toHaveLength(1)
    expect(artifactA).toEqual(
      expect.objectContaining({
        artifact_kind: 'customer_estimate_artifact',
        artifact_version: 1,
        document: preview1.data.document,
      })
    )
    expect(preview1.data.version).toBeTruthy()
    if (!preview1.data.version) throw new Error('preview response version missing')
    expect(preview1.data.version.snapshot_json).toEqual(artifactA)
    const artifactADocument = artifactA?.document ?? null
    const artifactADocumentJson = JSON.stringify(artifactADocument)

    const preview2 = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: attachPersistedVersionToContext(initialContext, persistedVersion),
    })

    expect(preview2.ok).toBe(true)
    if (!preview2.ok) throw new Error(preview2.message)
    expect(countEvents('draft_saved')).toBe(1)
    expect(
      JSON.stringify(state.store?.version?.snapshot_json?.document ?? null)
    ).toBe(artifactADocumentJson)
    expect(preview2.data.version).toBeTruthy()
    if (!preview2.data.version) throw new Error('second preview response version missing')
    expect(preview2.data.version.snapshot_json).toEqual(artifactA)
    expect(preview2.data.document).toEqual(preview1.data.document)

    const saveResult = await saveCustomerSendDraftMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        draft: {
          subject: 'Saved subject copy only',
          body: 'Saved email body copy only',
        },
      },
      context: attachPersistedVersionToContext(initialContext, persistedVersion),
    })

    expect(saveResult.ok).toBe(true)
    if (!saveResult.ok) throw new Error(saveResult.message)
    expect(saveResult.data.document).toEqual(artifactADocument)
    expect(state.store?.version?.snapshot_json?.operational_snapshot).toEqual(
      operationalSnapshotA
    )
    expect(
      JSON.stringify(state.store?.version?.snapshot_json?.document ?? null)
    ).toBe(artifactADocumentJson)
    expect(state.store?.version?.snapshot_json).toEqual(
      expect.objectContaining({
        artifact_kind: 'customer_estimate_artifact',
        artifact_version: 1,
      })
    )

    const savedCopyVersion = state.store?.version
    expect(savedCopyVersion).toBeTruthy()
    if (!savedCopyVersion) throw new Error('saved copy version missing')

    const sendResult = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'taylor@example.test',
          subject: 'Updated subject only',
          body: 'Updated email body only',
        },
      },
      context: attachPersistedVersionToContext(initialContext, savedCopyVersion),
      copy: sendCopy(),
    })

    expect(sendResult.ok).toBe(true)
    if (!sendResult.ok) throw new Error(sendResult.message)
    expect(state.store?.version?.snapshot_json?.operational_snapshot).toEqual(
      operationalSnapshotA
    )
    expect(
      JSON.stringify(state.store?.version?.snapshot_json?.document ?? null)
    ).toBe(artifactADocumentJson)

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
    expect(sendResult.data.document).toEqual(preview1.data.document)
    expect(publicSnapshot.data.document).toEqual(preview1.data.document)
    expect(publicSnapshot.data.document).toEqual(artifactADocument)
    expect(sentVersion.snapshot_json?.operational_snapshot).toEqual(operationalSnapshotA)
  })

  it('keeps customer-visible output stable after mutable estimate/default/catalog drift', async () => {
    const initialContext = buildCustomerSendContractContext()

    const preview = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: initialContext,
    })

    expect(preview.ok).toBe(true)
    if (!preview.ok) throw new Error(preview.message)
    const persistedVersion = state.store?.version
    expect(persistedVersion).toBeTruthy()
    if (!persistedVersion) throw new Error('preview version missing')

    const driftedContext = attachPersistedVersionToContext(
      {
        ...buildCustomerSendContractContext({
          company: {
            ...initialContext.company,
            business_name: 'Drifted Company Name',
            business_email: 'changed@example.test',
          },
          settings: {
            ...initialContext.settings,
            terms_text: 'Drifted terms text',
            quote_validity_days: 7,
          },
          pricing_summary: {
            finalTotal: 999999,
          },
          estimate: {
            ...initialContext.estimate,
            version_name: 'Drifted Estimate Name',
          },
        }),
      },
      persistedVersion
    )

    const previewAfterDrift = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: driftedContext,
    })

    expect(previewAfterDrift.ok).toBe(true)
    if (!previewAfterDrift.ok) throw new Error(previewAfterDrift.message)
    expect(previewAfterDrift.data.document).toEqual(preview.data.document)

    const saveResult = await saveCustomerSendDraftMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        draft: {
          subject: 'Subject drift only',
          body: 'Body drift only',
        },
      },
      context: driftedContext,
    })

    expect(saveResult.ok).toBe(true)
    if (!saveResult.ok) throw new Error(saveResult.message)
    expect(saveResult.data.document).toEqual(preview.data.document)

    const sentResult = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'taylor@example.test',
          subject: 'Subject drift only',
          body: 'Body drift only',
        },
      },
      context: driftedContext,
      copy: sendCopy(),
    })

    expect(sentResult.ok).toBe(true)
    if (!sentResult.ok) throw new Error(sentResult.message)

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
    expect(sentResult.data.document).toEqual(preview.data.document)
    expect(publicSnapshot.data.document).toEqual(preview.data.document)
    expect(publicSnapshot.data.document.total).toBe(4250)
    expect(publicSnapshot.data.document.meta.title).toBe('Kitchen Quote')
  })

  it('rejects direct send document edits and does not replace the persisted preview artifact', async () => {
    const initialContext = buildCustomerSendContractContext()

    const preview = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: initialContext,
    })

    expect(preview.ok).toBe(true)
    if (!preview.ok) throw new Error(preview.message)
    const persistedVersion = state.store?.version
    expect(persistedVersion).toBeTruthy()
    if (!persistedVersion) throw new Error('preview version missing')

    const artifactDocumentJson = JSON.stringify(persistedVersion.snapshot_json?.document ?? null)
    const draftSavedCount = countEvents('draft_saved')

    const result = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'taylor@example.test',
          title: 'Changed title from direct POST',
          quote_validity_days: 7,
          scope_text_edits: {
            walls: 'Changed wall scope wording from direct POST.',
          },
        },
      },
      context: attachPersistedVersionToContext(initialContext, persistedVersion),
      copy: sendCopy(),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message:
        'Save draft before sending. Document-impacting send fields differ from the persisted preview artifact.',
    })
    expect(countEvents('draft_saved')).toBe(draftSavedCount)
    expect(countEvents('sent')).toBe(0)
    expect(JSON.stringify(state.store?.version?.snapshot_json?.document ?? null)).toBe(
      artifactDocumentJson
    )
  })

  it('saves and sends delivery-only changes without live recalculation when a preview artifact exists', async () => {
    const initialContext = buildCustomerSendContractContext()

    const preview = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: initialContext,
    })

    expect(preview.ok).toBe(true)
    if (!preview.ok) throw new Error(preview.message)
    const persistedVersion = state.store?.version
    expect(persistedVersion).toBeTruthy()
    if (!persistedVersion) throw new Error('preview version missing')
    const operationalSnapshot = readOperationalSnapshotForTest(
      persistedVersion.snapshot_json?.operational_snapshot
    )
    expect(operationalSnapshot?.estimate_response?.wall_calculations?.scopes).toHaveLength(1)

    const artifactDocumentJson = JSON.stringify(persistedVersion.snapshot_json?.document ?? null)
    const blockedContext = attachPersistedVersionToContext(
      {
        ...initialContext,
        artifact_generation_blocked_reason:
          'Unable to load canonical estimate calculations for customer send: live recalculation failed',
      },
      persistedVersion
    )

    const saveResult = await saveCustomerSendDraftMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        draft: {
          subject: 'Delivery subject only',
          body: 'Delivery body only',
        },
      },
      context: blockedContext,
    })

    expect(saveResult.ok).toBe(true)
    if (!saveResult.ok) throw new Error(saveResult.message)
    expect(JSON.stringify(state.store?.version?.snapshot_json?.document ?? null)).toBe(
      artifactDocumentJson
    )

    const savedVersion = state.store?.version
    expect(savedVersion).toBeTruthy()
    if (!savedVersion) throw new Error('saved version missing')

    const sendResult = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'taylor@example.test',
          cc_email: 'office@example.test',
          subject: 'Send subject only',
          body: 'Send body only',
        },
      },
      context: attachPersistedVersionToContext(blockedContext, savedVersion),
      copy: sendCopy(),
    })

    expect(sendResult.ok).toBe(true)
    if (!sendResult.ok) throw new Error(sendResult.message)
    expect(state.store?.version?.snapshot_json?.operational_snapshot).toEqual(
      operationalSnapshot
    )
    expect(JSON.stringify(state.store?.version?.snapshot_json?.document ?? null)).toBe(
      artifactDocumentJson
    )
    expect(sendResult.data.document).toEqual(preview.data.document)
  })

  it('fails closed when a persisted preview artifact is corrupt and does not replace it', async () => {
    const corruptVersion = {
      id: 'draft-1',
      status: 'draft',
      version_number: 2,
      public_token: 'live-token',
      draft_json: {
        to_email: 'customer@example.com',
      },
      snapshot_json: {},
    }
    state.store = createPublicVersionStore(corruptVersion as never)

    const result = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: attachPersistedVersionToContext(
        buildCustomerSendContractContext(),
        corruptVersion as never
      ),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Customer send preview snapshot is unreadable',
    })
    expect(JSON.stringify(state.store?.version ?? null)).toBe(JSON.stringify(corruptVersion))
    expect(countEvents('draft_saved')).toBe(0)
  })

  it('rejects a nonzero customer artifact when the reused operational snapshot is empty against saved scopes', async () => {
    const context = buildCustomerSendContractContext()
    const badVersion = {
      id: 'draft-1',
      status: 'draft',
      version_number: 2,
      public_token: null,
      draft_json: null,
      snapshot_json: buildCustomerSendPersistedSnapshot({
        document: buildCustomerDocumentFromSendContext({
          context,
          overrides: {
            title: 'Kitchen Quote',
            quote_validity_days: 30,
          },
        }),
        draft: {
          to_email: 'taylor@example.test',
          cc_email: '',
          bcc_email: '',
          subject: 'Quote ready',
          body: '',
          template_key: 'default',
          title: 'Kitchen Quote',
          intro_paragraph: '',
          closing_paragraph: '',
          terms_text: 'Standard quote terms.',
          scope_text_edits: {},
          quote_validity_days: 30,
          deposit_language: '',
          card_fee_note: '',
        },
        operationalSnapshot: {
          artifact_kind: 'customer_send_operational_snapshot',
          artifact_version: 1,
          source_estimate_updated_at: context.estimate.updated_at,
          estimate_response: {
            estimate: context.estimate,
            inputs: { rooms: [] },
            wall_calculations: { scopes: [] },
            ceiling_calculations: { scopes: [] },
            trim_calculations: { scopes: [] },
            pricing_summary: {
              finalTotal: 4250,
              effectiveLaborHours: 0,
              rawLaborHours: 0,
              paintMaterialCost: 0,
              supplyCost: 0,
            },
          },
        },
      }),
    }
    state.store = createPublicVersionStore(badVersion as never)

    const result = await saveCustomerSendDraftMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        draft: {
          subject: 'Delivery subject only',
        },
      },
      context: attachPersistedVersionToContext(context, badVersion as never),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message:
        'Cannot generate public quote version because the operational estimate snapshot is empty while saved estimate rooms or scopes exist. Save or reload the quote and try again.',
    })
    expect(countEvents('draft_saved')).toBe(0)
  })

  it('upgrades a legacy snapshot once and then reuses the canonical artifact without regenerating on read', async () => {
    const context = buildCustomerSendContractContext()
    const legacyVersion = {
      id: 'draft-1',
      status: 'draft',
      version_number: 2,
      public_token: 'legacy-token',
      draft_json: {
        to_email: 'taylor@example.test',
        cc_email: '',
        bcc_email: '',
        subject: 'Legacy subject',
        body: '',
        template_key: 'default',
        title: 'Kitchen Quote',
        intro_paragraph: '',
        closing_paragraph: '',
        terms_text: 'Standard quote terms.',
        scope_text_edits: {},
        quote_validity_days: 30,
        deposit_language: 'Deposit due on acceptance.',
        card_fee_note: 'Card fee may apply.',
      },
      snapshot_json: {
        meta: {
          estimate_id: 'estimate-1',
          version_name: 'Kitchen Quote',
          version_state: 'draft',
          flow_version: 'v2',
          title: 'Kitchen Quote',
          quote_date: '2026-05-01',
          sent_at: null,
          viewed_at: null,
          accepted_at: null,
          declined_at: null,
          status: 'draft',
          public_token: null,
        },
      },
    }
    state.store = createPublicVersionStore(legacyVersion as never)

    const preview1 = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: attachPersistedVersionToContext(context, legacyVersion as never),
    })

    expect(preview1.ok).toBe(true)
    if (!preview1.ok) throw new Error(preview1.message)
    const upgradedVersion = state.store?.version
    expect(upgradedVersion?.snapshot_json).toHaveProperty('document')
    expect(upgradedVersion?.snapshot_json).toHaveProperty('draft')
    expect(upgradedVersion?.draft_json).toBeNull()

    const preview2 = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: attachPersistedVersionToContext(context, upgradedVersion ?? null),
    })

    expect(preview2.ok).toBe(true)
    if (!preview2.ok) throw new Error(preview2.message)
    expect(preview2.data.document).toEqual(preview1.data.document)
    expect(countEvents('draft_saved')).toBe(0)
  })
})
