import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildWorkOrderDocument,
  normalizeWorkOrderGenerateInput,
  validateWorkOrderGenerationReadiness,
} from '../job-operations/workOrders.ts'
import type { AcceptedEstimateOperationalSource } from '@/types/job-operations/acceptedEstimateSource'
import type {
  JobColorSelectionRecord,
  JobColorSelectionsReadModel,
} from '@/types/job-operations/colorSelections'

function acceptedSource(): AcceptedEstimateOperationalSource {
  return {
    job: {
      id: 'job-1',
      title: 'Interior repaint',
      status: 'accepted',
      customer_id: 'customer-1',
      linked_estimate_id: 'estimate-1',
    },
    customer: {
      id: 'customer-1',
      name: 'Ada Homeowner',
      email: 'ada@example.test',
      phone: null,
      address: '123 Paint St',
    },
    acceptance: {
      accepted_at: '2026-05-01T10:00:00.000Z',
      accepted_by_legal_name: 'Ada Homeowner',
      signature_type: 'typed',
      user_agent: null,
      ip: null,
      public_version_id: 'public-version-1',
      public_version_number: 1,
      public_token: 'quote-token',
    },
    estimate: {
      id: 'estimate-1',
      version_name: 'Main scope',
      version_state: 'live',
      estimate_snapshot_id: 'snapshot-1',
    },
    publicDocumentSnapshot: {} as AcceptedEstimateOperationalSource['publicDocumentSnapshot'],
    internalEstimateSnapshot: {} as AcceptedEstimateOperationalSource['internalEstimateSnapshot'],
    rooms: [{ id: 'room-1', name: 'Kitchen' }] as AcceptedEstimateOperationalSource['rooms'],
    scopes: {
      walls: [{ id: 'wall-1', room_id: 'room-1', paint_product_label: 'Duration', effective_quantity: 2 }],
      ceilings: [],
      trim: [],
      doors: [],
      drywall: [],
      accessFees: [{ id: 'access-1', label: 'Tall ladder', final_total: 25 }],
      prejob: [{ id: 'prep-1', notes: 'Move furniture' }],
    } as AcceptedEstimateOperationalSource['scopes'],
    products: [
      {
        id: 'product-1',
        label: 'Duration',
        source: 'paint_product_id',
        scope_kind: 'walls',
        scope_id: 'wall-1',
        room_id: 'room-1',
      },
    ],
    materials: {
      estimated_paint_gallons: 3,
      estimated_supplies_cost: 40,
      estimated_access_cost: 25,
      estimated_other_cost: 0,
      pricing_summary: {},
      wall_calculations: { scopes: [] },
      ceiling_calculations: { scopes: [] },
      trim_calculations: { scopes: [] },
      door_calculations: { scopes: [] },
      drywall_calculations: { scopes: [] },
    },
    totals: {
      accepted_total: 2500,
      final_total: 2500,
      pricing_summary: {},
      estimated_labor_hours: 18,
      estimated_paint_gallons: 3,
      estimated_supplies_cost: 40,
      estimated_access_cost: 25,
      estimated_other_cost: 0,
    },
    notes: [
      {
        source: 'accepted_estimate',
        scope_kind: 'walls',
        scope_id: 'wall-1',
        room_id: 'room-1',
        text: 'Patch nail holes',
      },
    ],
    source: {
      org_id: 'org-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      estimate_id: 'estimate-1',
      accepted_public_version_id: 'public-version-1',
      estimate_snapshot_id: 'snapshot-1',
    },
  }
}

function colorSelection(): JobColorSelectionRecord {
  return {
    id: 'selection-1',
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_id: 'estimate-1',
    estimate_snapshot_id: 'snapshot-1',
    selection_set_id: 'set-1',
    room_id: 'room-1',
    room_display_name: 'Kitchen',
    scope_kind: 'walls',
    scope_id: 'wall-1',
    scope_display_name: 'Walls',
    surface_label: 'Kitchen Walls',
    paint_brand_id: null,
    paint_brand_display_name: 'Sherwin-Williams',
    color_catalog_id: 'color-1',
    color_number: 'SW 7008',
    color_name: 'Alabaster',
    color_display_name: 'SW 7008 Alabaster',
    sheen_id: 'sheen-1',
    sheen_display_name: 'Satin',
    paint_product_id: 'product-1',
    paint_product_display_name: 'Duration',
    quantity_label: '2',
    notes: null,
    customer_notes: null,
    status: 'confirmed',
    position: 0,
    created_at: '2026-05-01T10:00:00.000Z',
    updated_at: '2026-05-01T10:00:00.000Z',
    created_by: null,
    updated_by: null,
  }
}

