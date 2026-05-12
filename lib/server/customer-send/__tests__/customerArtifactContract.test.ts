import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import type { EstimateV2GetResponse } from '@/types/estimator/v2'
import { buildEstimatePublicSnapshotFromVersion } from '@/lib/customer-estimates/publicSnapshot'
import { appendCustomerSendPersistedPdf } from '../types'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-role-key'

const state = vi.hoisted(() => ({
  store: null as ReturnType<
    typeof import('./customerSendContractHarness')['createPublicVersionStore']
  > | null,
  failOnDocumentBuild: false,
  pdfDocuments: [] as unknown[],
  gmailAttachments: [] as unknown[],
  publicEvents: [] as Array<Record<string, unknown>>,
}))

vi.mock('../document', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../document')>()
  return {
    ...actual,
    buildCustomerSendDocument: vi.fn((params) => {
      if (state.failOnDocumentBuild) {
        throw new Error('customer-visible document was rebuilt after canonical artifact existed')
      }

      return actual.buildCustomerSendDocument(params)
    }),
  }
})

vi.mock('../pdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pdf')>()
  return {
    ...actual,
    buildCustomerSendPdfAttachment: vi.fn((document: CustomerEstimateDocument) => {
      state.pdfDocuments.push(JSON.parse(JSON.stringify(document)))
      return actual.buildCustomerSendPdfAttachment(document)
    }),
  }
})

vi.mock('../repository', () => ({
  saveCustomerSendDraftVersion: vi.fn(async (params) => {
    if (!state.store) throw new Error('store not initialized')
    return { ok: true as const, data: state.store.persistDraft(params) }
  }),
  upgradeCustomerSendLegacyVersionSnapshot: vi.fn(async () => {
    throw new Error('legacy upgrade not expected in end-to-end artifact contract')
  }),
  appendEstimatePublicVersionPdf: vi.fn(async (params) => {
    if (!state.store) throw new Error('store not initialized')
    const document = params.version.snapshot_json?.document
    if (!document) throw new Error('pdf append requires a persisted document')
    const updatedVersion = {
      ...params.version,
      snapshot_json: appendCustomerSendPersistedPdf({
        snapshot: params.version.snapshot_json,
        document,
        pdf: params.pdf,
      }),
    }
    state.store.setVersion(updatedVersion)
    return { ok: true as const, data: updatedVersion }
  }),
  markEstimatePublicVersionSent: vi.fn(async (params) => {
    if (!state.store) throw new Error('store not initialized')
    const current = state.store.getById(params.versionId)
    if (!current) {
      return {
        ok: false as const,
        kind: 'server_error' as const,
        message: params.lockFailureMessage,
      }
    }
    return {
      ok: true as const,
      data: state.store.markSent({
        version: current,
        publicToken: params.publicToken,
        sentAt: params.sentAt,
      }),
    }
  }),
  supersedeOlderPublicEstimateVersions: vi.fn(async () => ({ ok: true as const, data: null })),
  writeEstimatePublicEvent: vi.fn(async (event) => {
    state.publicEvents.push(JSON.parse(JSON.stringify(event)))
    return { ok: true as const, data: null }
  }),
}))

vi.mock('@/lib/server/googleDrive', () => ({
  uploadDriveFile: vi.fn(async (params) => ({
    file: {
      id: 'drive-pdf-1',
      name: params.name,
      webViewLink: 'https://drive.example.test/drive-pdf-1',
    },
  })),
}))

vi.mock('@/lib/server/googleMail', () => ({
  sendGmailMessage: vi.fn(async (params) => {
    state.gmailAttachments.push(JSON.parse(JSON.stringify(params.attachment ?? null)))
    return { id: 'gmail-message-1' }
  }),
}))

vi.mock('../../accepted-estimates/service.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../accepted-estimates/service.ts')>()
  return {
    ...actual,
    applyAcceptedEstimateSideEffects: vi.fn(async () => ({ ok: true, data: null })),
    ensureAcceptedEstimateOperationalSnapshot: vi.fn(async () => ({
      ok: true,
      data: { id: 'snapshot-accepted-1' },
    })),
  }
})

vi.mock('../../publicEstimateNotifications.ts', () => ({
  sendPublicEstimateAcceptanceNotifications: vi.fn(async () => ({
    internal: { messageId: 'internal-1' },
    customer: { messageId: 'customer-1' },
  })),
  sendPublicEstimateDeclineNotification: vi.fn(),
}))

