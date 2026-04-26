'use client'

import { numberOrNull } from '../_lib/estimateV2EditorNormalize'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { EstimateV2EditorTrimVm } from '../_state/estimateV2EditorTypes'
import {
  Advanced,
  AdvancedPanelToggle,
  Field,
  ItemActionRow,
  PrimerModeButtons,
  ReorderDeleteActions,
  TrimScopePanel,
} from './EstimateV2EditorPrimitives'
import { EstimateV2ConditionsPanel } from './EstimateV2ConditionsPanel'
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
  openTrimAdvanced,
  setOpenTrimAdvanced,
  toDisplayNumber,
}: {
  styles: EditorStyles
  trimVm: EstimateV2EditorTrimVm
  openTrimAdvanced: Record<string, boolean>
  setOpenTrimAdvanced: Dispatch<SetStateAction<Record<string, boolean>>>
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const {
    selectedRoom,
    selectedRoomResolvedMode,
    selectedRoomTrimScopes,
    effectiveTrimPaintLabel,
    effectiveTrimPrimerLabel,
    trimPaintOptions,
    trimPrimerOptions,
    trimTypeOptions,
    trimScopeEffectiveMeasurementById,
    trimScopeEffectiveTotalById,
    colorCodeOptions,
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
        <button type="button" style={styles.button} onClick={() => addScope(selectedRoom.roomId)}>
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
        const advancedOpen = !!openTrimAdvanced[trimScope.id]

        return (
          <div
            key={trimScope.id}
            style={{
              border: '1px solid var(--v2-line)',
              borderRadius: 12,
              padding: 12,
              display: 'grid',
              gap: 10,
              background: '#111111',
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
              {trimScope.measurementMode === 'ROOM_HELPER' ? 'Helper' : 'Manual'} | {trimScope.unitType}
              {rowModifierCount > 0
                ? ` | ${rowModifierCount} saved factor${rowModifierCount === 1 ? '' : 's'}`
                : ''}
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
                  <option value="MANUAL">Manual</option>
                  <option value="ROOM_HELPER" disabled={!helperEligible}>
                    Room helper
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
              <Field label="Primer Mode" styles={sharedStyles(styles)}>
                <PrimerModeButtons
                  currentMode={trimScope.primeMode}
                  onChange={(mode) =>
                    updateScope(trimScope.id, {
                      primeMode: mode,
                      primerProductId: mode === 'NONE' ? '' : trimScope.primerProductId,
                    })
                  }
                  styles={{ button: styles.button }}
                />
              </Field>
            </div>

            <Advanced styles={sharedStyles(styles)}>
              <AdvancedPanelToggle
                label="Advanced / Overrides"
                open={advancedOpen}
                onToggle={() =>
                  setOpenTrimAdvanced((prev) => ({
                    ...prev,
                    [trimScope.id]: !advancedOpen,
                  }))
                }
                styles={{ mono: styles.mono }}
              />
              {advancedOpen && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div className="advanced-grid">
                    <Field label="Scope Name" styles={sharedStyles(styles)}>
                      <input
                        value={trimScope.scopeName}
                        onChange={(e) => updateScope(trimScope.id, { scopeName: e.target.value })}
                        style={styles.input}
                      />
                    </Field>
                    <Field label="Paint Override" styles={sharedStyles(styles)}>
                      <select
                        value={trimScope.paintProductId}
                        onChange={(e) => updateScope(trimScope.id, { paintProductId: e.target.value })}
                        style={styles.input}
                      >
                        <option value="">{effectiveTrimPaintLabel}</option>
                        {trimPaintOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {trimScope.primeMode !== 'NONE' && (
                      <Field label="Primer Override" styles={sharedStyles(styles)}>
                        <select
                          value={trimScope.primerProductId}
                          onChange={(e) =>
                            updateScope(trimScope.id, { primerProductId: e.target.value })
                          }
                          style={styles.input}
                        >
                          <option value="">{effectiveTrimPrimerLabel}</option>
                          {trimPrimerOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Color Slot" styles={sharedStyles(styles)}>
                      <select
                        value={trimScope.colorId}
                        onChange={(e) => updateScope(trimScope.id, { colorId: e.target.value })}
                        style={styles.input}
                      >
                        {colorCodeOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Paint Coats" styles={sharedStyles(styles)}>
                      <input
                        value={trimScope.paintCoats}
                        onChange={(e) => updateScope(trimScope.id, { paintCoats: e.target.value })}
                        style={styles.input}
                      />
                    </Field>
                    {trimScope.primeMode !== 'NONE' && (
                      <Field label="Primer Coats" styles={sharedStyles(styles)}>
                        <input
                          value={trimScope.primerCoats}
                          onChange={(e) => updateScope(trimScope.id, { primerCoats: e.target.value })}
                          style={styles.input}
                        />
                      </Field>
                    )}
                  </div>

                  <div>
                    <div style={{ ...styles.mono, marginBottom: 6 }}>Overrides</div>
                    <div className="advanced-grid">
                      <Field label="Measurement Override" styles={sharedStyles(styles)}>
                        <input
                          value={trimScope.overrideMeasurement}
                          onChange={(e) =>
                            updateScope(trimScope.id, { overrideMeasurement: e.target.value })
                          }
                          style={styles.input}
                        />
                      </Field>
                      <Field label="Hours Override" styles={sharedStyles(styles)}>
                        <input
                          value={trimScope.overrideHours}
                          onChange={(e) => updateScope(trimScope.id, { overrideHours: e.target.value })}
                          style={styles.input}
                        />
                      </Field>
                      <Field label="Supply Cost Override" styles={sharedStyles(styles)}>
                        <input
                          value={trimScope.overrideSupplyCost}
                          onChange={(e) =>
                            updateScope(trimScope.id, { overrideSupplyCost: e.target.value })
                          }
                          style={styles.input}
                        />
                      </Field>
                      <Field label="Total Override" styles={sharedStyles(styles)}>
                        <input
                          value={trimScope.overrideTotal}
                          onChange={(e) => updateScope(trimScope.id, { overrideTotal: e.target.value })}
                          style={styles.input}
                        />
                      </Field>
                    </div>
                  </div>

                  <Field label="Notes" styles={sharedStyles(styles)}>
                    <textarea
                      value={trimScope.notes}
                      onChange={(e) => updateScope(trimScope.id, { notes: e.target.value })}
                      style={styles.textarea}
                    />
                  </Field>
                </div>
              )}
            </Advanced>
          </div>
        )
      })}

      <EstimateV2ConditionsPanel
        title="Trim Conditions"
        scope="trim"
        catalog={trimVm.conditionModifiers ?? []}
        selections={trimVm.conditionSelections}
        onChange={trimVm.setSelectedRoomTrimCondition ?? (() => undefined)}
        styles={styles}
      />
    </TrimScopePanel>
  )
}
