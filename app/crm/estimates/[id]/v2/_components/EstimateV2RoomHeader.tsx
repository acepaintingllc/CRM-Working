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

function formatTotalInchesAsFeetInches(value: string): string | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  const feet = Math.floor(parsed / 12)
  const inches = parsed - feet * 12
  if (feet === 0 && inches === 0) return null
  if (feet === 0) return `${formatCompactNumber(inches)} in`
  if (inches === 0) return `${feet} ft`
  return `${feet} ft ${formatCompactNumber(inches)} in`
}

function formatCompactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
}

function wallFormulaText(
  geometryMode: 'RECT' | 'SEG',
  lengthIn: string,
  widthIn: string,
  heightIn: string,
): string | null {
  if (geometryMode === 'SEG') return 'From wall segments'
  const length = Number(lengthIn)
  const width = Number(widthIn)
  const height = Number(heightIn)
  if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(height) || length <= 0 || width <= 0 || height <= 0) {
    return null
  }
  const perimeter = 2 * (length + width)
  return `Perimeter ${formatCompactNumber(perimeter)} in x Height ${formatCompactNumber(height)} in`
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

  const lengthHelper = formatTotalInchesAsFeetInches(room.lengthIn)
  const widthHelper = formatTotalInchesAsFeetInches(room.widthIn)
  const heightHelper = formatTotalInchesAsFeetInches(room.heightIn)

  const wallFormula = wallFormulaText(
    roomVm.selectedRoomGeometryMode,
    room.lengthIn,
    room.widthIn,
    room.heightIn,
  )

  const roomTypeUnavailable = roomVm.roomTypeOptions.length === 0
  const isSegmentedRoom = roomVm.selectedRoomGeometryMode === 'SEG'

  return (
    <>
      <RoomHeaderSetup styles={styles}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={styles.mono}>Room Setup</div>
            <h2 style={{ fontSize: 'calc(18px + 4pt)', fontWeight: 800, letterSpacing: '-0.02em', margin: '3px 0 0' }}>
              {room.roomId} - {room.roomName || 'New room'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {room.roomTypeId ? (
              <span style={{ ...styles.mono, border: '1px solid var(--v2-line)', borderRadius: 8, padding: '3px 8px' }}>
                template: {roomVm.roomTypeOptions.find((type) => type.id === room.roomTypeId)?.label ?? room.roomTypeId}
              </span>
            ) : null}
            <button
              type="button"
              onClick={roomVm.deleteSelectedRoom}
              className="room-header-delete-btn"
              style={{
                ...styles.button,
                color: 'var(--v2-red)',
                background: 'transparent',
                borderColor: 'rgba(248,113,113,0.24)',
                fontSize: 'calc(10px + 4pt)',
                padding: '4px 8px',
              }}
            >
              Delete room
            </button>
          </div>
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
              disabled={roomTypeUnavailable}
            >
              {roomTypeUnavailable ? (
                <option value={room.roomTypeId || ''}>Catalog unavailable</option>
              ) : (
                <option value="">-- select type --</option>
              )}
              {roomVm.roomTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            {roomTypeUnavailable && (
              <span className="dim-helper-text" style={{ ...styles.mono, color: 'var(--v2-ink-3)', fontSize: 'calc(8px + 4pt)', marginTop: 2 }}>
                Room type templates could not be loaded
              </span>
            )}
          </Field>
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
                  {mode === 'RECT' ? 'Rectangle' : 'Segments'}
                </button>
              ))}
            </div>
          </Field>
          {!isSegmentedRoom && (
            <>
              <Field label="Length (in)" styles={styles}>
                <input value={room.lengthIn} onChange={(event) => roomVm.updateSelectedRoomDimensions('lengthIn', event.target.value)} style={styles.input} placeholder="0" type="number" min="0" />
                {lengthHelper && <span className="dim-helper-text">{lengthHelper}</span>}
              </Field>
              <Field label="Width (in)" styles={styles}>
                <input value={room.widthIn} onChange={(event) => roomVm.updateSelectedRoomDimensions('widthIn', event.target.value)} style={styles.input} placeholder="0" type="number" min="0" />
                {widthHelper && <span className="dim-helper-text">{widthHelper}</span>}
              </Field>
            </>
          )}
          <Field label={isSegmentedRoom ? 'Height Override (in)' : 'Height (in)'} styles={styles}>
            <input value={room.heightIn} onChange={(event) => roomVm.updateSelectedRoomDimensions('heightIn', event.target.value)} style={styles.input} placeholder="0" type="number" min="0" />
            {heightHelper && <span className="dim-helper-text">{heightHelper}</span>}
          </Field>
          <div className={roomVm.selectedRoomEffectiveSqFt != null ? 'wallsqft-box' : 'wallsqft-box-empty'}>
            <div style={styles.mono}>Wall Sq Ft</div>
            <div style={{ ...styles.computedBig, color: roomVm.selectedRoomEffectiveSqFt != null ? 'var(--v2-green-2)' : 'var(--v2-ink-3)' }}>
              {toDisplayNumber(roomVm.selectedRoomEffectiveSqFt)}
            </div>
            {wallFormula && (
              <span className="wall-formula-text" style={{ ...styles.mono, color: 'var(--v2-ink-3)', fontSize: 'calc(8px + 4pt)', marginTop: 2, display: 'block' }}>
                {wallFormula}
              </span>
            )}
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
