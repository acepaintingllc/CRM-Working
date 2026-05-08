'use client'

import { useEstimateV2Editor } from '../_state/useEstimateV2Editor'
import { useEstimateV2EditorPageUiState } from '../_state/useEstimateV2EditorPageUiState'
import { useEffect } from 'react'
import { CrmConfirmDialog } from '@/app/crm/_components/CrmConfirmDialog'
import {
  buildLastOpenedQuoteRecord,
  writeLastOpenedQuote,
} from '@/lib/quotes/lastOpenedQuote'
import {
  resolveEstimateRouteFamily,
  type EstimateRouteFamily,
  type EstimateRouteFamilyKey,
} from '../../estimateRouteFamily'
import pageStyles from './EstimateV2EditorPageContent.module.css'
import { EstimateV2EditorFooterBar } from './EstimateV2EditorFooterBar'
import { EstimateV2EditorHeaderArea } from './EstimateV2EditorHeaderArea'
import { EstimateV2EditorRoomSetupArea } from './EstimateV2EditorRoomSetupArea'
import { EstimateV2EditorScopeSectionStack } from './EstimateV2EditorScopeSectionStack'
import { EstimateV2SettingsDrawer } from './EstimateV2SettingsDrawer'
import { EstimateV2Sidebar } from './EstimateV2Sidebar'
import { EstimateV2SummaryRail } from './EstimateV2SummaryRail'
import { EstimateV2UnsavedNavigationDialog } from './EstimateV2UnsavedNavigationDialog'
import { estimateV2EditorPageStyles } from './estimateV2EditorPageStyles'
import { useEstimateV2SidebarCollapse } from './useEstimateV2SidebarCollapse'
import { ESTIMATE_V2_SAVE_FAILURE_MESSAGE } from '@/lib/estimator/v2WallsAutosave'

const FATAL_EDITOR_LOAD_TITLE = "We couldn't load this editor"
const FATAL_EDITOR_LOAD_MESSAGE =
  'Try again. If this keeps happening, go back and reopen this page.'
const CATALOGS_LOAD_WARNING_TITLE = "Rates and products couldn't be loaded"
const CATALOGS_LOAD_WARNING_MESSAGE =
  'Some choices may be unavailable until you try again.'

