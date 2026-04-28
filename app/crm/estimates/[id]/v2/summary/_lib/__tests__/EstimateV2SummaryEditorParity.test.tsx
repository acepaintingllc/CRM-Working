import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { useEstimateV2DerivedState } from '../../../_state/useEstimateV2DerivedState'
import { useEstimateV2SummaryDerived } from '../useEstimateV2SummaryDerived'
import { createMixedEstimateV2Fixture } from '../../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'

function createEditorDerivedHarness() {
  const fixture = createMixedEstimateV2Fixture()

  return {
    fixture,
    store: createEstimateV2Store({
      collections: {
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
      },
      meta: {
      loading: false,
      saving: false,
      estimate: fixture.estimate,
      job: fixture.job,
      catalogs: fixture.catalogs,
      wallCalculations: fixture.wallCalculations,
      ceilingCalculations: fixture.ceilingCalculations,
      trimCalculations: fixture.trimCalculations,
      selectedRoomId: 'R001',
      error: null,
      validationIssues: ['R002: Missing paint product'],
      lastSavedSnapshot: fixture.currentSnapshot,
      saveStatus: 'saved',
      autoSaveHint: null,
      settingsOpen: false,
      jobDefaultsOpen: false,
      jobSettingsDraft: fixture.jobSettingsDraft,
      orgJobProductDefaults: fixture.orgJobProductDefaults,
      customerDraft: {
        customerId: fixture.job.customer_id ?? '',
        name: fixture.job.customer_name ?? '',
        email: fixture.job.customer_email ?? '',
        phone: fixture.job.customer_phone ?? '',
        address: fixture.job.customer_address ?? '',
      },
      debugMeta: {
        dirtySource: null,
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      },
      },
    }),
  }
}

describe('Estimate V2 editor/summary parity', () => {
  it('keeps room ordering, totals, alerts, and scope ordering aligned for the shared mixed fixture', () => {
    const { fixture, store } = createEditorDerivedHarness()

    const { result: editor } = renderHook(() => useEstimateV2DerivedState({ store }))

    const { result: summary } = renderHook(() =>
      useEstimateV2SummaryDerived({
        data: fixture.summaryData,
        job: fixture.job,
        jobSettingsDraft: {
          dayhours: fixture.jobSettingsDraft.dayhours,
          laborRate: fixture.jobSettingsDraft.laborRate,
        },
      })
    )

    expect(Array.from(editor.current.roomScopeByRoomId.keys())).toEqual(['R001', 'R002'])
    expect(summary.current.roomBlocks.map((block) => block.room.room_id)).toEqual(['R001', 'R002'])
    expect(summary.current.roomBlocks[0]?.scopes).toEqual(['Walls', 'Ceilings', 'Trim'])
    expect(summary.current.summaryAlerts.map((alert) => alert.title)).toEqual([
      'Missing product selection',
      'Manual override detected',
      'Warning flags active',
    ])
    expect(summary.current.finalTotal).toBe(1400)
    expect(editor.current.totalEffectiveAreaSqFt).toBe(476)
    expect(summary.current.roomBlocks[0]?.roomTotal).toBe(1090)
    expect(summary.current.roomBlocks[1]?.scopeRows.map((scope) => scope.kind)).toEqual([
      'walls',
      'ceilings',
    ])
    expect(summary.current.priceBreakdownRows).toEqual([
      { label: 'Base Estimate / Pre-policy total', value: '$1,365' },
      { label: 'Labor Adjustment', value: '$15' },
      { label: 'Job Minimum', value: '$20' },
    ])
  })

  it('uses persisted trim paint cost in summary paint rows when pricing summary trim cost is stale', () => {
    const { fixture } = createEditorDerivedHarness()
    const data = {
      ...fixture.summaryData,
      trim_paint: {
        paint_product_id: 'P-TRIM',
        paint_product_label: 'Trim Paint',
        gallons: 1,
        quarts: 2,
        normalized_gallons: 1.5,
        paint_cost: 45,
      },
      pricing_summary: fixture.summaryData.pricing_summary
        ? {
            ...fixture.summaryData.pricing_summary,
            trimPaintMaterialCost: 0,
          }
        : null,
    }

    const { result } = renderHook(() =>
      useEstimateV2SummaryDerived({
        data,
        job: fixture.job,
        jobSettingsDraft: {
          dayhours: fixture.jobSettingsDraft.dayhours,
          laborRate: fixture.jobSettingsDraft.laborRate,
        },
      })
    )

    expect(result.current.paintSupplyRows).toContainEqual({
      label: 'Trim paint - Trim Paint',
      value: '$45',
    })
    expect(result.current.paintSuppliesTotal).toBe(
      (data.pricing_summary?.wallPaintMaterialCost ?? 0) +
        (data.pricing_summary?.ceilingPaintMaterialCost ?? 0) +
        45 +
        (data.pricing_summary?.supplyCost ?? 0)
    )
  })
})
