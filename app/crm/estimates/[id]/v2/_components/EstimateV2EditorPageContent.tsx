'use client'

import { useEstimateV2EditorState } from '../_state/useEstimateV2EditorState'
import type { ScopeKind } from '@/lib/estimator/scopeKinds'
import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  estimateRouteFamily,
  type EstimateRouteFamily,
} from '../../estimateRouteFamily'
import pageStyles from './EstimateV2EditorPageContent.module.css'
import { EstimateV2EditorFooterBar } from './EstimateV2EditorFooterBar'
import { EstimateV2EditorHeaderArea } from './EstimateV2EditorHeaderArea'
import { EstimateV2EditorRoomSetupArea } from './EstimateV2EditorRoomSetupArea'
import { EstimateV2EditorScopeSectionStack } from './EstimateV2EditorScopeSectionStack'
import { EstimateV2SettingsDrawer } from './EstimateV2SettingsDrawer'
import { EstimateV2Sidebar } from './EstimateV2Sidebar'
import { EstimateV2SummaryRail } from './EstimateV2SummaryRail'

const S = {
  page: {
    display: 'block',
    minHeight: '100vh',
    background: 'var(--v2-bg)',
    color: 'var(--v2-ink)',
  } as CSSProperties,
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 18px',
    borderBottom: '1px solid var(--v2-line)',
    background: 'rgba(8,8,8,0.94)',
    backdropFilter: 'blur(10px)',
  } as CSSProperties,
  mono: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(9px + 4pt)',
    letterSpacing: '0.11em',
    textTransform: 'uppercase',
    color: 'var(--v2-ink-3)',
  } as CSSProperties,
  shell: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: 16,
    padding: 16,
  } as CSSProperties,
  panel: {
    border: '1px solid var(--v2-line)',
    borderRadius: 14,
    background: 'var(--v2-bg-2)',
    padding: 10,
  } as CSSProperties,
  input: {
    width: '100%',
    padding: '7px 9px',
    minHeight: 34,
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(12px + 4pt)',
  } as CSSProperties,
  textarea: {
    width: '100%',
    minHeight: 70,
    padding: '7px 9px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(12px + 4pt)',
    resize: 'vertical',
  } as CSSProperties,
  label: {
    display: 'grid',
    gap: 3,
  } as CSSProperties,
  button: {
    padding: '7px 9px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(11px + 4pt)',
    fontWeight: 700,
    cursor: 'pointer',
  } as CSSProperties,
  buttonPrimary: {
    padding: '8px 11px',
    borderRadius: 9,
    border: '1px solid rgba(134,239,172,0.36)',
    background: '#8ad39b',
    color: '#062410',
    fontSize: 'calc(12px + 4pt)',
    fontWeight: 800,
    cursor: 'pointer',
  } as CSSProperties,
  computedBig: {
    fontSize: 'calc(24px + 4pt)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: 'var(--v2-ink)',
    lineHeight: 1,
    marginTop: 4,
  } as CSSProperties,
  stepper: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--v2-line)',
    borderRadius: 9,
    background: '#111111',
    overflow: 'hidden',
    height: 34,
  } as CSSProperties,
  stepperBtn: {
    width: 28,
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: 'var(--v2-ink)',
    fontSize: 'calc(15px + 4pt)',
    fontWeight: 300,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as CSSProperties,
  stepperVal: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 'calc(12px + 4pt)',
    fontWeight: 700,
    color: 'var(--v2-ink)',
    pointerEvents: 'none' as const,
  } as CSSProperties,
  flagChip: {
    padding: '6px 8px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#0d0d0d',
    color: 'var(--v2-ink-2)',
    fontSize: 'calc(11px + 4pt)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left' as const,
    width: '100%',
  } as CSSProperties,
  scopePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    borderRadius: 20,
    fontSize: 'calc(10px + 4pt)',
    fontWeight: 600,
    border: '1px solid var(--v2-line)',
  } as CSSProperties,
  footer: {
    position: 'sticky' as const,
    bottom: 0,
    zIndex: 20,
    borderTop: '1px solid var(--v2-line)',
    background: 'rgba(8,8,8,0.96)',
    backdropFilter: 'blur(10px)',
    padding: '7px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  } as CSSProperties,
} as const