export function EstimateV2EditorPageContent({
  estimateId,
  routeFamily,
  routeFamilyKey = 'estimate',
}: {
  estimateId?: string
  routeFamily?: EstimateRouteFamily
  routeFamilyKey?: EstimateRouteFamilyKey
}) {
  const resolvedRouteFamily = routeFamily ?? resolveEstimateRouteFamily(routeFamilyKey)
  const {
    pageVm,
    headerVm,
    summaryVm,
    roomVm,
    wallsVm,
    ceilingsVm,
    trimVm,
    doorsVm,
    jobSettingsVm,
    saveVm,
    navigationVm,
    navigationActions,
    reloadCatalogs,
    reloadWorkspace,
    destructiveConfirmVm,
    destructiveConfirmActions,
    toDisplayNumber,
  } = useEstimateV2Editor({ estimateId, routeFamily: resolvedRouteFamily })

  useEffect(() => {
    const record = buildLastOpenedQuoteRecord(headerVm.resumeRecord)
    if (!record) return
    writeLastOpenedQuote(window.localStorage, record)
  }, [headerVm.resumeRecord])

  const selectedRoom = roomVm.selectedRoom
  const uiState = useEstimateV2EditorPageUiState({
    selectedRoomId: selectedRoom?.roomId,
    roomScopeByRoomId: roomVm.roomScopeByRoomId,
    roomCeilingScopeByRoomId: roomVm.roomCeilingScopeByRoomId,
    roomDoorScopeByRoomId: roomVm.roomDoorScopeByRoomId ?? new Map(),
    toggleWallsInclude: wallsVm.toggleRoomInclude,
    toggleCeilingsInclude: ceilingsVm.toggleRoomInclude,
    toggleDoorsInclude: doorsVm.toggleRoomInclude,
  })
  const sidebarCollapse = useEstimateV2SidebarCollapse()
  const fatalLoadErrorMessage =
    pageVm.error && !pageVm.loading && !headerVm.resumeRecord.estimate
      ? pageVm.error.message
      : null
  const visiblePageErrorMessage =
    pageVm.error && saveVm.saveStatus === 'error'
      ? ESTIMATE_V2_SAVE_FAILURE_MESSAGE
      : pageVm.error?.message ?? null

  if (fatalLoadErrorMessage) {
    return (
      <div className={`${pageStyles.root} ace-v2-shell`} style={estimateV2EditorPageStyles.page}>
        <EstimateV2EditorHeaderArea
          styles={estimateV2EditorPageStyles}
          headerVm={headerVm}
          onBack={navigationActions.requestBackNavigation}
        />
        <main className="estimate-v2-workspace-main" style={{ display: 'grid', gap: 14 }}>
          <div
            role="alert"
            aria-live="assertive"
            style={{
              ...estimateV2EditorPageStyles.panel,
              borderColor: 'rgba(248,113,113,0.28)',
              background: 'rgba(127,29,29,0.18)',
              color: '#fecaca',
            }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'calc(18px + 4pt)', fontWeight: 600 }}>
                  {FATAL_EDITOR_LOAD_TITLE}
                </div>
                <p style={{ margin: '6px 0 0', color: '#fee2e2' }}>
                  {FATAL_EDITOR_LOAD_MESSAGE}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={reloadWorkspace}
                  style={{
                    borderRadius: 10,
                    border: '1px solid rgba(254,202,202,0.45)',
                    background: '#fee2e2',
                    color: '#7f1d1d',
                    fontWeight: 600,
                    padding: '10px 16px',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={`${pageStyles.root} ace-v2-shell`} style={estimateV2EditorPageStyles.page}>
      <EstimateV2EditorHeaderArea
        styles={estimateV2EditorPageStyles}
        headerVm={headerVm}
        onBack={navigationActions.requestBackNavigation}
      />

      <div
        style={{
          ...estimateV2EditorPageStyles.shell,
          gridTemplateColumns: sidebarCollapse.collapsed ? '48px minmax(0, 1fr)' : 'minmax(240px, 320px) minmax(0, 1fr)',
        }}
        className="ace-v2-rooms-layout walls-v2-shell"
      >
        <EstimateV2Sidebar
          styles={estimateV2EditorPageStyles}
          roomVm={roomVm}
          jobSettingsVm={jobSettingsVm}
          toDisplayNumber={toDisplayNumber}
          collapsed={sidebarCollapse.collapsed}
          onCollapse={sidebarCollapse.collapseSidebar}
          onExpand={sidebarCollapse.expandSidebar}
        />

        <main className="estimate-v2-workspace-main" style={{ display: 'grid', gap: 14, paddingBottom: 88 }}>
          {pageVm.catalogsError && (
            <div
              role="status"
              aria-live="polite"
              style={{
                ...estimateV2EditorPageStyles.panel,
                borderColor: 'rgba(250,204,21,0.28)',
                background: 'rgba(120,53,15,0.16)',
                color: '#fde68a',
              }}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 'calc(16px + 4pt)', fontWeight: 600 }}>
                    {CATALOGS_LOAD_WARNING_TITLE}
                  </div>
                  <p style={{ margin: '6px 0 0', color: '#fef3c7' }}>
                    {CATALOGS_LOAD_WARNING_MESSAGE}
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => void reloadCatalogs()}
                    disabled={pageVm.catalogsReloading}
                    style={{
                      borderRadius: 10,
                      border: '1px solid rgba(250,204,21,0.38)',
                      background: pageVm.catalogsReloading ? 'rgba(250,204,21,0.18)' : '#fef3c7',
                      color: '#78350f',
                      fontWeight: 600,
                      padding: '10px 16px',
                      cursor: pageVm.catalogsReloading ? 'default' : 'pointer',
                    }}
                  >
                    {pageVm.catalogsReloading ? 'Retrying catalogs...' : 'Retry catalogs'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {pageVm.configurationWarning && (
            <div
              role="status"
              aria-live="polite"
              style={{
                ...estimateV2EditorPageStyles.panel,
                borderColor: 'rgba(251,191,36,0.28)',
                background: 'rgba(113,63,18,0.2)',
                color: '#fde68a',
              }}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 'calc(16px + 4pt)', fontWeight: 600 }}>
                    {pageVm.configurationWarning.title}
                  </div>
                  <p style={{ margin: '6px 0 0', color: '#fef3c7' }}>
                    {pageVm.configurationWarning.detail}
                  </p>
                </div>
                <div style={{ color: '#fde68a' }}>{pageVm.configurationWarning.fixHint}</div>
              </div>
            </div>
          )}

          {visiblePageErrorMessage && (
            <div role="alert" aria-live="assertive" style={{ ...estimateV2EditorPageStyles.panel, borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
              {visiblePageErrorMessage}
            </div>
          )}

          {pageVm.validationIssues.length > 0 && (
            <div style={estimateV2EditorPageStyles.panel}>
              <div style={estimateV2EditorPageStyles.mono}>Validation</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {pageVm.validationIssues.map((issue, index) => (
                  <div key={`${issue}:${index}`} style={{ color: '#f9e2b7', fontSize: 'calc(14px + 4pt)' }}>
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
                  doorsVm={doorsVm}
                  onToggleWallInclude={uiState.toggleRoomWallInclude}
                  onToggleCeilingInclude={uiState.toggleRoomCeilingInclude}
                  onToggleDoorInclude={uiState.toggleRoomDoorInclude}
                  toDisplayNumber={toDisplayNumber}
                />

                <EstimateV2EditorScopeSectionStack
                  styles={estimateV2EditorPageStyles}
                  roomVm={roomVm}
                  summaryVm={summaryVm}
                  wallsVm={wallsVm}
                  ceilingsVm={ceilingsVm}
                  trimVm={trimVm}
                  doorsVm={doorsVm}
                  wallsSectionRef={uiState.wallsSectionRef}
                  ceilingsSectionRef={uiState.ceilingsSectionRef}
                  trimSectionRef={uiState.trimSectionRef}
                  doorsSectionRef={uiState.doorsSectionRef}
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
                  openTrimAdvanced={uiState.openTrimAdvanced}
                  setOpenTrimAdvanced={uiState.setOpenTrimAdvanced}
                  openDoorsSection={uiState.openDoorsSection}
                  setOpenDoorsSection={uiState.setOpenDoorsSection}
                  openDoorsAdvanced={uiState.openDoorsAdvanced}
                  setOpenDoorsAdvanced={uiState.setOpenDoorsAdvanced}
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

      <CrmConfirmDialog
        isOpen={destructiveConfirmVm.isOpen}
        labelledBy={destructiveConfirmVm.labelledBy}
        title={destructiveConfirmVm.title}
        description={destructiveConfirmVm.description}
        closeLabel={destructiveConfirmVm.closeLabel}
        warning={destructiveConfirmVm.warning}
        info={destructiveConfirmVm.info}
        confirmLabel={destructiveConfirmVm.confirmLabel}
        confirmAriaLabel={destructiveConfirmVm.confirmAriaLabel}
        onConfirm={() => void destructiveConfirmActions.confirm()}
        onCancel={destructiveConfirmActions.cancel}
      />
      <EstimateV2UnsavedNavigationDialog {...navigationVm.unsavedDialogProps} />
    </div>
  )
}
