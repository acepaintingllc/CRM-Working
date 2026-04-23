'use client'

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  ScopeAccordionList,
  ScopeSummaryChips,
} from './EstimateV2EditorPrimitives'
import { EstimateV2CeilingsSection } from './EstimateV2CeilingsSection'
import { EstimateV2CeilingsSectionBody } from './EstimateV2CeilingsSectionBody'
import { EstimateV2TrimSection } from './EstimateV2TrimSection'
import { EstimateV2TrimSectionBody } from './EstimateV2TrimSectionBody'
import { EstimateV2WallsSection } from './EstimateV2WallsSection'
import { EstimateV2WallsSectionBody } from './EstimateV2WallsSectionBody'
import type {
  EstimateV2EditorCeilingsVm,
  EstimateV2EditorRoomVm,
  EstimateV2EditorSummaryVm,
  EstimateV2EditorTrimVm,
  EstimateV2EditorWallsVm,
} from '../_state/estimateV2EditorTypes'
import type { EstimateV2EditorPageStyles } from './estimateV2EditorPageStyles'

export function EstimateV2EditorScopeSectionStack({
  styles,
  roomVm,
  summaryVm,
  wallsVm,
  ceilingsVm,
  trimVm,
  wallsSectionRef,
  ceilingsSectionRef,
  trimSectionRef,
  openWallsSection,
  setOpenWallsSection,
  openAdvanced,
  setOpenAdvanced,
  openCeilingSection,
  setOpenCeilingSection,
  openCeilingAdvanced,
  setOpenCeilingAdvanced,
  openTrimSection,
  setOpenTrimSection,
  toDisplayNumber,
}: {
  styles: EstimateV2EditorPageStyles
  roomVm: EstimateV2EditorRoomVm
  summaryVm: EstimateV2EditorSummaryVm
  wallsVm: EstimateV2EditorWallsVm
  ceilingsVm: EstimateV2EditorCeilingsVm
  trimVm: EstimateV2EditorTrimVm
  wallsSectionRef: MutableRefObject<HTMLDivElement | null>
  ceilingsSectionRef: MutableRefObject<HTMLDivElement | null>
  trimSectionRef: MutableRefObject<HTMLDivElement | null>
  openWallsSection: Record<string, boolean>
  setOpenWallsSection: Dispatch<SetStateAction<Record<string, boolean>>>
  openAdvanced: Record<string, boolean>
  setOpenAdvanced: Dispatch<SetStateAction<Record<string, boolean>>>
  openCeilingSection: Record<string, boolean>
  setOpenCeilingSection: Dispatch<SetStateAction<Record<string, boolean>>>
  openCeilingAdvanced: Record<string, boolean>
  setOpenCeilingAdvanced: Dispatch<SetStateAction<Record<string, boolean>>>
  openTrimSection: Record<string, boolean>
  setOpenTrimSection: Dispatch<SetStateAction<Record<string, boolean>>>
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const selectedRoom = roomVm.selectedRoom

  if (!selectedRoom) return null

  const wallsRowExpanded = openWallsSection[selectedRoom.roomId] ?? true
  const ceilingsRowExpanded = openCeilingSection[selectedRoom.roomId] ?? true
  const trimsRowExpanded = openTrimSection[selectedRoom.roomId] ?? true

  return (
    <ScopeAccordionList>
      {wallsVm.wallsIncluded && (
        <EstimateV2WallsSection
          sectionRef={wallsSectionRef}
          styles={styles}
          expanded={wallsRowExpanded}
          onToggle={() =>
            setOpenWallsSection((prev) => ({
              ...prev,
              [selectedRoom.roomId]: !wallsRowExpanded,
            }))
          }
          summary={<ScopeSummaryChips chips={summaryVm.walls.chips} chipStyle={styles.scopePill} />}
        >
          <EstimateV2WallsSectionBody
            styles={styles}
            wallsVm={wallsVm}
            openAdvanced={openAdvanced}
            setOpenAdvanced={setOpenAdvanced}
            toDisplayNumber={toDisplayNumber}
          />
        </EstimateV2WallsSection>
      )}

      {ceilingsVm.ceilingsIncluded && (
        <EstimateV2CeilingsSection
          sectionRef={ceilingsSectionRef}
          styles={styles}
          expanded={ceilingsRowExpanded}
          onToggle={() =>
            setOpenCeilingSection((prev) => ({
              ...prev,
              [selectedRoom.roomId]: !ceilingsRowExpanded,
            }))
          }
          summary={
            <ScopeSummaryChips chips={summaryVm.ceilings.chips} chipStyle={styles.scopePill} />
          }
        >
          <EstimateV2CeilingsSectionBody
            styles={styles}
            ceilingsVm={ceilingsVm}
            openCeilingAdvanced={openCeilingAdvanced}
            setOpenCeilingAdvanced={setOpenCeilingAdvanced}
            switchRoomGeometryMode={roomVm.switchRoomGeometryMode}
            toDisplayNumber={toDisplayNumber}
          />
        </EstimateV2CeilingsSection>
      )}

      {trimVm.trimsIncluded && (
        <EstimateV2TrimSection
          sectionRef={trimSectionRef}
          styles={styles}
          expanded={trimsRowExpanded}
          onToggle={() =>
            setOpenTrimSection((prev) => ({
              ...prev,
              [selectedRoom.roomId]: !trimsRowExpanded,
            }))
          }
          summary={<ScopeSummaryChips chips={summaryVm.trim.chips} chipStyle={styles.scopePill} />}
        >
          <EstimateV2TrimSectionBody styles={styles} trimVm={trimVm} toDisplayNumber={toDisplayNumber} />
        </EstimateV2TrimSection>
      )}

      {!wallsVm.wallsIncluded && !ceilingsVm.ceilingsIncluded && !trimVm.trimsIncluded && (
        <div style={{ ...styles.panel, borderColor: 'var(--v2-line)', color: 'var(--v2-ink-3)' }}>
          Enable at least one scope in the room header to start entering scope-specific details.
        </div>
      )}
    </ScopeAccordionList>
  )
}