export function EstimateV2EditorPageContent({
  estimateId,
  routeFamily = estimateRouteFamily,
}: {
  estimateId?: string
  routeFamily?: EstimateRouteFamily
}) {
  const {
    pageVm,
    headerVm,
    summaryVm,
    roomVm,
    wallsVm,
    ceilingsVm,
    trimVm,
    jobSettingsVm,
    saveVm,
    toDisplayNumber,
  } = useEstimateV2EditorState({ estimateId, routeFamily })

  const wallsSectionRef = useRef<HTMLDivElement | null>(null)
  const ceilingsSectionRef = useRef<HTMLDivElement | null>(null)
  const trimSectionRef = useRef<HTMLDivElement | null>(null)
  const [openWallsSection, setOpenWallsSection] = useState<Record<string, boolean>>({})
  const [openAdvanced, setOpenAdvanced] = useState<Record<string, boolean>>({})
  const [openCeilingSection, setOpenCeilingSection] = useState<Record<string, boolean>>({})
  const [openCeilingAdvanced, setOpenCeilingAdvanced] = useState<Record<string, boolean>>({})
  const [openTrimSection, setOpenTrimSection] = useState<Record<string, boolean>>({})

  const confirmNavigation = useCallback(() => {
    if (!saveVm.dirty) return true
    return window.confirm('You have unsaved changes. Leave this workspace?')
  }, [saveVm.dirty])

  const toggleRoomWallInclude = useCallback(
    (roomId: string) => {
      const hasRoomScopes = (roomVm.roomScopeByRoomId.get(roomId)?.length ?? 0) > 0
      wallsVm.toggleRoomInclude(roomId)
      if (!hasRoomScopes) {
        setOpenWallsSection((prev) => ({ ...prev, [roomId]: true }))
      }
    },
    [roomVm.roomScopeByRoomId, wallsVm]
  )

  const toggleRoomCeilingInclude = useCallback(
    (roomId: string) => {
      const hasRoomScopes = (roomVm.roomCeilingScopeByRoomId.get(roomId)?.length ?? 0) > 0
      ceilingsVm.toggleRoomInclude(roomId)
      if (!hasRoomScopes) {
        setOpenCeilingSection((prev) => ({ ...prev, [roomId]: true }))
      }
    },
    [ceilingsVm, roomVm.roomCeilingScopeByRoomId]
  )

  const selectedRoom = roomVm.selectedRoom

  const focusRoomSection = useCallback(
    (section: ScopeKind) => {
      if (!selectedRoom) return
      const roomId = selectedRoom.roomId
      const ref =
        section === 'walls'
          ? wallsSectionRef
          : section === 'ceilings'
            ? ceilingsSectionRef
            : trimSectionRef
      if (section === 'walls') {
        setOpenWallsSection((prev) => ({ ...prev, [roomId]: true }))
      } else if (section === 'ceilings') {
        setOpenCeilingSection((prev) => ({ ...prev, [roomId]: true }))
      } else {
        setOpenTrimSection((prev) => ({ ...prev, [roomId]: true }))
      }
      window.setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 40)
    },
    [selectedRoom]
  )

  return (
    <div className={`${pageStyles.root} ace-v2-shell`} style={S.page}>
      <EstimateV2EditorHeaderArea
        styles={S}
        estimateId={estimateId}
        routeFamily={routeFamily}
        headerVm={headerVm}
        saveVm={saveVm}
        confirmNavigation={confirmNavigation}
      />

      <div style={S.shell} className="ace-v2-rooms-layout walls-v2-shell">
        <EstimateV2Sidebar
          styles={S}
          roomVm={roomVm}
          jobSettingsVm={jobSettingsVm}
          toDisplayNumber={toDisplayNumber}
        />

        <main style={{ display: 'grid', gap: 14, paddingBottom: 88 }}>
          {pageVm.error && (
            <div role="alert" aria-live="assertive" style={{ ...S.panel, borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
              {pageVm.error.message}
            </div>
          )}

          {pageVm.validationIssues.length > 1 && (
            <div style={S.panel}>
              <div style={S.mono}>Validation</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {pageVm.validationIssues.map((issue) => (
                  <div key={issue} style={{ color: '#f9e2b7', fontSize: 'calc(14px + 4pt)' }}>
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pageVm.loading && (
            <div role="status" aria-live="polite" aria-label="Loading quote workspace" style={S.panel}>
              Loading workspace...
            </div>
          )}

          {!pageVm.loading && !selectedRoom && (
            <div style={S.panel}>
              <div style={{ fontSize: 'calc(16px + 4pt)', color: 'var(--v2-ink-3)' }}>
                {pageVm.emptySelectionMessage}
              </div>
            </div>
          )}

          {!pageVm.loading && selectedRoom && (
            <div className="room-workspace">
              <div className="room-main-col">
                <EstimateV2EditorRoomSetupArea
                  styles={S}
                  roomVm={roomVm}
                  summaryVm={summaryVm}
                  wallsVm={wallsVm}
                  ceilingsVm={ceilingsVm}
                  trimVm={trimVm}
                  onToggleWallInclude={toggleRoomWallInclude}
                  onToggleCeilingInclude={toggleRoomCeilingInclude}
                  toDisplayNumber={toDisplayNumber}
                />

                <EstimateV2EditorScopeSectionStack
                  styles={S}
                  roomVm={roomVm}
                  summaryVm={summaryVm}
                  wallsVm={wallsVm}
                  ceilingsVm={ceilingsVm}
                  trimVm={trimVm}
                  wallsSectionRef={wallsSectionRef}
                  ceilingsSectionRef={ceilingsSectionRef}
                  trimSectionRef={trimSectionRef}
                  openWallsSection={openWallsSection}
                  setOpenWallsSection={setOpenWallsSection}
                  openAdvanced={openAdvanced}
                  setOpenAdvanced={setOpenAdvanced}
                  openCeilingSection={openCeilingSection}
                  setOpenCeilingSection={setOpenCeilingSection}
                  openCeilingAdvanced={openCeilingAdvanced}
                  setOpenCeilingAdvanced={setOpenCeilingAdvanced}
                  openTrimSection={openTrimSection}
                  setOpenTrimSection={setOpenTrimSection}
                  toDisplayNumber={toDisplayNumber}
                />
              </div>

              <EstimateV2SummaryRail styles={S} vm={summaryVm} onFocusSection={focusRoomSection} />
            </div>
          )}
        </main>
      </div>

      <EstimateV2EditorFooterBar styles={S} pageVm={pageVm} saveVm={saveVm} summaryVm={summaryVm} />

      <EstimateV2SettingsDrawer styles={S} jobSettingsVm={jobSettingsVm} />
    </div>
  )
}
