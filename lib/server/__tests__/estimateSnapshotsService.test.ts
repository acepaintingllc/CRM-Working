import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EstimateV2GetResponse } from '../../../types/estimator/v2.ts'
import { buildEstimatePublicPersistedSnapshot } from '../../customer-estimates/publicVersionSnapshot.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-role-key'

const {
  buildEstimateSnapshotRows,
  insertEstimateSnapshotIfMissing,
  selectAcceptedOperationalEstimateResponse,
} = await import('../estimate-feedback/snapshots.ts')

function acceptedCustomerArtifact(title = 'Accepted Quote') {
  const draft = {
    to_email: 'taylor@example.test',
    cc_email: '',
    bcc_email: '',
    subject: title,
    body: 'Please review your quote.',
    template_key: 'default',
    title,
    intro_paragraph: 'Thanks for reviewing this quote.',
    closing_paragraph: 'Let us know if you have questions.',
    terms_text: 'Standard quote terms.',
    scope_text_edits: {},
    quote_validity_days: 30,
    deposit_language: 'Deposit due on acceptance.',
    card_fee_note: 'Card fee may apply.',
  }
  const document = {
    meta: {
      estimate_id: 'estimate-1',
      version_name: title,
      version_state: 'live',
      flow_version: 'v2',
      title,
      quote_date: '2026-04-29',
      sent_at: '2026-04-29T09:00:00.000Z',
      viewed_at: null,
      accepted_at: '2026-04-29T10:00:00.000Z',
      declined_at: null,
      status: 'accepted',
      public_token: 'public-token-1',
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '555-0100',
      business_email: 'office@example.test',
      address: '123 Main St',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    customer: {
      name: 'Taylor Smith',
      email: 'taylor@example.test',
      phone: '555-0123',
      address: '123 Main St',
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
    intro_paragraph: draft.intro_paragraph,
    closing_paragraph: draft.closing_paragraph,
    quote_validity_days: draft.quote_validity_days,
    deposit_language: draft.deposit_language,
    card_fee_note: draft.card_fee_note,
    quote_rows: [],
    scopes: [],
    total: 1250,
    terms: ['Standard quote terms.'],
    source_meta: {
      company: {
        business_name: true,
        main_phone: true,
        business_email: true,
        address: true,
        website: false,
        sender_signature: false,
        logo_url: false,
      },
      settings: {
        quote_validity_days: true,
        terms_text: true,
      },
      overrides: {
        title: true,
        intro_paragraph: true,
        closing_paragraph: true,
        deposit_language: true,
        card_fee_note: true,
      },
    },
    header: {
      company_name: 'ACE Painting',
      contact_lines: ['555-0100', 'office@example.test'],
      logo_url: '',
      document_label: 'QUOTE',
      quote_date_label: '2026-04-29',
    },
    customer_block: {
      lines: ['Taylor Smith', '123 Main St'],
    },
    pricing_block: {
      rows: [],
      total: 1250,
      footer_note: '',
    },
    terms_page: {
      title: 'QUOTE TERMS',
      sections: [],
    },
    assembly_meta: {
      missing_company_fields: [],
      missing_payment_fields: [],
      missing_legal_fields: [],
      used_placeholder_fallbacks: false,
      used_explicit_terms_text: true,
    },
  }

  return buildEstimatePublicPersistedSnapshot({ document, draft })
}

function acceptedCustomerArtifactWithOperationalSnapshot(
  operationalSnapshot: Record<string, unknown>,
  title = 'Accepted Quote'
) {
  const artifact = acceptedCustomerArtifact(title)
  return buildEstimatePublicPersistedSnapshot({
    document: artifact.document,
    draft: artifact.draft,
    operationalSnapshot,
  })
}

function acceptedCustomerArtifactWithVisibleScopeRows(total = 6_000) {
  const artifact = acceptedCustomerArtifact('Accepted operational quote')
  return buildEstimatePublicPersistedSnapshot({
    document: {
      ...artifact.document,
      quote_rows: [
        { key: 'walls', label: 'Walls', description: 'Paint walls', price: 1_000 },
        { key: 'ceilings', label: 'Ceilings', description: 'Paint ceilings', price: 800 },
        { key: 'trim', label: 'Trim', description: 'Paint trim', price: 700 },
        { key: 'doors', label: 'Doors', description: 'Paint doors', price: 500 },
        { key: 'drywall', label: 'Drywall', description: 'Repair drywall', price: 600 },
        { key: 'other', label: 'Other', description: 'Additional work', price: 2_400 },
      ],
      scopes: [
        { key: 'walls', label: 'Walls', text: 'Paint walls', price: 1_000 },
        { key: 'ceilings', label: 'Ceilings', text: 'Paint ceilings', price: 800 },
        { key: 'trim', label: 'Trim', text: 'Paint trim', price: 700 },
        { key: 'doors', label: 'Doors', text: 'Paint doors', price: 500 },
        { key: 'drywall', label: 'Drywall', text: 'Repair drywall', price: 600 },
        { key: 'other', label: 'Other', text: 'Additional work', price: 2_400 },
      ],
      total,
    },
    draft: artifact.draft,
  })
}

function estimateResponse(overrides: Partial<EstimateV2GetResponse> = {}) {
  return {
    estimate: {
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Interior repaint',
      version_state: 'live',
      version_kind: 'base',
      setting_set_id_used: 'setting-set-old',
    },
    inputs: {
      jobsettings: { override_labor_rate: 80 },
      org_defaults: { override_labor_rate: 75 },
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
      prejob: [
        {
          id: 'prejob-1',
          room_id: 'R001',
          trip_name: 'Wallpaper removal prep',
          trip_hours: 3,
          effective_total: 175,
          notes: 'Complete before paint start',
        },
      ],
      trim_items: [],
      job_colors: [],
      room_flags: [],
      access_fees: [
        {
          id: 'access-1',
          room_id: 'R001',
          label: 'Tall ladder',
          effective_total: 125,
        },
      ],
      other: [
        {
          id: 'other-1',
          room_id: 'R001',
          description: 'Fixture removal',
          effective_paint_hours: 1,
          effective_total: 200,
        },
      ],
    },
    wall_calculations: {
      scopes: [
        {
          id: 'wall-1',
          room_id: 'R001',
          scope_name: 'Kitchen walls',
          effective_paint_hours: 5,
          effective_primer_hours: 1,
          effective_paint_gallons: 2,
          effective_primer_gallons: 0.5,
          allocated_paint_material_cost: 90,
          primer_price_per_gal: 20,
          effective_supply_cost: 35,
          effective_total: 600,
        },
      ],
    },
    ceiling_calculations: { scopes: [] },
    trim_calculations: { scopes: [] },
    door_calculations: { scopes: [] },
    drywall_calculations: { scopes: [] },
    trim_paint: null,
    pricing_summary: {
      effectiveLaborHours: 16,
      paintMaterialCost: 90,
      primerMaterialCost: 10,
      supplyCost: 35,
      sharedAccessCost: 125,
      finalTotal: 1_250,
    },
    ...overrides,
  } as unknown as EstimateV2GetResponse
}

function buildRows(response = estimateResponse()) {
  const snapshot = acceptedCustomerArtifact()
  return buildEstimateSnapshotRows({
    orgId: 'org-1',
    estimateResponse: response,
    job: { id: 'job-1', customer_id: 'customer-1', linked_estimate_id: 'estimate-1' },
    publicVersion: {
      id: 'public-version-1',
      version_number: 2,
      public_token: 'public-token-1',
      status: 'accepted',
      accepted_at: '2026-04-29T10:00:00.000Z',
      acceptance_json: {
        legal_name: 'Taylor Smith',
        signature_type: 'typed',
      },
      snapshot_json: snapshot,
    },
    createdBy: 'user-1',
  })
}

function fullWorkOrderEstimateResponse() {
  return estimateResponse({
    inputs: {
      jobsettings: { override_labor_rate: 80, walls_paint_id: 'P-WALL' },
      org_defaults: { override_labor_rate: 75, default_markup_pct: 20 },
      paint_products: [
        { id: 'P-WALL', display_name: 'Wall Paint' },
        { id: 'P-CEILING', display_name: 'Ceiling Paint' },
        { id: 'P-TRIM', display_name: 'Trim Paint' },
      ],
      rooms: [
        { id: 'room-row-1', room_id: 'R001', room_name: 'Kitchen' },
        { id: 'room-row-2', room_id: 'R002', room_name: 'Hall' },
      ],
      room_wall_scopes: [
        {
          id: 'wall-input-1',
          room_id: 'R001',
          scope_name: 'Kitchen walls',
          include: 'Y',
          paint_product_id: 'P-WALL',
          color_id: 'COLOR-WALL',
          notes: 'Patch nail holes',
        },
      ],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [
        {
          id: 'ceiling-input-1',
          room_id: 'R001',
          scope_name: 'Kitchen ceiling',
          include: 'Y',
          paint_product_id: 'P-CEILING',
        },
      ],
      ceiling_scope_segments: [],
      room_trim_scopes: [
        {
          id: 'trim-input-1',
          room_id: 'R002',
          scope_name: 'Hall trim',
          include: 'Y',
          paint_product_id: 'P-TRIM',
        },
      ],
      room_door_scopes: [
        {
          id: 'door-input-1',
          room_id: 'R002',
          scope_name: 'Hall door',
          include: 'Y',
          paint_product_id: 'P-TRIM',
        },
      ],
      drywall_repairs: [
        {
          id: 'drywall-input-1',
          room_id: 'R001',
          repair_type: 'Patch',
          include: 'Y',
          notes: 'Before painting',
        },
      ],
      rollers: [],
      prejob: [
        {
          id: 'prejob-1',
          room_id: 'R001',
          category: 'prep',
          rollup_scope: 'walls',
          trip_name: 'Wallpaper removal prep',
          task_name: 'Remove wallpaper',
          trip_num: 2,
          trip_rate: 150,
          manual_adjustment: 25,
          calculated_total: 300,
          raw_total: 300,
          override_total: 325,
          effective_total: 325,
          final_total: 325,
          manual_task_name: 'Steam removal',
          manual_task_hours: 2,
          qty: 1,
          hours: 4,
          labor_rate: 80,
          markup_pct: 20,
          extra_supplies_cost: 15,
          active: true,
          include: 'Y',
          notes: 'Complete before paint start',
        },
      ],
      trim_items: [],
      job_colors: [{ id: 'COLOR-WALL', label: 'Agreeable Gray' }],
      room_flags: [],
      access_fees: [
        {
          id: 'access-1',
          room_id: 'R001',
          access_fee_id: 'LADDER',
          label: 'Tall ladder',
          display_name: 'Tall ladder setup',
          access_group: 'height',
          unit: 'trip',
          qty: 1,
          amount: 125,
          catalog_amount: 125,
          actual_cost_override: 140,
          calculated_total: 125,
          raw_total: 125,
          override_total: 140,
          effective_total: 140,
          final_total: 140,
          active: true,
          include: 'Y',
          rollup_scope: 'walls',
          preferred_scope: 'walls',
          notes: 'Use extension ladder',
        },
      ],
      other: [
        {
          id: 'other-1',
          room_id: 'R002',
          client_description: 'Fixture removal',
          description: 'Fixture removal',
          include: 'Y',
          qty: 1,
          effective_paint_hours: 1,
          effective_total: 400,
          notes: 'Remove before work',
        },
      ],
    },
    wall_calculations: {
      scopes: [
        {
          id: 'wall-1',
          source_row_id: 'wall-input-1',
          room_id: 'R001',
          scope_name: 'Kitchen walls',
          customer_label: 'Walls',
          customer_description: 'Paint kitchen walls',
          include: 'Y',
          active: true,
          qty: 320,
          effective_paint_hours: 5,
          effective_primer_hours: 1,
          effective_paint_gallons: 2,
          effective_primer_gallons: 0.5,
          allocated_paint_material_cost: 90,
          primer_price_per_gal: 20,
          effective_supply_cost: 35,
          effective_total: 1_000,
          paint_product_id: 'P-WALL',
          color_id: 'COLOR-WALL',
          notes: 'Patch nail holes',
        },
      ],
    },
    ceiling_calculations: {
      scopes: [
        {
          id: 'ceiling-1',
          source_row_id: 'ceiling-input-1',
          room_id: 'R001',
          scope_name: 'Kitchen ceiling',
          include: 'Y',
          effective_paint_hours: 3,
          effective_paint_gallons: 1,
          allocated_paint_material_cost: 45,
          effective_supply_cost: 15,
          effective_total: 800,
          paint_product_id: 'P-CEILING',
        },
      ],
    },
    trim_calculations: {
      scopes: [
        {
          id: 'trim-1',
          source_row_id: 'trim-input-1',
          room_id: 'R002',
          scope_name: 'Hall trim',
          include: 'Y',
          effective_paint_hours: 2,
          effective_paint_gallons: 0.5,
          allocated_paint_material_cost: 35,
          effective_supply_cost: 10,
          effective_total: 700,
          paint_product_id: 'P-TRIM',
        },
      ],
    },
    door_calculations: {
      scopes: [
        {
          id: 'door-1',
          source_row_id: 'door-input-1',
          room_id: 'R002',
          scope_name: 'Hall door',
          include: 'Y',
          effective_paint_hours: 1,
          effective_paint_gallons: 0.25,
          allocated_paint_material_cost: 20,
          effective_supply_cost: 5,
          effective_total: 500,
          paint_product_id: 'P-TRIM',
        },
      ],
    },
    drywall_calculations: {
      scopes: [
        {
          id: 'drywall-1',
          source_row_id: 'drywall-input-1',
          room_id: 'R001',
          repair_type: 'Patch',
          include: 'Y',
          effective_paint_hours: 2,
          effective_supply_cost: 25,
          effective_total: 600,
          notes: 'Before painting',
        },
      ],
    },
    pricing_summary: {
      effectiveLaborHours: 24,
      paintMaterialCost: 190,
      primerMaterialCost: 10,
      supplyCost: 115,
      sharedAccessCost: 140,
      prepTripCost: 325,
      finalTotal: 6_000,
    },
  } as unknown as Partial<EstimateV2GetResponse>)
}

function createFn<TArgs extends unknown[], TResult>(
  impl: (...args: TArgs) => TResult
) {
  const calls: TArgs[] = []
  const fn = (...args: TArgs) => {
    calls.push(args)
    return impl(...args)
  }
  fn.calls = calls
  return fn
}

function createSnapshotDb(options: {
  existing?: Record<string, unknown> | null
  duplicateOnInsert?: boolean
  rpcError?: string | null
  summaryLineExists?: boolean
}) {
  const rpcPayloads: unknown[] = []
  let lookupCount = 0
  const db = {
    rpc(name: string, payload: unknown) {
      assert.equal(name, 'insert_estimate_snapshot_with_lines')
      rpcPayloads.push(JSON.parse(JSON.stringify(payload)))
      if (options.rpcError) {
        return Promise.resolve({
          data: null,
          error: { message: options.rpcError },
        })
      }
      if (options.duplicateOnInsert) {
        return Promise.resolve({
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "estimate_snapshot_org_id_estimate_id_key"',
          },
        })
      }
      if (options.existing) {
        return Promise.resolve({
          data: options.existing,
          error: null,
        })
      }
      return Promise.resolve({
        data: {
          ...((payload as { p_snapshot: Record<string, unknown> }).p_snapshot),
          id: 'snapshot-1',
        },
        error: null,
      })
    },
    from(table: string) {
      if (table === 'estimate_snapshot') {
        return {
          select: createFn(() => ({
            eq: createFn(() => ({
              eq: createFn(() => ({
                maybeSingle: createFn(async () => {
                  lookupCount += 1
                  return {
                    data:
                      lookupCount >= 1 && options.duplicateOnInsert
                        ? {
                            ...(
                              rpcPayloads.at(-1) as {
                                p_snapshot: Record<string, unknown>
                              }
                            ).p_snapshot,
                            id: 'snapshot-raced',
                          }
                        : options.existing ?? null,
                    error: null,
                  }
                }),
              })),
            })),
          })),
        }
      }
      if (table === 'estimate_snapshot_line') {
        return {
          select: createFn(() => ({
            eq: createFn(() => ({
              eq: createFn(() => ({
                eq: createFn(() => ({
                  eq: createFn(() => ({
                    maybeSingle: createFn(async () => ({
                      data:
                        options.summaryLineExists === false
                          ? null
                          : { id: 'snapshot-line-summary' },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }

  return { db, rpcPayloads }
}

describe('estimate operational snapshots', () => {
  it('builds accepted customer-visible snapshot totals from the canonical accepted artifact', () => {
    const built = buildRows()
    const artifactTotal = acceptedCustomerArtifact().document.total

    assert.deepEqual(
      {
        org_id: built.snapshot.org_id,
        job_id: built.snapshot.job_id,
        estimate_id: built.snapshot.estimate_id,
        customer_id: built.snapshot.customer_id,
        accepted_public_version_id: built.snapshot.accepted_public_version_id,
        setting_set_id_used: built.snapshot.setting_set_id_used,
        snapshot_created_reason: built.snapshot.snapshot_created_reason,
        estimated_labor_hours: built.snapshot.estimated_labor_hours,
        estimated_paint_gallons: built.snapshot.estimated_paint_gallons,
        estimated_primer_gallons: built.snapshot.estimated_primer_gallons,
        estimated_paint_material_cost: built.snapshot.estimated_paint_material_cost,
        estimated_supplies_cost: built.snapshot.estimated_supplies_cost,
        estimated_other_cost: built.snapshot.estimated_other_cost,
        estimated_access_cost: built.snapshot.estimated_access_cost,
        estimated_total: built.snapshot.estimated_total,
      },
      {
        org_id: 'org-1',
        job_id: 'job-1',
        estimate_id: 'estimate-1',
        customer_id: 'customer-1',
        accepted_public_version_id: 'public-version-1',
        setting_set_id_used: 'setting-set-old',
        snapshot_created_reason: 'accepted',
        estimated_labor_hours: 16,
        estimated_paint_gallons: 2,
        estimated_primer_gallons: 0.5,
        estimated_paint_material_cost: 100,
        estimated_supplies_cost: 35,
        estimated_other_cost: 200,
        estimated_access_cost: 125,
        estimated_total: artifactTotal,
      }
    )
    assert.deepEqual(
      built.snapshot.source_payload_json.customer_artifact,
      acceptedCustomerArtifact()
    )
    assert.equal(
      built.snapshot.source_payload_json.artifact_kind,
      'accepted_estimate_operational_snapshot_source'
    )
    assert.equal(built.snapshot.source_payload_json.artifact_version, 1)
    assert.deepEqual(built.snapshot.source_payload_json.accepted_public_version, {
      id: 'public-version-1',
      version_number: 2,
      public_token: 'public-token-1',
      status: 'accepted',
      accepted_at: '2026-04-29T10:00:00.000Z',
      acceptance_json: {
        legal_name: 'Taylor Smith',
        signature_type: 'typed',
      },
      snapshot_json: acceptedCustomerArtifact(),
    })
    assert.deepEqual(
      built.lines.map((line) => line.line_key),
      [
        'walls:wall-1',
        'other:other-1',
        'access:access-1',
        'prejob:prejob-1',
        'summary:job-total',
      ]
    )
  })

  it('builds complete queryable work-order source lines while keeping access and prejob hidden from customer rows', () => {
    const acceptedArtifact = acceptedCustomerArtifactWithVisibleScopeRows()
    const built = buildEstimateSnapshotRows({
      orgId: 'org-1',
      estimateResponse: fullWorkOrderEstimateResponse(),
      job: { id: 'job-1', customer_id: 'customer-1', linked_estimate_id: 'estimate-1' },
      publicVersion: {
        id: 'public-version-1',
        version_number: 2,
        public_token: 'public-token-1',
        status: 'accepted',
        accepted_at: '2026-04-29T10:00:00.000Z',
        acceptance_json: {
          legal_name: 'Taylor Smith',
          signature_type: 'typed',
        },
        snapshot_json: acceptedArtifact,
      },
      createdBy: 'user-1',
    })

    assert.deepEqual(
      built.lines.map((line) => line.line_kind),
      [
        'walls',
        'ceilings',
        'trim',
        'doors',
        'drywall',
        'other',
        'access',
        'prejob',
        'summary',
      ]
    )
    const sourcePayload = built.snapshot.source_payload_json as {
      customer_artifact: {
        document: { quote_rows: Array<{ key: string }>; total: number }
      }
      internal_operational_estimate: {
        inputs: Record<string, unknown[] | Record<string, unknown>>
        pricing: Record<string, unknown>
      }
    }
    assert.equal(sourcePayload.customer_artifact.document.total, 6_000)
    assert.deepEqual(
      sourcePayload.customer_artifact.document.quote_rows.map((row) => row.key),
      ['walls', 'ceilings', 'trim', 'doors', 'drywall', 'other']
    )
    assert.equal(
      sourcePayload.customer_artifact.document.quote_rows.some(
        (row) => row.key === 'access' || row.key === 'prejob'
      ),
      false
    )
    for (const key of [
      'rooms',
      'room_wall_scopes',
      'room_ceiling_scopes',
      'room_trim_scopes',
      'room_door_scopes',
      'drywall_repairs',
      'access_fees',
      'prejob',
      'other',
    ]) {
      assert.equal(Array.isArray(sourcePayload.internal_operational_estimate.inputs[key]), true)
    }
    assert.deepEqual(sourcePayload.internal_operational_estimate.inputs.jobsettings, {
      override_labor_rate: 80,
      walls_paint_id: 'P-WALL',
    })
    assert.deepEqual(sourcePayload.internal_operational_estimate.inputs.org_defaults, {
      override_labor_rate: 75,
      default_markup_pct: 20,
    })
    assert.deepEqual(
      sourcePayload.internal_operational_estimate.inputs.access_fees,
      [built.lines.find((line) => line.line_kind === 'access')?.output_json]
    )
    assert.deepEqual(
      sourcePayload.internal_operational_estimate.inputs.prejob,
      [built.lines.find((line) => line.line_kind === 'prejob')?.output_json]
    )
    assert.equal(
      (
        built.lines.find((line) => line.line_kind === 'walls')?.output_json as {
          paint_product_id?: string
          color_id?: string
          notes?: string
        }
      ).paint_product_id,
      'P-WALL'
    )
    assert.equal(
      (
        built.lines.find((line) => line.line_kind === 'access')?.output_json as {
          actual_cost_override?: number
          preferred_scope?: string
          final_total?: number
        }
      ).actual_cost_override,
      140
    )
    assert.equal(
      (
        built.lines.find((line) => line.line_kind === 'prejob')?.output_json as {
          manual_task_name?: string
          labor_rate?: number
          final_total?: number
        }
      ).manual_task_name,
      'Steam removal'
    )
    assert.equal(
      (
        sourcePayload.internal_operational_estimate.pricing.wall_calculations as {
          scopes: unknown[]
        }
      ).scopes.length,
      1
    )
  })

  it('preserves access and prejob work-order metadata in immutable snapshot lines and source payload', () => {
    const built = buildRows()

    const accessLine = built.lines.find((line) => line.line_key === 'access:access-1')
    assert.equal(accessLine?.line_kind, 'access')
    assert.equal(accessLine?.source_table, 'estimate_access_fees')
    assert.equal(accessLine?.estimated_total, 125)
    assert.deepEqual(accessLine?.output_json, {
      id: 'access-1',
      room_id: 'R001',
      label: 'Tall ladder',
      effective_total: 125,
    })

    const prejobLine = built.lines.find((line) => line.line_key === 'prejob:prejob-1')
    assert.equal(prejobLine?.line_kind, 'prejob')
    assert.equal(prejobLine?.source_table, 'estimate_prejob')
    assert.equal(prejobLine?.label, 'Wallpaper removal prep')
    assert.equal(prejobLine?.estimated_labor_hours, 3)
    assert.equal(prejobLine?.estimated_total, 175)
    assert.deepEqual(prejobLine?.output_json, {
      id: 'prejob-1',
      room_id: 'R001',
      trip_name: 'Wallpaper removal prep',
      trip_hours: 3,
      effective_total: 175,
      notes: 'Complete before paint start',
    })

    const sourceInputs = (
      built.snapshot.source_payload_json as {
        internal_operational_estimate: {
          inputs: {
            access_fees: unknown[]
            prejob: unknown[]
          }
        }
      }
    ).internal_operational_estimate.inputs
    assert.deepEqual(sourceInputs.access_fees, [accessLine?.output_json])
    assert.deepEqual(sourceInputs.prejob, [prejobLine?.output_json])
  })

  it('calculates accepted prejob snapshot totals from raw trip fields when effective_total is absent', () => {
    const prejobTotal = 2 * 125 + 25
    const baseResponse = estimateResponse()
    const acceptedArtifact = acceptedCustomerArtifact('Raw prejob accepted quote')
    const acceptedArtifactWithPrejobTotal = buildEstimatePublicPersistedSnapshot({
      document: {
        ...acceptedArtifact.document,
        total: 1_275,
        pricing_block: {
          ...acceptedArtifact.document.pricing_block,
          total: 1_275,
        },
      },
      draft: acceptedArtifact.draft,
    })
    const built = buildEstimateSnapshotRows({
      orgId: 'org-1',
      estimateResponse: estimateResponse({
        inputs: {
          ...baseResponse.inputs,
          prejob: [
            {
              id: 'prejob-raw-1',
              room_id: 'R001',
              trip_name: 'Raw wallpaper prep',
              trip_num: 2,
              trip_rate: 125,
              manual_adjustment: 25,
              active: true,
              include: 'Y',
            },
            {
              id: 'prejob-calculated-1',
              room_id: 'R001',
              trip_name: 'Already priced prep',
              trip_num: 9,
              trip_rate: 999,
              manual_adjustment: 999,
              effective_total: 88,
              active: true,
              include: 'Y',
            },
          ],
        },
        pricing_summary: {
          ...baseResponse.pricing_summary,
          prepTripCost: prejobTotal,
          finalTotal: 1_275,
        },
      } as Partial<EstimateV2GetResponse>),
      job: { id: 'job-1', customer_id: 'customer-1', linked_estimate_id: 'estimate-1' },
      publicVersion: {
        id: 'public-version-1',
        version_number: 2,
        public_token: 'public-token-1',
        status: 'accepted',
        accepted_at: '2026-04-29T10:00:00.000Z',
        acceptance_json: {
          legal_name: 'Taylor Smith',
          signature_type: 'typed',
        },
        snapshot_json: acceptedArtifactWithPrejobTotal,
      },
      createdBy: 'user-1',
    })

    assert.equal(built.snapshot.estimated_total, acceptedArtifactWithPrejobTotal.document.total)
    const prejobLine = built.lines.find((line) => line.line_key === 'prejob:prejob-raw-1')
    assert.equal(prejobLine?.estimated_total, prejobTotal)
    assert.deepEqual(prejobLine?.output_json, {
      id: 'prejob-raw-1',
      room_id: 'R001',
      trip_name: 'Raw wallpaper prep',
      trip_num: 2,
      trip_rate: 125,
      manual_adjustment: 25,
      active: true,
      include: 'Y',
      calculated_total: 250,
      raw_total: prejobTotal,
      effective_total: prejobTotal,
      final_total: prejobTotal,
    })
    const calculatedPrejobLine = built.lines.find(
      (line) => line.line_key === 'prejob:prejob-calculated-1'
    )
    assert.equal(calculatedPrejobLine?.estimated_total, 88)
    assert.deepEqual(calculatedPrejobLine?.output_json, {
      id: 'prejob-calculated-1',
      room_id: 'R001',
      trip_name: 'Already priced prep',
      trip_num: 9,
      trip_rate: 999,
      manual_adjustment: 999,
      effective_total: 88,
      active: true,
      include: 'Y',
    })
    assert.deepEqual(
      (
        built.snapshot.source_payload_json as {
          internal_operational_estimate: { inputs: { prejob: unknown[] } }
        }
      ).internal_operational_estimate.inputs.prejob,
      [prejobLine?.output_json, calculatedPrejobLine?.output_json]
    )
  })

  it('returns an existing snapshot through the atomic RPC without mutating immutable rows', async () => {
    const existing = {
      ...buildRows().snapshot,
      id: 'snapshot-existing',
      estimate_id: 'estimate-1',
    }
    const { db, rpcPayloads } = createSnapshotDb({
      existing,
    })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.deepEqual(result, {
      ok: true,
      data: existing,
    })
    assert.equal(rpcPayloads.length, 1)
  })

  it('creates exactly one snapshot and snapshot lines on first acceptance', async () => {
    const { db, rpcPayloads } = createSnapshotDb({ existing: null })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.equal(result.ok, true)
    assert.equal(rpcPayloads.length, 1)
    const payload = rpcPayloads[0] as {
      p_snapshot: Record<string, unknown>
      p_lines: Array<Record<string, unknown>>
    }
    assert.equal(payload.p_snapshot.estimate_id, 'estimate-1')
    assert.ok(
      payload.p_lines.some(
        (line) =>
          line.line_key === 'summary:job-total' &&
          line.estimated_total === acceptedCustomerArtifact().document.total
      )
    )
  })

  it('reuses a duplicate snapshot created by a concurrent acceptance retry', async () => {
    const { db, rpcPayloads } = createSnapshotDb({
      existing: null,
      duplicateOnInsert: true,
    })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.deepEqual(result, {
      ok: true,
      data: {
        ...buildRows().snapshot,
        id: 'snapshot-raced',
      },
    })
    assert.equal(rpcPayloads.length, 1)
  })

  it('rejects incomplete existing snapshots instead of silently using them', async () => {
    const { db } = createSnapshotDb({
      existing: null,
      rpcError: 'existing estimate snapshot is incomplete',
    })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.deepEqual(result, {
      ok: false,
      kind: 'invalid_input',
      message: 'Existing estimate snapshot is incomplete and cannot be used for actuals.',
    })
  })

  it('rejects canonical-looking existing snapshots when required snapshot lines are missing', async () => {
    const { db } = createSnapshotDb({
      existing: {
        ...buildRows().snapshot,
        id: 'snapshot-existing',
      },
      summaryLineExists: false,
    })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.deepEqual(result, {
      ok: false,
      kind: 'invalid_input',
      message:
        'Existing accepted estimate snapshot is incomplete and cannot be repaired in place because estimate snapshot rows are immutable. Run an additive snapshot replacement migration.',
    })
  })

  it('keeps snapshot data unchanged after live estimate values mutate', () => {
    const response = estimateResponse()
    const built = buildRows(response)

    ;(response.pricing_summary as Record<string, unknown>).finalTotal = 9_999
    ;(response.wall_calculations?.scopes?.[0] as Record<string, unknown>).effective_total = 9_999
    ;(response.inputs.access_fees[0] as Record<string, unknown>).effective_total = 9_999
    ;(response.inputs.prejob[0] as Record<string, unknown>).trip_name = 'Live mutation'
    ;(response.inputs.rooms[0] as Record<string, unknown>).room_name = 'Mutated room'

    assert.equal(built.snapshot.estimated_total, acceptedCustomerArtifact().document.total)
    assert.equal(
      built.lines.find((line) => line.line_key === 'walls:wall-1')?.estimated_total,
      600
    )
    assert.equal(
      (
        built.snapshot.totals_json.wall_calculations as {
          scopes: Array<{ effective_total: number }>
        }
      ).scopes[0].effective_total,
      600
    )
    assert.equal(
      (
        built.lines.find((line) => line.line_key === 'access:access-1')?.output_json as {
          effective_total: number
        }
      ).effective_total,
      125
    )
    assert.equal(
      (
        built.lines.find((line) => line.line_key === 'prejob:prejob-1')?.output_json as {
          trip_name: string
        }
      ).trip_name,
      'Wallpaper removal prep'
    )
    assert.equal(
      (
        built.snapshot.source_payload_json.internal_operational_estimate as {
          inputs: { rooms: Array<{ room_name: string }> }
        }
      ).inputs.rooms[0].room_name,
      'Kitchen'
    )
    assert.equal(
      (
        built.snapshot.totals_json.internal_operational_pricing_summary as {
          pricing_summary: { finalTotal: number }
        }
      ).pricing_summary.finalTotal,
      1_250
    )
  })

  it('keeps customer-visible total from the accepted artifact when live calculation has drifted', () => {
    const acceptedArtifact = acceptedCustomerArtifact('Accepted artifact total')
    const built = buildEstimateSnapshotRows({
      orgId: 'org-1',
      estimateResponse: estimateResponse({
        pricing_summary: {
          effectiveLaborHours: 99,
          paintMaterialCost: 900,
          primerMaterialCost: 100,
          supplyCost: 350,
          sharedAccessCost: 1250,
          finalTotal: 99_999,
        },
      } as Partial<EstimateV2GetResponse>),
      job: { id: 'job-1', customer_id: 'customer-1', linked_estimate_id: 'estimate-1' },
      publicVersion: {
        id: 'public-version-1',
        version_number: 2,
        public_token: 'public-token-1',
        status: 'accepted',
        accepted_at: '2026-04-29T10:00:00.000Z',
        acceptance_json: {
          legal_name: 'Taylor Smith',
          signature_type: 'typed',
        },
        snapshot_json: acceptedArtifact,
      },
      createdBy: 'user-1',
    })

    assert.equal(built.snapshot.estimated_total, acceptedArtifact.document.total)
    assert.equal(
      (
        built.snapshot.totals_json as {
          internal_operational_pricing_summary: { final_total: number }
        }
      ).internal_operational_pricing_summary.final_total,
      99_999
    )
    assert.equal(
      built.snapshot.source_payload_json.customer_visible_source,
      'customer_artifact.document'
    )
  })

  it('falls back to live operational rows when the accepted public artifact has an empty operational snapshot', () => {
    const liveResponse = estimateResponse()
    const acceptedArtifact = acceptedCustomerArtifactWithOperationalSnapshot({
      artifact_kind: 'customer_send_operational_snapshot',
      artifact_version: 1,
      source_estimate_updated_at: null,
      estimate_response: {
        estimate: liveResponse.estimate,
        inputs: { rooms: [] },
        wall_calculations: { scopes: [] },
        ceiling_calculations: { scopes: [] },
        trim_calculations: { scopes: [] },
        pricing_summary: {
          finalTotal: acceptedCustomerArtifact().document.total,
          effectiveLaborHours: 0,
          rawLaborHours: 0,
          paintMaterialCost: 0,
          supplyCost: 0,
        },
      },
    })

    const selected = selectAcceptedOperationalEstimateResponse({
      acceptedArtifact,
      liveEstimateResponse: liveResponse,
    })

    assert.equal(selected, liveResponse)
    assert.equal(selected.wall_calculations?.scopes?.length, 1)
    assert.equal(selected.pricing_summary?.effectiveLaborHours, 16)
  })

  it('fails closed for missing or legacy accepted customer artifacts', () => {
    assert.throws(
      () =>
        buildEstimateSnapshotRows({
          orgId: 'org-1',
          estimateResponse: estimateResponse(),
          job: { id: 'job-1', customer_id: 'customer-1' },
          publicVersion: {
            id: 'public-version-1',
            version_number: 2,
            public_token: 'public-token-1',
            status: 'accepted',
            accepted_at: '2026-04-29T10:00:00.000Z',
            acceptance_json: {},
            snapshot_json: null,
          },
        }),
      /missing the canonical customer artifact/
    )

    assert.throws(
      () =>
        buildEstimateSnapshotRows({
          orgId: 'org-1',
          estimateResponse: estimateResponse(),
          job: { id: 'job-1', customer_id: 'customer-1' },
          publicVersion: {
            id: 'public-version-1',
            version_number: 2,
            public_token: 'public-token-1',
            status: 'accepted',
            accepted_at: '2026-04-29T10:00:00.000Z',
            acceptance_json: {},
            snapshot_json: acceptedCustomerArtifact().document,
          },
        }),
      /legacy and must be migrated/
    )
  })

  it('keeps the accepted estimate setting set after a new active setting set exists', () => {
    const response = estimateResponse()
    const built = buildRows(response)

    ;(response.estimate as Record<string, unknown>).setting_set_id_used =
      'setting-set-new-active'
    ;(response.inputs.org_defaults as Record<string, unknown>).override_labor_rate = 120

    assert.equal(built.snapshot.setting_set_id_used, 'setting-set-old')
    assert.deepEqual(built.snapshot.assumptions_json.org_defaults, {
      override_labor_rate: 75,
    })
  })
})
