'use client'

import { useEstimateV2Editor } from '../_state/useEstimateV2Editor'
import { useEstimateV2EditorPageUiState } from '../_state/useEstimateV2EditorPageUiState'
import { useCallback } from 'react'
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
import { estimateV2EditorPageStyles } from './estimateV2EditorPageStyles'

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
  } = useEstimateV2Editor({ estimateId, routeFamily })

  const confirmNavigation = useCallback(() => {
    if (!saveVm.dirty) return true
    return window.confirm('You have unsaved changes. Leave this workspace?')
  }, [saveVm.dirty])

  const selectedRoom = roomVm.selectedRoom
  const uiState = useEstimateV2EditorPageUiState({
    selectedRoomId: selectedRoom?.roomId,
    roomScopeByRoomId: roomVm.roomScopeByRoomId,
    roomCeilingScopeByRoomId: roomVm.roomCeilingScopeByRoomId,
    toggleWallsInclude: wallsVm.toggleRoomInclude,
    toggleCeilingsInclude: ceilingsVm.toggleRoomInclude,
  })

  return (
    <div className={`${pageStyles.root} ace-v2-shell`} style={estimateV2EditorPageStyles.page}>
      <EstimateV2EditorHeaderArea
        styles={estimateV2EditorPageStyles}
        estimateId={estimateId}
        routeFamily={routeFamily}
        headerVm={headerVm}
        saveVm={saveVm}
        confirmNavigation={confirmNavigation}
      />

      <div style={estimateV2EditorPageStyles.shell} className="ace-v2-rooms-layout walls-v2-shell">
        <EstimateV2Sidebar
          styles={estimateV2EditorPageStyles}
          roomVm={roomVm}
          jobSettingsVm={jobSettingsVm}
          toDisplayNumber={toDisplayNumber}
        />

        <main style={{ display: 'grid', gap: 14, paddingBottom: 88 }}>
          {pageVm.error && (
            <div role="alert" aria-live="assertive" style={{ ...estimateV2EditorPageStyles.panel, borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
              {pageVm.error.message}
            </div>
          )}

          {pageVm.validationIssues.length > 0 && (
            <div style={estimateV2EditorPageStyles.panel}>
              <div style={estimateV2EditorPageStyles.mono}>Validation</div>
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
            <div role="status" aria-live="polite" aria-label="Loading quote workspace" style={estimateV2EditorPageStyles.panel}>
              Loading workspace...
            </div>
          )}

          {!pageVm.loading && !selectedRoom && (
            <div style={estimateV2EditorPageStyles.panel}>
              <div style={{ fontSize: 'calc(16px + 4pt)', color: 'var(--v2-ink-3)' }}>
                {pageVm.emptySelectionMessage}
              </div>
            </div>
          )}

          {!pageVm.loading && selectedRoom && (
            <div className="room-workspace">
              <div className="room-main-col">
                <EstimateV2EditorRoomSetupArea
                  styles={estimateV2EditorPageStyles}
                  roomVm={roomVm}
                  summaryVm={summaryVm}
                  wallsVm={wallsVm}
                  ceilingsVm={ceilingsVm}
                  trimVm={trimVm}
                  onToggleWallInclude={uiState.toggleRoomWallInclude}
                  onToggleCeilingInclude={uiState.toggleRoomCeilingInclude}
                  toDisplayNumber={toDisplayNumber}
                />

                <EstimateV2EditorScopeSectionStack
                  styles={estimateV2EditorPageStyles}
                  roomVm={roomVm}
                  summaryVm={summaryVm}
                  wallsVm={wallsVm}
                  ceilingsVm={ceilingsVm}
                  trimVm={trimVm}
                  wallsSectionRef={uiState.wallsSectionRef}
                  ceilingsSectionRef={uiState.ceilingsSectionRef}
                  trimSectionRef={uiState.trimSectionRef}
                  openWallsSection={uiState.openWallsSection}
                  setOpenWallsSection={uiState.setOpenWallsSection}
                  openAdvanced={uiState.openAdvanced}
                  setOpenAdvanced={uiState.setOpenAdvanced}
                  openCeilingSection={uiState.openCeilingSection}
                  setOpenCeilingSection={uiState.setOpenCeilingSection}
                  openCeilingAdvanced={uiState.openCeilingAdvanced}
                  setOpenCeilingAdvanced={uiState.setOpenCeilingAdvanced}
                  openTrimSection={uiState.openTrimSection}
                  setOpenTrimSection={uiState.setOpenTrimSection}
                  toDisplayNumber={toDisplayNumber}
                />
              </div>

              <EstimateV2SummaryRail
                styles={estimateV2EditorPageStyles}
                vm={summaryVm}
                onFocusSection={uiState.focusRoomSection}
              />
            </div>
          )}
        </main>
      </div>

      <EstimateV2EditorFooterBar
        styles={estimateV2EditorPageStyles}
        pageVm={pageVm}
        saveVm={saveVm}
        summaryVm={summaryVm}
      />

      <EstimateV2SettingsDrawer styles={estimateV2EditorPageStyles} jobSettingsVm={jobSettingsVm} />
    </div>
  )
}
