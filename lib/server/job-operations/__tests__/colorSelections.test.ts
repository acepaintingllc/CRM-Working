import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  buildColorSelectionSurfaces,
  computeColorSelectionCompleteness,
  normalizeColorSelectionConfirmInput,
  normalizeJobColorSelectionsDraftInput,
} from '../colorSelections.ts'
import type { AcceptedEstimateOperationalSource } from '@/types/job-operations/acceptedEstimateSource'
import type { JobColorSelectionRecord } from '@/types/job-operations/colorSelections'

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
      email: null,
      phone: null,
      address: null,
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
      version_name: 'Interior repaint',
      version_state: 'accepted',
      estimate_snapshot_id: 'snapshot-1',
    },
    publicDocumentSnapshot: {} as AcceptedEstimateOperationalSource['publicDocumentSnapshot'],
    internalEstimateSnapshot: {} as AcceptedEstimateOperationalSource['internalEstimateSnapshot'],
    rooms: [
      { id: 'room-1', name: 'Kitchen' },
      { id: 'room-2', name: 'Hallway' },
    ] as AcceptedEstimateOperationalSource['rooms'],
    scopes: {
      walls: [
        {
          id: 'wall-1',
          room_id: 'room-1',
          paint_product_id: 'paint-1',
          paint_product_label: 'Duration Interior',
          effective_quantity: 320,
        },
      ],
      ceilings: [
        {
          id: 'ceiling-1',
          room_id: 'room-2',
          paint_product_label: 'Eminence Ceiling Paint',
        },
      ],
      trim: [],
      doors: [],
      drywall: [],
      accessFees: [],
      prejob: [],
    } as AcceptedEstimateOperationalSource['scopes'],
    products: [],
    materials: {
      estimated_paint_gallons: 4,
      estimated_supplies_cost: 50,
      estimated_access_cost: 0,
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
      estimated_paint_gallons: 4,
      estimated_supplies_cost: 50,
      estimated_access_cost: 0,
      estimated_other_cost: 0,
    },
    notes: [],
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

function selection(overrides: Partial<JobColorSelectionRecord>): JobColorSelectionRecord {
  return {
    id: 'selection-1',
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_id: 'estimate-1',
    estimate_snapshot_id: 'snapshot-1',
    selection_set_id: 'set-1',
    room_id: null,
    room_display_name: null,
    scope_kind: 'walls',
    scope_id: null,
    scope_display_name: null,
    surface_label: null,
    paint_brand_id: null,
    paint_brand_display_name: null,
    color_catalog_id: null,
    color_number: null,
    color_name: null,
    color_display_name: null,
    sheen_id: null,
    sheen_display_name: null,
    paint_product_id: null,
    paint_product_display_name: null,
    quantity_label: null,
    notes: null,
    customer_notes: null,
    status: 'draft',
    position: 0,
    created_at: '2026-05-01T10:00:00.000Z',
    updated_at: '2026-05-01T10:00:00.000Z',
    created_by: null,
    updated_by: null,
    ...overrides,
  }
}

test('buildColorSelectionSurfaces derives required surfaces from accepted room scopes', () => {
  const surfaces = buildColorSelectionSurfaces(acceptedSource())

  assert.equal(surfaces.length, 2)
  assert.deepEqual(
    surfaces.map((surface) => ({
      key: surface.key,
      label: surface.surface_label,
      product: surface.paint_product_display_name,
      required: surface.required,
    })),
    [
      {
        key: 'walls:wall-1',
        label: 'Kitchen Walls',
        product: 'Duration Interior',
        required: true,
      },
      {
        key: 'ceilings:ceiling-1',
        label: 'Hallway Ceiling',
        product: 'Eminence Ceiling Paint',
        required: true,
      },
    ]
  )
})

test('computeColorSelectionCompleteness requires both color and sheen per required surface', () => {
  const surfaces = buildColorSelectionSurfaces(acceptedSource())

  const incomplete = computeColorSelectionCompleteness({
    surfaces,
    selections: [
      selection({
        scope_kind: 'walls',
        scope_id: 'wall-1',
        color_name: 'Alabaster',
      }),
    ],
  })
  assert.equal(incomplete.complete, false)
  assert.deepEqual(incomplete.missing_surface_keys, ['walls:wall-1', 'ceilings:ceiling-1'])

  const complete = computeColorSelectionCompleteness({
    surfaces,
    selections: [
      selection({
        scope_kind: 'walls',
        scope_id: 'wall-1',
        color_name: 'Alabaster',
        sheen_display_name: 'Satin',
      }),
      selection({
        id: 'selection-2',
        scope_kind: 'ceilings',
        scope_id: 'ceiling-1',
        color_catalog_id: 'color-1',
        sheen_id: 'sheen-1',
      }),
    ],
  })
  assert.equal(complete.complete, true)
  assert.equal(complete.completed_count, 2)
})

test('normalizeJobColorSelectionsDraftInput supports catalog and manual color entries', () => {
  const result = normalizeJobColorSelectionsDraftInput({
    selections: [
      {
        scope_kind: 'walls',
        scope_id: 'wall-1',
        color_catalog_id: '00000000-0000-4000-8000-000000000001',
        sheen_id: '00000000-0000-4000-8000-000000000002',
      },
      {
        scopeKind: 'ceilings',
        scopeId: 'ceiling-1',
        colorName: 'Manual white',
        sheenDisplayName: 'Flat',
      },
    ],
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.data.selections[0].color_catalog_id, '00000000-0000-4000-8000-000000000001')
    assert.equal(result.data.selections[1].color_name, 'Manual white')
    assert.equal(result.data.selections[1].sheen_display_name, 'Flat')
  }
})

test('normalizeColorSelectionConfirmInput limits admin decisions to confirm or revision', () => {
  assert.deepEqual(normalizeColorSelectionConfirmInput({ status: 'confirmed' }), {
    ok: true,
    data: { status: 'confirmed', notes: null },
  })
  assert.equal(normalizeColorSelectionConfirmInput({ status: 'submitted' }).ok, false)
})