vi.mock('../../org.ts', () => ({
  supabaseAdmin: {
    from(table: string) {
      if (table === 'estimate_public_versions') {
        return createPublicVersionTable()
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: {
                id: 'estimate-1',
                job_id: 'job-1',
                accepted_at: null,
                accepted_public_version_id: null,
              },
              error: null,
            })
          ),
        }
      }
      if (table === 'estimate_public_events') {
        return {
          select: vi.fn(() => createMaybeSingleChain({ data: null, error: null })),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  },
}))

import { loadAcceptedEstimateSource } from '../../accepted-estimates/service.ts'
import type { AcceptedEstimateOperationalSourcePayload } from '../../accepted-estimates/types.ts'
import { acceptPublicEstimate, loadPublicEstimatePortalSnapshot } from '../../estimatePublicPortal'
import { buildEstimateSnapshotRows } from '../../estimate-feedback/snapshots.ts'
import {
  loadCustomerSendPageData,
  saveCustomerSendDraftMutation,
  submitCustomerSendMutation,
} from '../service'
import {
  attachPersistedVersionToContext,
  buildCustomerSendContractContext,
  createPublicVersionStore,
} from './customerSendContractHarness'

type QueryResult = {
  data: Record<string, unknown> | null
  error: { message?: string } | null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createMaybeSingleChain(result: QueryResult) {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  }
  return chain
}

function createPublicVersionTable() {
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
  let updatePayload: Record<string, unknown> = {}
  const updateChain = {
    eq: vi.fn((column: string, value: unknown) => {
      updateFilters[column] = value
      return updateChain
    }),
    in: vi.fn(() => updateChain),
    is: vi.fn(() => updateChain),
    select: vi.fn(() => updateChain),
    maybeSingle: vi.fn(async () => {
      const current =
        updateFilters.id && state.store
          ? state.store.getById(String(updateFilters.id))
          : state.store?.version
      if (!current || !state.store) return { data: null, error: null }
      const updated = state.store.setVersion({
        ...current,
        ...updatePayload,
      })
      return { data: updated, error: null }
    }),
  }

  return {
    select: vi.fn(() => selectChain),
    update: vi.fn((payload: Record<string, unknown>) => {
      updatePayload = payload
      return updateChain
    }),
  }
}

