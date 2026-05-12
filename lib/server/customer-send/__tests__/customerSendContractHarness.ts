import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import type {
  CustomerQuoteSourceModel,
  CustomerSendDraft,
  EstimatePublicVersionRow,
} from '../types'
import { buildCustomerSendPersistedSnapshot } from '../types'

type PublicVersionStoreState = {
  nextId: number
  version: EstimatePublicVersionRow | null
  events: Array<Record<string, unknown>>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function buildCustomerSendContractContext(
  overrides: Partial<CustomerQuoteSourceModel> = {}
): CustomerQuoteSourceModel {
  return {
    estimate: {
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      status: 'draft',
      version_name: 'Kitchen Quote',
      version_state: 'draft',
      version_kind: 'standard',
      version_sort_order: 1,
      created_at: null,
      updated_at: null,
    },
    job: {
      id: 'job-1',
      title: 'Kitchen',
      estimate_date: '2026-05-01',
      customer_name: 'Taylor Smith',
      customer_email: 'taylor@example.test',
      customer_phone: '555-0123',
      customer_address: '123 Main St',
    },
    customer: {
      id: 'customer-1',
      name: 'Taylor Smith',
      email: 'taylor@example.test',
      phone: '555-0123',
      address: '123 Main St',
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '555-0100',
      business_email: 'hello@example.test',
      address: '123 Main St',
      website: '',
      sender_signature: 'ACE Painting',
      logo_url: '',
    },
    settings: {
      default_template_key: 'default',
      quote_validity_days: 30,
      terms_text: 'Standard quote terms.',
    },
    inputs: {
      rooms: [],
      room_wall_scopes: [
        {
          id: 'wall-scope-1',
          room_id: 'room-1',
          scope_name: 'Kitchen walls',
          effective_paint_hours: 6,
          effective_primer_hours: 1,
          effective_paint_gallons: 2,
          effective_primer_gallons: 0.5,
          allocated_paint_material_cost: 180,
          effective_supply_cost: 35,
          effective_total: 1200,
        },
      ],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [
        {
          id: 'ceiling-scope-1',
          room_id: 'room-1',
          scope_name: 'Kitchen ceiling',
          effective_paint_hours: 2,
          effective_primer_hours: 0,
          effective_paint_gallons: 1,
          effective_primer_gallons: 0,
          allocated_paint_material_cost: 90,
          effective_supply_cost: 15,
          effective_total: 600,
        },
      ],
      ceiling_scope_segments: [],
      room_trim_scopes: [
        {
          id: 'trim-scope-1',
          room_id: 'room-1',
          scope_name: 'Kitchen trim',
          effective_paint_hours: 1.5,
          effective_primer_hours: 0.25,
          effective_paint_gallons: 0.5,
          effective_primer_gallons: 0.1,
          allocated_paint_material_cost: 45,
          effective_supply_cost: 10,
          effective_total: 400,
        },
      ],
      room_door_scopes: [],
      drywall_repairs: [],
      access_fees: [
        {
          id: 'access-1',
          label: 'Setup',
          effective_total: 80,
        },
      ],
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
    },
    catalogs: null,
    pricing_summary: {
      finalTotal: 4250,
    },
    latest_public_version: null,
    latest_sent_version: null,
    latest_draft_version: null,
    public_url: null,
    public_versions: [],
    ...overrides,
  }
}

export function createPublicVersionStore(
  initialVersion: EstimatePublicVersionRow | null = null
) {
  const state: PublicVersionStoreState = {
    nextId: 1,
    version: initialVersion ? clone(initialVersion) : null,
    events: [],
  }

  return {
    get version() {
      return state.version ? clone(state.version) : null
    },
    get events() {
      return clone(state.events)
    },
    getByToken(token: string) {
      if (!state.version) return null
      return state.version.public_token === token ? clone(state.version) : null
    },
    getById(id: string) {
      if (!state.version) return null
      return String(state.version.id ?? '') === id ? clone(state.version) : null
    },
    setVersion(version: EstimatePublicVersionRow | null) {
      state.version = version ? clone(version) : null
      return this.version
    },
    persistDraft(params: {
      orgId: string
      estimateId: string
      customerId: string
      userId: string
      draft: CustomerSendDraft
      document: CustomerEstimateDocument
      operationalSnapshot?: Record<string, unknown>
      latestDraft: EstimatePublicVersionRow | null
      latestVersion: EstimatePublicVersionRow | null
    }) {
      const latestDraft =
        params.latestDraft && String(params.latestDraft.status ?? 'draft').trim() === 'draft'
          ? params.latestDraft
          : null
      const versionNumber = latestDraft
        ? Number(latestDraft.version_number ?? 1)
        : Number(params.latestVersion?.version_number ?? 0) + 1
      const versionId = String(latestDraft?.id ?? `version-${state.nextId++}`)
      const nextVersion: EstimatePublicVersionRow = {
        ...(latestDraft ? clone(latestDraft) : {}),
        id: versionId,
        org_id: params.orgId,
        estimate_id: params.estimateId,
        customer_id: params.customerId || null,
        version_number: versionNumber,
        status: 'draft',
        public_token: latestDraft?.public_token ?? null,
        draft_json: null,
        snapshot_json: buildCustomerSendPersistedSnapshot({
          document: clone(params.document),
          draft: clone(params.draft),
          operationalSnapshot: params.operationalSnapshot
            ? clone(params.operationalSnapshot)
            : undefined,
        }),
        created_by: params.userId,
        sent_at: latestDraft?.sent_at ?? null,
        viewed_at: latestDraft?.viewed_at ?? null,
        accepted_at: latestDraft?.accepted_at ?? null,
        declined_at: latestDraft?.declined_at ?? null,
        locked_at: null,
      }
      state.version = nextVersion
      state.events.push({
        type: 'draft_saved',
        version_id: versionId,
      })
      return clone(nextVersion)
    },
    markSent(params: {
      version: EstimatePublicVersionRow
      publicToken: string
      sentAt: string
    }) {
      const nextVersion: EstimatePublicVersionRow = {
        ...clone(params.version),
        status: 'sent',
        public_token: params.publicToken,
        sent_at: params.sentAt,
        locked_at: params.sentAt,
      }
      state.version = nextVersion
      state.events.push({
        type: 'sent',
        version_id: String(nextVersion.id ?? ''),
      })
      return clone(nextVersion)
    },
    markViewed(viewedAt: string) {
      if (!state.version) return null
      const nextVersion: EstimatePublicVersionRow = {
        ...clone(state.version),
        status: 'viewed',
        viewed_at: viewedAt,
      }
      state.version = nextVersion
      state.events.push({
        type: 'viewed',
        version_id: String(nextVersion.id ?? ''),
      })
      return clone(nextVersion)
    },
  }
}

export function attachPersistedVersionToContext(
  context: CustomerQuoteSourceModel,
  version: EstimatePublicVersionRow | null,
  origin = 'https://example.test'
): CustomerQuoteSourceModel {
  const publicUrl =
    version?.public_token ? `${origin}/quote/${String(version.public_token).trim()}` : null

  return {
    ...clone(context),
    latest_public_version: version ? clone(version) : null,
    latest_draft_version:
      version && String(version.status ?? '').trim() === 'draft' ? clone(version) : null,
    latest_sent_version:
      version && String(version.status ?? '').trim() !== 'draft' ? clone(version) : null,
    public_url: publicUrl,
    public_versions: version ? [clone(version)] : [],
  }
}
