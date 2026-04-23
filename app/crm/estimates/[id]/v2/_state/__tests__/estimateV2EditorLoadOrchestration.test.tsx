import { describe, expect, it } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { buildEstimateV2EditorLoadState } from '../estimateV2EditorLoadOrchestration'

describe('buildEstimateV2EditorLoadState', () => {
  it('builds the canonical load state with sanitized collections and customer draft metadata', () => {
    const fixture = createMixedEstimateV2Fixture()
    const store = createEstimateV2Store()
    const estimatePayload = {
      ...fixture.summaryData,
      inputs: {
        ...fixture.summaryData.inputs,
        paint_products: fixture.summaryData.inputs.paint_products ?? [],
        rooms: fixture.summaryData.inputs.rooms ?? [],
        room_wall_scopes: fixture.summaryData.inputs.room_wall_scopes ?? [],
        room_ceiling_scopes: fixture.summaryData.inputs.room_ceiling_scopes ?? [],
        segments: fixture.summaryData.inputs.segments ?? [],
        room_trim_scopes: fixture.summaryData.inputs.room_trim_scopes ?? [],
        rollers: fixture.summaryData.inputs.rollers ?? [],
        prejob: fixture.summaryData.inputs.prejob ?? [],
        trim_items: fixture.summaryData.inputs.trim_items ?? [],
        job_colors: fixture.summaryData.inputs.job_colors ?? [],
        room_flags: fixture.summaryData.inputs.room_flags ?? [],
        access_fees: fixture.summaryData.inputs.access_fees ?? [],
        other: fixture.summaryData.inputs.other ?? [],
        org_defaults: fixture.summaryData.inputs.org_defaults ?? null,
        jobsettings: fixture.summaryData.inputs.jobsettings ?? null,
        wall_segments: fixture.segments,
        ceiling_scope_segments: fixture.ceilingSegments,
        ceiling_segments: fixture.summaryData.inputs.ceiling_segments ?? [],
      },
      wall_calculations: fixture.summaryData.wall_calculations ?? null,
      ceiling_calculations: fixture.summaryData.ceiling_calculations ?? null,
      trim_calculations: fixture.summaryData.trim_calculations ?? null,
      trim_paint: fixture.summaryData.trim_paint ?? null,
      pricing_summary: fixture.summaryData.pricing_summary ?? null,
    }

    const result = buildEstimateV2EditorLoadState({
      store,
      estimatePayload,
      catalogsPayload: { catalogs: fixture.catalogs },
      catalogsOk: true,
      catalogsErrorMessage: null,
      job: fixture.job,
    })

    expect(result.collections.rooms).toHaveLength(fixture.rooms.length)
    expect(result.collections.scopes).toHaveLength(fixture.scopes.length)
    expect(result.collections.trimScopes).toHaveLength(fixture.trimScopes.length)
    expect(result.meta.estimate?.id).toBe(fixture.estimate.id)
    expect(result.meta.customerDraft.name).toBe(fixture.job.customer_name)
    expect(result.meta.catalogs.paint_products).toHaveLength(fixture.catalogs.paint_products.length)
    expect(result.saveStatus).toBe('saved')
  })
})
