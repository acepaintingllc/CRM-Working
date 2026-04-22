'use client'

import type { CSSProperties } from 'react'
import { sortByPosition } from '@/lib/estimator/v2DraftPayload'
import type { EstimateV2EditorRoomVm, EstimateV2EditorSettingsVm } from '../_state/estimateV2EditorTypes'
import { Field, type SharedStyles } from './EstimateV2EditorPrimitives'

type SidebarStyles = SharedStyles & {
  button: CSSProperties
  panel: CSSProperties
  input: CSSProperties
}

export function EstimateV2Sidebar({
  styles,
  roomVm,
  jobSettingsVm,
  toDisplayNumber,
}: {
  styles: SidebarStyles
  roomVm: EstimateV2EditorRoomVm
  jobSettingsVm: EstimateV2EditorSettingsVm
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  return (
    <aside style={{ ...styles.panel, alignSelf: 'start', position: 'sticky', top: 80, display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <button
          type="button"
          onClick={() => jobSettingsVm.setJobDefaultsOpen((open) => !open)}
          style={{
            ...styles.button,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'rgba(74,222,128,0.05)',
            borderColor: 'rgba(134,239,172,0.18)',
          }}
        >
          <span style={styles.mono}>Job Defaults</span>
          <span style={{ ...styles.mono, color: 'var(--v2-green-2)' }}>
            {jobSettingsVm.jobDefaultsOpen ? 'v' : '^'}
          </span>
        </button>
        {jobSettingsVm.jobDefaultsOpen ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <Field label="Walls default paint" styles={styles}>
              <select
                value={jobSettingsVm.jobSettingsDraft.wallPaintProductId}
                onChange={(event) => jobSettingsVm.updateJobSettings({ wallPaintProductId: event.target.value })}
                style={styles.input}
              >
                <option value="">{jobSettingsVm.orgWallPaintLabel}</option>
                {jobSettingsVm.wallPaintOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Walls default primer" styles={styles}>
              <select
                value={jobSettingsVm.jobSettingsDraft.wallPrimerProductId}
                onChange={(event) => jobSettingsVm.updateJobSettings({ wallPrimerProductId: event.target.value })}
                style={styles.input}
              >
                <option value="">{jobSettingsVm.orgWallPrimerLabel}</option>
                {jobSettingsVm.wallPrimerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ceilings default paint" styles={styles}>
              <select
                value={jobSettingsVm.jobSettingsDraft.ceilingPaintProductId}
                onChange={(event) => jobSettingsVm.updateJobSettings({ ceilingPaintProductId: event.target.value })}
                style={styles.input}
              >
                <option value="">{jobSettingsVm.orgCeilingPaintLabel}</option>
                {jobSettingsVm.ceilingPaintOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ceilings default primer" styles={styles}>
              <select
                value={jobSettingsVm.jobSettingsDraft.ceilingPrimerProductId}
                onChange={(event) => jobSettingsVm.updateJobSettings({ ceilingPrimerProductId: event.target.value })}
                style={styles.input}
              >
                <option value="">{jobSettingsVm.orgCeilingPrimerLabel}</option>
                {jobSettingsVm.ceilingPrimerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trim default paint" styles={styles}>
              <select
                value={jobSettingsVm.jobSettingsDraft.trimPaintProductId}
                onChange={(event) => jobSettingsVm.updateJobSettings({ trimPaintProductId: event.target.value })}
                style={styles.input}
              >
                <option value="">{jobSettingsVm.orgTrimPaintLabel}</option>
                {jobSettingsVm.trimPaintOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trim default primer" styles={styles}>
              <select
                value={jobSettingsVm.jobSettingsDraft.trimPrimerProductId}
                onChange={(event) => jobSettingsVm.updateJobSettings({ trimPrimerProductId: event.target.value })}
                style={styles.input}
              >
                <option value="">{jobSettingsVm.orgTrimPrimerLabel}</option>
                {jobSettingsVm.trimPrimerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
      </div>

      <div style={{ height: 1, background: 'var(--v2-line)' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={styles.mono}>Rooms</span>
        <span style={{ ...styles.mono, color: 'var(--v2-green-2)' }}>{roomVm.rooms.length}</span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {roomVm.rooms.length === 0 ? (
          <div style={{ color: 'var(--v2-ink-3)', fontSize: 'calc(13px + 4pt)', lineHeight: 1.6 }}>
            No rooms yet - add the first one.
          </div>
        ) : null}
        {sortByPosition(roomVm.rooms).map((room) => {
          const active = room.roomId === roomVm.selectedRoomId
          const roomScopes = roomVm.roomScopeByRoomId.get(room.roomId) ?? []
          const roomCeilingScopes = roomVm.roomCeilingScopeByRoomId.get(room.roomId) ?? []
          const roomTrimScopes = roomVm.roomTrimScopeByRoomId.get(room.roomId) ?? []
          const areaSf = roomVm.displayedRoomEffectiveAreaByRoomId.get(room.roomId) ?? null
          const includedScopes = [
            roomScopes.some((scope) => scope.include === 'Y') ? 'Walls' : null,
            roomCeilingScopes.some((scope) => scope.include === 'Y') ? 'Ceilings' : null,
            roomTrimScopes.some((scope) => scope.include === 'Y') ? 'Trim' : null,
          ]
            .filter(Boolean)
            .join(', ')

          return (
            <button
              key={room.id}
              type="button"
              className="room-card"
              onClick={() => roomVm.setSelectedRoomId(room.roomId)}
              style={{
                borderRadius: 14,
                border: `1px solid ${active ? 'rgba(134,239,172,0.32)' : 'var(--v2-line)'}`,
                background: active ? 'rgba(74,222,128,0.07)' : '#0d0d0d',
                padding: '10px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'grid',
                gap: 5,
                width: '100%',
                color: 'var(--v2-ink)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 'calc(13px + 4pt)', fontWeight: 700 }}>{room.roomName || '(unnamed)'}</div>
                  <div style={{ ...styles.mono, marginTop: 3 }}>{room.roomId}</div>
                </div>
                {areaSf != null ? (
                  <div style={{ fontSize: 'calc(12px + 4pt)', fontWeight: 700, color: 'var(--v2-green-2)', whiteSpace: 'nowrap' }}>
                    {toDisplayNumber(areaSf)} sf
                  </div>
                ) : null}
              </div>
              <div style={{ ...styles.mono, color: 'var(--v2-ink-3)' }}>{includedScopes || 'No scopes included'}</div>
            </button>
          )
        })}

        <button
          type="button"
          className="add-room-card"
          onClick={roomVm.addRoom}
          style={{
            borderRadius: 14,
            border: '1px dashed var(--v2-line-2)',
            background: 'transparent',
            padding: '10px 12px',
            cursor: 'pointer',
            color: 'var(--v2-ink-3)',
            fontSize: 'calc(13px + 4pt)',
            fontWeight: 600,
            textAlign: 'center',
            width: '100%',
          }}
        >
          + Add room
        </button>
      </div>
    </aside>
  )
}
