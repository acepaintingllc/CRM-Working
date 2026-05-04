'use client'

import { useEstimateV2Editor } from '../_state/useEstimateV2Editor'
import { useEstimateV2EditorPageUiState } from '../_state/useEstimateV2EditorPageUiState'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { filterNonBlockingEstimateV2ValidationIssues } from '../_state/estimateV2EditorSaveOrchestration'
import { shouldGuardEstimateV2Navigation } from '../_state/estimateV2NavigationGuard'
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
  const router = useRouter()
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null)
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
    toDisplayNumber,
  } = useEstimateV2Editor({ estimateId, routeFamily: resolvedRouteFamily })
  const shouldGuardNavigation = shouldGuardEstimateV2Navigation({
    loading: pageVm.loading,
    saving: pageVm.saving,
    saveVm,
  })
  const shouldGuardNavigationRef = useRef(shouldGuardNavigation)

  useEffect(() => {
    shouldGuardNavigationRef.current = shouldGuardNavigation
  }, [shouldGuardNavigation])

  const requestBackNavigation = useCallback(() => {
    if (shouldGuardNavigation) {
      setPendingNavigationHref(resolvedRouteFamily.listHref)
      return
    }
    router.push(resolvedRouteFamily.listHref)
  }, [resolvedRouteFamily.listHref, router, shouldGuardNavigation])

  const cancelBackNavigation = useCallback(() => {
    setPendingNavigationHref(null)
  }, [])

  const confirmBackNavigation = useCallback(() => {
    const href = pendingNavigationHref ?? resolvedRouteFamily.listHref
    setPendingNavigationHref(null)
    router.push(href)
  }, [pendingNavigationHref, resolvedRouteFamily.listHref, router])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!shouldGuardNavigationRef.current) return
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return

      const nextHref = `${url.pathname}${url.search}${url.hash}`
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextHref === currentHref) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setPendingNavigationHref(nextHref)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [])

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
  const validationIssues = filterNonBlockingEstimateV2ValidationIssues(pageVm.validationIssues)

  return (
    <div className={`${pageStyles.root} ace-v2-shell`} style={estimateV2EditorPageStyles.page}>
      <EstimateV2EditorHeaderArea
        styles={estimateV2EditorPageStyles}
        headerVm={headerVm}
        onBack={requestBackNavigation}
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
          {pageVm.error && (
            <div role="alert" aria-live="assertive" style={{ ...estimateV2EditorPageStyles.panel, borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
              {pageVm.error.message}
            </div>
          )}

          {validationIssues.length > 0 && (
            <div style={estimateV2EditorPageStyles.panel}>
              <div style={estimateV2EditorPageStyles.mono}>Validation</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {validationIssues.map((issue, index) => (
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
        estimateId={estimateId}
        routeFamily={resolvedRouteFamily}
        pageVm={pageVm}
        saveVm={saveVm}
        summaryVm={summaryVm}
      />

      <EstimateV2SettingsDrawer styles={estimateV2EditorPageStyles} jobSettingsVm={jobSettingsVm} />

      <EstimateV2UnsavedNavigationDialog
        isOpen={Boolean(pendingNavigationHref) && shouldGuardNavigation}
        onStay={cancelBackNavigation}
        onLeave={confirmBackNavigation}
      />
    </div>
  )
}
