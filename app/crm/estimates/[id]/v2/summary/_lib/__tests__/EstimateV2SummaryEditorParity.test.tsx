import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEstimateV2DerivedState } from '../../../_state/useEstimateV2DerivedState'
import { useEstimateV2SummaryDerived } from '../useEstimateV2SummaryDerived'
import { createMixedEstimateV2Fixture } from '../../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'

function createEditorDerivedHarness() {
  const fixture = createMixedEstimateV2Fixture()

  return {
    fixture,
    collections: {
      rooms: fixture.rooms,
      setRooms: vi.fn(),
      scopes: fixture.scopes,
      setScopes: vi.fn(),
      segments: fixture.segments,
      setSegments: vi.fn(),
      roomFlags: fixture.roomFlags,
      setRoomFlags: vi.fn(),
      ceilingScopes: fixture.ceilingScopes,
      setCeilingScopes: vi.fn(),
      ceilingSegments: fixture.ceilingSegments,
      setCeilingSegments: vi.fn(),
      trimScopes: fixture.trimScopes,
      setTrimScopes: vi.fn(),
    },
    meta: {
      loading: false,
      setLoading: vi.fn(),
      saving: false,
      setSaving: vi.fn(),
      estimate: fixture.estimate,
      setEstimate: vi.fn(),
      job: fixture.job,
      setJob: vi.fn(),
      catalogs: fixture.catalogs,
      setCatalogs: vi.fn(),
      wallCalculations: fixture.wallCalculations,
      setWallCalculations: vi.fn(),
      ceilingCalculations: fixture.ceilingCalculations,
      setCeilingCalculations: vi.fn(),
      trimCalculations: fixture.trimCalculations,
      setTrimCalculations: vi.fn(),
      selectedRoomId: 'R001',
      setSelectedRoomId: vi.fn(),
      error: null,
      setError: vi.fn(),
      validationIssues: ['R002: Missing paint product'],
      setValidationIssues: vi.fn(),
      lastSavedSnapshot: fixture.currentSnapshot,
      setLastSavedSnapshot: vi.fn(),
      saveStatus: 'saved' as const,
      setSaveStatus: vi.fn(),
      autoSaveHint: null,
      setAutoSaveHint: vi.fn(),
      settingsOpen: false,
      setSettingsOpen: vi.fn(),
      jobDefaultsOpen: false,
      setJobDefaultsOpen: vi.fn(),
      jobSettingsDraft: fixture.jobSettingsDraft,
      setJobSettingsDraft: vi.fn(),
      orgJobProductDefaults: fixture.orgJobProductDefaults,
      setOrgJobProductDefaults: vi.fn(),
      customerDraft: {
        customerId: fixture.job.customer_id ?? '',
        name: fixture.job.customer_name ?? '',
        email: fixture.job.customer_email ?? '',
        phone: fixture.job.customer_phone ?? '',
        address: fixture.job.customer_address ?? '',
      },
      setCustomerDraft: vi.fn(),
      debugMeta: {
        dirtySource: null,
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      },
      setDebugMeta: vi.fn(),
    },
  }
}

describe('Estimate V2 editor/summary parity', () => {
  it('keeps room ordering, totals, alerts, and scope ordering aligned for the shared mixed fixture', () => {
    const { fixture, collections, meta } = createEditorDerivedHarness()

    const { result: editor } = renderHook(() =>
      useEstimateV2DerivedState({
        collections,
        meta,
      })
    )

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
})
