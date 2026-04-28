'use client'

import type {
  EstimateV2EditorRoomVm,
  EstimateV2EditorSummaryVm,
  EstimateV2EditorTrimVm,
  EstimateV2EditorWallsVm,
  EstimateV2EditorCeilingsVm,
} from '../_state/estimateV2EditorTypes'
import type { EstimateV2EditorPageStyles } from './estimateV2EditorPageStyles'
import { EstimateV2ConditionsPanel } from './EstimateV2ConditionsPanel'
import { EstimateV2RoomHeader } from './EstimateV2RoomHeader'

const ROOM_LEVEL_MODIFIER_CONDITION_IDS = new Set(['ROOM_FURNISHED'])

export function EstimateV2EditorRoomSetupArea({
  styles,
  roomVm,
  summaryVm,
  wallsVm,
  ceilingsVm,
  trimVm,
  onToggleWallInclude,
  onToggleCeilingInclude,
  toDisplayNumber,
}: {
  styles: EstimateV2EditorPageStyles
  roomVm: EstimateV2EditorRoomVm
  summaryVm: EstimateV2EditorSummaryVm
  wallsVm: EstimateV2EditorWallsVm
  ceilingsVm: EstimateV2EditorCeilingsVm
  trimVm: EstimateV2EditorTrimVm
  onToggleWallInclude: (roomId: string) => void
  onToggleCeilingInclude: (roomId: string) => void
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const selectedRoom = roomVm.selectedRoom

  if (!selectedRoom) return null

  const roomConditionCatalog = (roomVm.conditionModifiers ?? []).filter(
    (condition) => !ROOM_LEVEL_MODIFIER_CONDITION_IDS.has(condition.id)
  )
  const roomConditionSelections = Object.fromEntries(
    Object.entries(selectedRoom.conditionSelections ?? {}).filter(
      ([conditionId]) => !ROOM_LEVEL_MODIFIER_CONDITION_IDS.has(conditionId.toUpperCase())
    )
  )

  return (
    <>
      <EstimateV2RoomHeader styles={styles} roomVm={roomVm} toDisplayNumber={toDisplayNumber} />

      {roomConditionCatalog.some((condition) => condition.scope === 'room' && condition.active !== 'N') ? (
        <EstimateV2ConditionsPanel
          title="Room Conditions"
          scope="room"
          catalog={roomConditionCatalog}
          selections={roomConditionSelections}
          onChange={roomVm.setSelectedRoomCondition ?? (() => undefined)}
          styles={styles}
          collapsible={false}
        />
      ) : null}

      <div className="scope-chip-row">
        <button
          type="button"
          className={wallsVm.wallsIncluded ? 'scope-pill-active' : ''}
          onClick={() => onToggleWallInclude(selectedRoom.roomId)}
          style={{
            ...styles.scopePill,
            cursor: 'pointer',
            borderColor: wallsVm.wallsIncluded ? 'rgba(134,239,172,0.32)' : 'var(--v2-line)',
            background: wallsVm.wallsIncluded ? 'rgba(74,222,128,0.08)' : 'transparent',
            color: wallsVm.wallsIncluded ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
          }}
        >
          {summaryVm.scopeToggleLabels.walls}
        </button>
        <button
          type="button"
          className={ceilingsVm.ceilingsIncluded ? 'scope-pill-active' : ''}
          onClick={() => onToggleCeilingInclude(selectedRoom.roomId)}
          style={{
            ...styles.scopePill,
            cursor: 'pointer',
            borderColor: ceilingsVm.ceilingsIncluded
              ? 'rgba(134,239,172,0.32)'
              : 'var(--v2-line)',
            background: ceilingsVm.ceilingsIncluded
              ? 'rgba(74,222,128,0.08)'
              : 'transparent',
            color: ceilingsVm.ceilingsIncluded ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
          }}
        >
          {summaryVm.scopeToggleLabels.ceilings}
        </button>
        <button
          type="button"
          className={trimVm.trimsIncluded ? 'scope-pill-active' : ''}
          onClick={() => trimVm.toggleRoomInclude(selectedRoom.roomId)}
          style={{
            ...styles.scopePill,
            cursor: 'pointer',
            borderColor: trimVm.trimsIncluded ? 'rgba(134,239,172,0.32)' : 'var(--v2-line)',
            background: trimVm.trimsIncluded ? 'rgba(74,222,128,0.08)' : 'transparent',
            color: trimVm.trimsIncluded ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
          }}
        >
          {summaryVm.scopeToggleLabels.trim}
        </button>
      </div>
    </>
  )
}
