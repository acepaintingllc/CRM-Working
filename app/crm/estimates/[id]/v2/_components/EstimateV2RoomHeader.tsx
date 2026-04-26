'use client'

import type { CSSProperties } from 'react'
import type { EstimateV2EditorRoomVm } from '../_state/estimateV2EditorTypes'
import { buildRoomFlagChipVms } from '../_lib/estimateV2EditorPresentation'
import {
  Field,
  RoomHeaderSetup,
  RoomLevelModifiers,
  type SharedStyles,
} from './EstimateV2EditorPrimitives'

type RoomHeaderStyles = SharedStyles & {
  input: CSSProperties
  button: CSSProperties
  mono: CSSProperties
  computedBig: CSSProperties
  flagChip: CSSProperties
}

export function EstimateV2RoomHeader({
  styles,
  roomVm,
  toDisplayNumber,
}: {
  styles: RoomHeaderStyles
  roomVm: EstimateV2EditorRoomVm
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const room = roomVm.selectedRoom
  if (!room) return null
  const roomFlagChips = buildRoomFlagChipVms({
    roomId: room.roomId,
    flags: roomVm.roomFlagsCatalog,
    selectedFlags: roomVm.roomFlags,
  })

  return (
    <>
      <RoomHeaderSetup styles={styles}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={styles.mono}>Room Setup</div>
            <h2 style={{ fontSize: 'calc(18px + 4pt)', fontWeight: 800, letterSpacing: '-0.02em', margin: '3px 0 0' }}>
              {room.roomId} - {room.roomName || 'New room'}
            </h2>
          </div>
          {room.roomTypeId ? (
            <span style={{ ...styles.mono, border: '1px solid var(--v2-line)', borderRadius: 8, padding: '3px 8px' }}>
              template: {roomVm.roomTypeOptions.find((type) => type.id === room.roomTypeId)?.label ?? room.roomTypeId}
            </span>
          ) : null}
        </div>

        <div className="room-setup-grid">
          <Field label="Room Name" styles={styles}>
            <input
              value={room.roomName}
              onChange={(event) => roomVm.updateSelectedRoom({ roomName: event.target.value })}
              style={styles.input}
              placeholder="e.g. Main Suite"
            />
          </Field>
          <Field label="Room Type" styles={styles}>
            <select
              value={room.roomTypeId}
              onChange={(event) => roomVm.updateSelectedRoom({ roomTypeId: event.target.value })}
              style={styles.input}
            >
              {roomVm.roomTypeOptions.length === 0 ? <option value="">Room type catalog unavailable</option> : <option value="">-- select type --</option>}
              {roomVm.roomTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="room-setup-actions">
            <button
              type="button"
              onClick={roomVm.deleteSelectedRoom}
              style={{ ...styles.button, color: 'var(--v2-red)', background: 'transparent', borderColor: 'rgba(248,113,113,0.24)' }}
            >
              Remove room
            </button>
          </div>
        </div>

        <div className="geometry-primary-grid">
          <Field label="Geometry Mode" styles={styles}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['RECT', 'SEG'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={roomVm.selectedRoomGeometryMode === mode}
                  onClick={() => roomVm.switchSelectedRoomGeometryMode(mode)}
                  style={{
                    ...styles.button,
                    flex: 1,
                    cursor: roomVm.selectedRoomGeometryMode === mode ? 'default' : 'pointer',
                    borderColor: roomVm.selectedRoomGeometryMode === mode ? 'rgba(134,239,172,0.34)' : 'var(--v2-line)',
                    background: roomVm.selectedRoomGeometryMode === mode ? 'rgba(74,222,128,0.08)' : '#111111',
                    color: roomVm.selectedRoomGeometryMode === mode ? 'var(--v2-green-2)' : 'var(--v2-ink)',
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Length (in)" styles={styles}>
            <input value={room.lengthIn} onChange={(event) => roomVm.updateSelectedRoomDimensions('lengthIn', event.target.value)} style={styles.input} placeholder="0" type="number" min="0" />
          </Field>
          <Field label="Width (in)" styles={styles}>
            <input value={room.widthIn} onChange={(event) => roomVm.updateSelectedRoomDimensions('widthIn', event.target.value)} style={styles.input} placeholder="0" type="number" min="0" />
          </Field>
          <Field label="Height (in)" styles={styles}>
            <input value={room.heightIn} onChange={(event) => roomVm.updateSelectedRoomDimensions('heightIn', event.target.value)} style={styles.input} placeholder="0" type="number" min="0" />
          </Field>
          <div className={roomVm.selectedRoomEffectiveSqFt != null ? 'wallsqft-box' : 'wallsqft-box-empty'}>
            <div style={styles.mono}>Wall Sq Ft</div>
            <div style={{ ...styles.computedBig, color: roomVm.selectedRoomEffectiveSqFt != null ? 'var(--v2-green-2)' : 'var(--v2-ink-3)' }}>
              {toDisplayNumber(roomVm.selectedRoomEffectiveSqFt)}
            </div>
          </div>
        </div>
      </RoomHeaderSetup>

      {roomVm.roomFlagsEnabled ? (
        <RoomLevelModifiers styles={styles}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>Room-Level Modifiers</div>
            <span style={{ ...styles.mono, color: 'var(--v2-ink-3)' }}>room-wide defaults and conditions</span>
          </div>
          <div className="modifier-grid">
            {roomFlagChips.map((flag) => {
              return (
                <button
                  key={flag.id}
                  type="button"
                  className={`flag-chip${flag.active ? ' flag-chip-active' : ''}`}
                  onClick={() => roomVm.toggleSelectedRoomFlag(flag.id)}
                  title={flag.modifierHint || undefined}
                  aria-pressed={flag.active}
                  style={{
                    ...styles.flagChip,
                    borderColor: flag.active ? 'rgba(134,239,172,0.46)' : 'var(--v2-line)',
                    background: flag.active ? 'rgba(74,222,128,0.12)' : '#0d0d0d',
                    color: flag.active ? 'var(--v2-green-2)' : 'var(--v2-ink-2)',
                  }}
                >
                  <span className="flag-chip-label" style={{ fontWeight: flag.active ? 700 : 500 }}>{flag.label}</span>
                </button>
              )
            })}
          </div>
        </RoomLevelModifiers>
      ) : null}
    </>
  )
}
