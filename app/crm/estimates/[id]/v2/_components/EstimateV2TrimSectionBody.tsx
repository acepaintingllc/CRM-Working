'use client'

import { numberOrNull } from '../_lib/estimateV2EditorNormalize'
import type { CSSProperties } from 'react'
import type { EstimateV2EditorTrimVm } from '../_state/estimateV2EditorTypes'
import {
  Field,
  ItemActionRow,
  ReorderDeleteActions,
  TrimScopePanel,
} from './EstimateV2EditorPrimitives'
import type { EstimateV2TrimMeasurementMode as TrimMeasurementMode } from '@/types/estimator/v2'

type EditorStyles = Record<string, CSSProperties>

const sharedStyles = (styles: EditorStyles) => ({
  label: styles.label,
  mono: styles.mono,
  panel: styles.panel,
})

export function EstimateV2TrimSectionBody({
  styles,
  trimVm,
  toDisplayNumber,
}: {
  styles: EditorStyles
  trimVm: EstimateV2EditorTrimVm
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const {
    selectedRoom,
    selectedRoomResolvedMode,
    selectedRoomTrimScopes,
    trimTypeOptions,
    trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById,
    addScope,
    moveScope,
    deleteScope,
    updateScope,
    updateTrimType,
  } = trimVm

  if (!selectedRoom) return null

  return (
    <TrimScopePanel>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ ...styles.mono, color: 'var(--v2-ink-3)' }}>
          Dynamic trim items for this room
        </div>
        <button
          type="button"
          style={styles.button}
          onClick={() => addScope(selectedRoom.roomId)}
        >
          + Add Trim Item
        </button>
      </div>
      {selectedRoomTrimScopes.length === 0 && (
        <div style={{ ...styles.panel, color: 'var(--v2-ink-3)' }}>
          Add a trim item to start trim scope inputs for this room.
        </div>
      )}
      {selectedRoomTrimScopes.map((trimScope, trimIndex) => {
        const typeMeta = trimTypeOptions.find((item) => item.id === trimScope.trimTypeId)
        const helperEligible = selectedRoomResolvedMode === 'RECT' && !!typeMeta?.helper_allowed
        const isBaseboardLf =
          trimScope.unitType === 'LF' &&
          [
            typeMeta?.family,
            typeMeta?.category,
            typeMeta?.label,
            trimScope.trimFamily,
            trimScope.scopeName,
            trimScope.trimTypeId,
          ].some((value) => String(value ?? '').toLowerCase().includes('baseboard'))
        const rowMeasurement = trimScopeEffectiveMeasurementById.get(trimScope.id)
        const rowSubtotal = trimScopeEffectiveTotalById.get(trimScope.id)
        const rowModifierCount = [
          trimScope.prepFactor,
          trimScope.heightFactor,
          trimScope.profileFactor,
          trimScope.roomFlagFactor,
          trimScope.maskingFactor,
          trimScope.stairFactor,
          trimScope.difficultFinishFactor,
          trimScope.caulkFillFactor,
        ].filter((value) => (numberOrNull(value) ?? 1) !== 1).length

        return (
          <div
            key={trimScope.id}
            style={{
              border: '1px solid var(--v2-line)',
              borderRadius: 12,
              padding: 12,
              display: 'grid',
              gap: 10,
            }}
          >
            <ItemActionRow
              styles={{ mono: styles.mono }}
              meta={<div style={styles.mono}>Trim Item {trimIndex + 1}</div>}
              title={typeMeta?.label || trimScope.scopeName || trimScope.trimTypeId || 'Trim item'}
              actions={
                <>
                  <span style={{ ...styles.scopePill, color: 'var(--v2-ink-2)' }}>
                    {rowMeasurement == null ? '--' : toDisplayNumber(rowMeasurement)}{' '}
                    {trimScope.unitType.toLowerCase()}
                  </span>
                  <span style={{ ...styles.scopePill, color: 'var(--v2-ink-2)' }}>
                    {rowSubtotal == null ? '--' : `$${rowSubtotal.toFixed(2)}`}
                  </span>
                  <ReorderDeleteActions
                    styles={{ button: styles.button }}
                    disableMoveUp={trimIndex === 0}
                    disableMoveDown={trimIndex === selectedRoomTrimScopes.length - 1}
                    onMoveUp={() => moveScope(selectedRoom.roomId, trimScope.id, -1)}
                    onMoveDown={() => moveScope(selectedRoom.roomId, trimScope.id, 1)}
                    onDelete={() => deleteScope(selectedRoom.roomId, trimScope.id)}
                  />
                </>
              }
            />

            <div style={{ ...styles.mono, color: 'var(--v2-ink-3)' }}>
              {trimScope.measurementMode === 'ROOM_HELPER' ? 'Helper' : 'Manual'} ·{' '}
              {trimScope.unitType} · modifiers {rowModifierCount}
            </div>

            <div className="paint-setup-grid">
              <Field label="Trim Type" styles={sharedStyles(styles)}>
                <select
                  value={trimScope.trimTypeId}
                  onChange={(e) => updateTrimType(trimScope.id, e.target.value)}
                  style={styles.input}
                >
                  <option value="">-- select trim type --</option>
                  {trimTypeOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label || opt.id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Include" styles={sharedStyles(styles)}>
                <select
                  value={trimScope.include}
                  onChange={(e) =>
                    updateScope(trimScope.id, { include: e.target.value as 'Y' | 'N' })
                  }
                  style={styles.input}
                >
                  <option value="Y">Included</option>
                  <option value="N">Excluded</option>
                </select>
              </Field>
              <Field label="Measurement Mode" styles={sharedStyles(styles)}>
                <select
                  value={trimScope.measurementMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as TrimMeasurementMode
                    updateScope(trimScope.id, {
                      measurementMode: nextMode,
                      helperSource: nextMode === 'ROOM_HELPER' ? 'ROOM_PERIMETER' : '',
                    })
                  }}
                  style={styles.input}
                >
                  <option value="MANUAL">MANUAL</option>
                  <option value="ROOM_HELPER" disabled={!helperEligible}>
                    ROOM_HELPER
                  </option>
                </select>
              </Field>
              <Field label={`Measurement (${trimScope.unitType})`} styles={sharedStyles(styles)}>
                {trimScope.measurementMode === 'ROOM_HELPER' ? (
                  <input
                    value={trimScope.helperValue}
                    onChange={(e) => updateScope(trimScope.id, { helperValue: e.target.value })}
                    style={styles.input}
                    placeholder="auto perimeter fallback"
                  />
                ) : (
                  <input
                    value={trimScope.measurementValue}
                    onChange={(e) =>
                      updateScope(trimScope.id, { measurementValue: e.target.value })
                    }
                    style={styles.input}
                    type="number"
                    min="0"
                  />
                )}
              </Field>
              {isBaseboardLf && (
                <Field label="Openings" styles={sharedStyles(styles)}>
                  <input
                    value={trimScope.baseboardOpeningCount}
                    onChange={(e) =>
                      updateScope(trimScope.id, { baseboardOpeningCount: e.target.value })
                    }
                    style={styles.input}
                    type="number"
                    min="0"
                    step="0.5"
                  />
                </Field>
              )}
            </div>

            <div className="paint-setup-grid">
              <Field label="Primer Mode" styles={sharedStyles(styles)}>
                <select
                  value={trimScope.primeMode}
                  onChange={(e) =>
                    updateScope(trimScope.id, {
                      primeMode: e.target.value as 'NONE' | 'SPOT' | 'FULL',
                    })
                  }
                  style={styles.input}
                >
                  <option value="NONE">NONE</option>
                  <option value="SPOT">SPOT</option>
                  <option value="FULL">FULL</option>
                </select>
              </Field>
            </div>

            <div className="advanced-grid">
              <Field label="Prep" styles={sharedStyles(styles)}>
                <input
                  value={trimScope.prepFactor}
                  onChange={(e) => updateScope(trimScope.id, { prepFactor: e.target.value })}
                  style={styles.input}
                />
              </Field>
              <Field label="Height" styles={sharedStyles(styles)}>
                <input
                  value={trimScope.heightFactor}
                  onChange={(e) => updateScope(trimScope.id, { heightFactor: e.target.value })}
                  style={styles.input}
                />
              </Field>
              <Field label="Profile" styles={sharedStyles(styles)}>
                <input
                  value={trimScope.profileFactor}
                  onChange={(e) => updateScope(trimScope.id, { profileFactor: e.target.value })}
                  style={styles.input}
                />
              </Field>
              <Field label="Room Flag" styles={sharedStyles(styles)}>
                <input
                  value={trimScope.roomFlagFactor}
                  readOnly
                  style={{ ...styles.input, opacity: 0.7, cursor: 'not-allowed' }}
                />
              </Field>
              <Field label="Masking" styles={sharedStyles(styles)}>
                <input
                  value={trimScope.maskingFactor}
                  onChange={(e) => updateScope(trimScope.id, { maskingFactor: e.target.value })}
                  style={styles.input}
                />
              </Field>
              <Field label="Stair" styles={sharedStyles(styles)}>
                <input
                  value={trimScope.stairFactor}
                  onChange={(e) => updateScope(trimScope.id, { stairFactor: e.target.value })}
                  style={styles.input}
                />
              </Field>
              <Field label="Finish" styles={sharedStyles(styles)}>
                <input
                  value={trimScope.difficultFinishFactor}
                  onChange={(e) =>
                    updateScope(trimScope.id, { difficultFinishFactor: e.target.value })
                  }
                  style={styles.input}
                />
              </Field>
              <Field label="Caulk/Fill" styles={sharedStyles(styles)}>
                <input
                  value={trimScope.caulkFillFactor}
                  onChange={(e) => updateScope(trimScope.id, { caulkFillFactor: e.target.value })}
                  style={styles.input}
                />
              </Field>
            </div>

          </div>
        )
      })}
    </TrimScopePanel>
  )
}