function createAcceptedReadDb(responses: Record<string, QueryResult>) {
  return {
    from(table: string) {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        not() {
          return this
        },
        order() {
          return this
        },
        limit() {
          return this
        },
        maybeSingle() {
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

function estimateResponse(overrides: Partial<EstimateV2GetResponse> = {}) {
  return {
    estimate: {
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Drifted Live Estimate',
      version_state: 'live',
      version_kind: 'base',
      setting_set_id_used: 'setting-set-drifted',
    },
    inputs: {
      jobsettings: { override_labor_rate: 999 },
      org_defaults: { override_labor_rate: 999 },
      paint_products: [],
      rooms: [{ id: 'room-row-1', room_id: 'R001', room_name: 'Kitchen' }],
      room_wall_scopes: [],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [],
      ceiling_scope_segments: [],
      room_trim_scopes: [],
      room_door_scopes: [],
      drywall_repairs: [],
      rollers: [],
      prejob: [],
      trim_items: [],
      job_colors: [],
      room_flags: [],
      access_fees: [],
      other: [],
    },
    wall_calculations: { scopes: [] },
    ceiling_calculations: { scopes: [] },
    trim_calculations: { scopes: [] },
    door_calculations: { scopes: [] },
    drywall_calculations: { scopes: [] },
    trim_paint: null,
    pricing_summary: {
      effectiveLaborHours: 999,
      paintMaterialCost: 999,
      primerMaterialCost: 999,
      supplyCost: 999,
      sharedAccessCost: 999,
      finalTotal: 999_999,
    },
    ...overrides,
  } as unknown as EstimateV2GetResponse
}

describe('customer artifact end-to-end parity contract', () => {
  beforeEach(() => {
    process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID = 'drive-folder-1'
    state.store = createPublicVersionStore()
    state.failOnDocumentBuild = false
    state.pdfDocuments = []
    state.gmailAttachments = []
    state.publicEvents = []
  })

  it('keeps one canonical customer artifact from preview through save, send, public render, PDF, acceptance, and accepted operations', async () => {
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
    const previewVersion = state.store?.version
    expect(previewVersion).toBeTruthy()
    if (!previewVersion) throw new Error('preview version missing')

    const previewSnapshot = previewVersion.snapshot_json
    if (!previewSnapshot?.document) throw new Error('preview artifact document missing')
    const previewArtifact = clone(previewSnapshot)
    const previewDocument = clone(previewSnapshot.document) as CustomerEstimateDocument
    expect(previewDocument).toEqual(preview.data.document)

    state.failOnDocumentBuild = true
    const driftedContext = attachPersistedVersionToContext(
      {
        ...buildCustomerSendContractContext({
          company: {
            ...initialContext.company,
            business_name: 'Drifted Company Name',
            business_email: 'drifted@example.test',
          },
          settings: {
            ...initialContext.settings,
            terms_text: 'Drifted terms text',
            quote_validity_days: 3,
          },
          pricing_summary: {
            finalTotal: 999_999,
          },
          estimate: {
            ...initialContext.estimate,
            version_name: 'Drifted Live Estimate Name',
          },
        }),
        artifact_generation_blocked_reason:
          'Live recalculation is intentionally unavailable after preview exists',
      },
      previewVersion
    )

    const saveDeliveryOnly = await saveCustomerSendDraftMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        draft: {
          subject: 'Delivery subject only',
          body: 'Delivery email body only',
        },
      },
      context: driftedContext,
    })

    expect(saveDeliveryOnly.ok).toBe(true)
    if (!saveDeliveryOnly.ok) throw new Error(saveDeliveryOnly.message)
    expect(state.store?.version?.snapshot_json?.document).toEqual(previewDocument)

    const savedVersion = state.store?.version
    expect(savedVersion).toBeTruthy()
    if (!savedVersion) throw new Error('saved delivery-only version missing')

    const directDocumentEditSend = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'taylor@example.test',
          title: 'Direct POST changed title',
          quote_validity_days: 7,
          scope_text_edits: {
            walls: 'Direct POST changed scope wording.',
          },
        },
      },
      context: attachPersistedVersionToContext(driftedContext, savedVersion),
      copy: sendCopy(),
    })

    expect(directDocumentEditSend).toEqual({
      ok: false,
      kind: 'invalid_input',
      message:
        'Save draft before sending. Document-impacting send fields differ from the persisted preview artifact.',
    })
    expect(state.store?.version?.snapshot_json?.document).toEqual(previewDocument)

    const validSend = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'taylor@example.test',
          cc_email: 'office@example.test',
          subject: 'Final delivery subject only',
          body: 'Final delivery body only',
        },
      },
      context: attachPersistedVersionToContext(driftedContext, savedVersion),
      copy: sendCopy(),
    })

    expect(validSend.ok).toBe(true)
    if (!validSend.ok) throw new Error(validSend.message)
    expect(validSend.data.document).toEqual(previewDocument)
    expect(state.pdfDocuments).toEqual([previewDocument])
    expect(state.gmailAttachments).toHaveLength(1)

    const sentVersion = state.store?.version
    expect(sentVersion).toBeTruthy()
    if (!sentVersion) throw new Error('sent version missing')
    expect(sentVersion.snapshot_json?.document).toEqual(previewDocument)
    expect(sentVersion.snapshot_json?.pdf).toEqual(
      expect.objectContaining({
        drive_file_id: 'drive-pdf-1',
        mime_type: 'application/pdf',
      })
    )

    const publicApiSnapshot = await import(
      '@/app/api/quote-public/[token]/route'
    ).then(({ GET }) =>
      GET(new Request('https://example.test/api/quote-public/persisted-token'), {
        params: { token: String(sentVersion.public_token) },
      })
    )
    const publicApiBody = await publicApiSnapshot.json()
    expect(publicApiBody.data.document).toEqual(previewDocument)

    const publicPageSnapshot = await loadPublicEstimatePortalSnapshot({
      token: String(sentVersion.public_token),
      origin: 'https://example.test',
      actorType: 'customer',
      metadata: { route: 'public-page' },
    })
    expect(publicPageSnapshot.ok).toBe(true)
    if (!publicPageSnapshot.ok) throw new Error(publicPageSnapshot.message)
    expect(publicPageSnapshot.data.document).toEqual(previewDocument)

    const publicSnapshotFromVersion = buildEstimatePublicSnapshotFromVersion({
      version: state.store?.version ?? {},
      origin: 'https://example.test',
    })
    expect('error' in publicSnapshotFromVersion).toBe(false)
    if ('error' in publicSnapshotFromVersion) {
      throw new Error(publicSnapshotFromVersion.error)
    }
    expect(publicSnapshotFromVersion.document).toEqual(previewDocument)

    const accepted = await acceptPublicEstimate({
      token: String(sentVersion.public_token),
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      origin: 'https://example.test',
      userAgent: 'Vitest',
      ip: '127.0.0.1',
    })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) throw new Error(accepted.message)
    expect(accepted.data.document).toEqual(previewDocument)

    const acceptedVersion = state.store?.version
    expect(acceptedVersion).toBeTruthy()
    if (!acceptedVersion) throw new Error('accepted version missing')
    expect(acceptedVersion.status).toBe('accepted')
    expect(acceptedVersion.snapshot_json?.document).toEqual(previewDocument)

    const acceptedEstimateResponse = estimateResponse()
    acceptedEstimateResponse.inputs.access_fees = [
      {
        id: 'access-calculated-1',
        room_id: null,
        access_fee_id: 'catalog-scaffold',
        label: 'Calculated scaffold setup',
        access_group: 'scaffolding',
        qty: 1,
        catalog_amount: 300,
        calculated_total: 300,
        effective_total: 300,
        final_total: 300,
        override_total: null,
        overridden: false,
        notes: 'Calculated access row.',
        position: 0,
      },
    ]
    acceptedEstimateResponse.inputs.prejob = [
      {
        id: 'prejob-calculated-1',
        room_id: 'R001',
        include: 'Y',
        trip_name: 'Calculated wallpaper prep',
        trip_num: 1,
        trip_rate: 225,
        manual_adjustment: 25,
        calculated_total: 225,
        raw_total: 250,
        effective_total: 250,
        final_total: 250,
        notes: 'Calculated prejob row.',
      },
    ]

    const acceptedOperationalSnapshot = buildEstimateSnapshotRows({
      orgId: 'org-1',
      estimateResponse: acceptedEstimateResponse,
      job: { id: 'job-1', customer_id: 'customer-1', linked_estimate_id: 'estimate-1' },
      publicVersion: acceptedVersion as Record<string, unknown>,
      createdBy: 'user-1',
    })
    expect(acceptedOperationalSnapshot.snapshot.estimated_total).toBe(
      previewDocument.total
    )
    expect(
      acceptedOperationalSnapshot.snapshot.source_payload_json.customer_artifact
    ).toEqual(acceptedVersion.snapshot_json)
    const acceptedSourcePayload = acceptedOperationalSnapshot.snapshot
      .source_payload_json as AcceptedEstimateOperationalSourcePayload
    expect(acceptedSourcePayload).toEqual(
      expect.objectContaining({
        artifact_kind: 'accepted_estimate_operational_snapshot_source',
        artifact_version: 1,
        customer_visible_source: 'customer_artifact.document',
      })
    )
    expect(
      (acceptedSourcePayload.accepted_public_version as Record<string, unknown>).snapshot_json
    ).toEqual(acceptedVersion.snapshot_json)
    expect(
      acceptedSourcePayload.internal_operational_estimate.inputs.access_fees
    ).toEqual(acceptedEstimateResponse.inputs.access_fees)
    expect(
      acceptedSourcePayload.internal_operational_estimate.inputs.prejob
    ).toEqual(acceptedEstimateResponse.inputs.prejob)
    expect(
      acceptedSourcePayload.internal_operational_estimate.pricing.final_total
    ).toBe(999_999)
    expect(
      acceptedSourcePayload.internal_operational_estimate.pricing.wall_calculations
    ).toEqual(acceptedEstimateResponse.wall_calculations)
    expect(
      (
        acceptedOperationalSnapshot.snapshot.totals_json as {
          internal_operational_pricing_summary: { final_total: number }
        }
      ).internal_operational_pricing_summary.final_total
    ).toBe(999_999)

    const acceptedReader = await loadAcceptedEstimateSource(
      createAcceptedReadDb({
        jobs: {
          data: {
            id: 'job-1',
            linked_estimate_id: 'estimate-1',
          },
          error: null,
        },
        estimates: {
          data: {
            id: 'estimate-1',
            org_id: 'org-1',
            job_id: 'job-1',
            customer_id: 'customer-1',
            version_name: 'Drifted Live Estimate',
            version_state: 'live',
            accepted_at: acceptedVersion.accepted_at,
            accepted_public_version_id: acceptedVersion.id,
          },
          error: null,
        },
        estimate_snapshot: {
          data: {
            ...acceptedOperationalSnapshot.snapshot,
            id: 'snapshot-accepted-1',
          },
          error: null,
        },
      }) as never,
      'org-1',
      'job-1'
    )

    expect(acceptedReader.ok).toBe(true)
    if (!acceptedReader.ok) throw new Error(acceptedReader.message)
    expect(acceptedReader.data.snapshot_json).toEqual(acceptedVersion.snapshot_json)
    expect(acceptedReader.data.snapshot_json.document).toEqual(previewDocument)
    expect(state.store?.version?.snapshot_json?.document).toEqual(previewDocument)
    expect(previewArtifact.document).toEqual(previewDocument)
  })
})