function colorModel(overrides: Partial<JobColorSelectionsReadModel> = {}): JobColorSelectionsReadModel {
  const source = acceptedSource()
  return {
    source: {
      job: source.job,
      customer: source.customer,
      acceptance: source.acceptance,
      estimate: source.estimate,
      totals: source.totals,
    },
    selection_set: {
      id: 'set-1',
      org_id: 'org-1',
      job_id: 'job-1',
      estimate_id: 'estimate-1',
      estimate_snapshot_id: 'snapshot-1',
      customer_id: 'customer-1',
      status: 'confirmed',
      revision_number: 1,
      title: 'Color selections',
      accepted_estimate_display_name: 'Main scope',
      accepted_total: 2500,
      public_token_expires_at: null,
      public_token_revoked_at: null,
      submitted_at: null,
      confirmed_at: '2026-05-02T10:00:00.000Z',
      created_at: '2026-05-01T10:00:00.000Z',
      updated_at: '2026-05-02T10:00:00.000Z',
      created_by: null,
      updated_by: null,
    },
    public_access: { token: null, url_path: null, expires_at: null },
    surfaces: [],
    selections: [colorSelection()],
    catalog: { colors: [], sheens: [] },
    completeness: {
      required_count: 1,
      completed_count: 1,
      missing_surface_keys: [],
      complete: true,
    },
    ...overrides,
  }
}

test('normalizeWorkOrderGenerateInput accepts notes and force flag', () => {
  assert.deepEqual(
    normalizeWorkOrderGenerateInput({
      forceWithWarnings: true,
      crewNotes: 'Use side door',
      access_prep_notes: 'Garage code on file',
      special_notes: 'Protect new floors',
    }),
    {
      ok: true,
      data: {
        force_with_warnings: true,
        crew_notes: 'Use side door',
        access_prep_notes: 'Garage code on file',
        special_notes: 'Protect new floors',
      },
    }
  )
})

test('validateWorkOrderGenerationReadiness blocks incomplete or unconfirmed colors unless forced', () => {
  const incomplete = colorModel({
    selection_set: { ...colorModel().selection_set!, status: 'submitted' },
    completeness: {
      required_count: 2,
      completed_count: 1,
      missing_surface_keys: ['ceilings:ceiling-1'],
      complete: false,
    },
  })

  const blocked = validateWorkOrderGenerationReadiness({
    colorModel: incomplete,
    forceWithWarnings: false,
  })
  assert.equal(blocked.ok, false)

  const forced = validateWorkOrderGenerationReadiness({
    colorModel: incomplete,
    forceWithWarnings: true,
  })
  assert.equal(forced.ok, true)
  if (forced.ok) {
    assert.deepEqual(forced.data.map((warning) => warning.code), [
      'color_selection_not_confirmed',
      'incomplete_color_selection',
    ])
  }
})

test('buildWorkOrderDocument snapshots accepted estimate, confirmed colors, notes, and accepted deltas', () => {
  const document = buildWorkOrderDocument({
    source: acceptedSource(),
    colorModel: colorModel(),
    changeOrders: [
      {
        id: 'change-1',
        change_order_number: 'CO-1',
        title: 'Add pantry',
        description: 'Paint pantry walls',
        delta_total: 350,
        accepted_at: '2026-05-03T10:00:00.000Z',
      },
    ],
    input: {
      force_with_warnings: false,
      crew_notes: 'Use side door',
      access_prep_notes: 'Garage code on file',
      special_notes: 'Protect new floors',
    },
    revisionNumber: 2,
    status: 'generated',
    generatedAt: '2026-05-04T10:00:00.000Z',
    warnings: [],
  })

  assert.equal(document.kind, 'job_work_order')
  assert.equal(document.revision_number, 2)
  assert.equal(document.totals.accepted_total, 2500)
  assert.equal(document.totals.accepted_change_order_total, 350)
  assert.equal(document.totals.work_order_total, 2850)
  assert.equal(document.confirmed_colors[0].color_display_name, 'SW 7008 Alabaster')
  assert.equal(document.confirmed_colors[0].sheen_display_name, 'Satin')
  assert.equal(document.products[0].label, 'Duration')
  assert.equal(document.notes.crew_notes, 'Use side door')
  assert.equal(document.notes.accepted_estimate_notes[0].text, 'Patch nail holes')
  assert.deepEqual(document.source.accepted_change_order_ids, ['change-1'])
})
