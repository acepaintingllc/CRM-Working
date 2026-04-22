import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEstimateV2DerivedState } from '../useEstimateV2DerivedState'
import { createMixedEstimateV2Fixture } from '../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'

function createDerivedParams() {
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
      validationIssues: ['R001: Missing optional note', 'R002: Missing paint product'],
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

describe('useEstimateV2DerivedState', () => {
  it('builds stable mixed-estimate derived output from the canonical fixture', () => {
    const { collections, meta, fixture } = createDerivedParams()

    const { result } = renderHook(() => useEstimateV2DerivedState({ collections, meta }))

    expect(result.current.roomModeById.get('R001')).toBe('RECT')
    expect(result.current.roomModeById.get('R002')).toBe('SEG')
    expect(result.current.roomScopeByRoomId.get('R002')?.map((scope) => scope.id)).toEqual([
      'wall-r002-main',
      'wall-r002-excluded',
    ])
    expect(result.current.currentSnapshot).toBe(fixture.currentSnapshot)
    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.selectedRoom?.roomId).toBe('R001')
    expect(result.current.selectedRoomEffectiveSqFt).toBe(396)
    expect(result.current.selectedTrimMeasurement).toBe(44)
    expect(result.current.selectedTrimSubtotal).toBe(210)
    expect(result.current.totalEffectiveAreaSqFt).toBe(476)
    expect(result.current.wallPaintLabel).toBe('Wall Satin')
    expect(result.current.trimPaintLabel).toBe('Trim Enamel')
  })

  it('falls back safely to local preview calculations when snapshots are stale or calc payloads are malformed', () => {
    const { collections, meta } = createDerivedParams()
    meta.lastSavedSnapshot = 'stale-snapshot'
    meta.selectedRoomId = 'R002'
    meta.ceilingCalculations = { scopes: 'not-an-array' } as never
    meta.trimCalculations = { scopes: null } as never

    const { result } = renderHook(() => useEstimateV2DerivedState({ collections, meta }))

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.selectedRoom?.roomId).toBe('R002')
    expect(result.current.selectedRoomEffectiveSqFt).toBe(80)
    expect(result.current.selectedCeilingEffectiveSqFt).toBeNull()
    expect(result.current.selectedTrimMeasurement).toBeNull()
    expect(result.current.wallPaintLabel).toBe('Wall Satin')
    expect(result.current.saveStatusText).toContain('Unsaved changes')
  })
})
