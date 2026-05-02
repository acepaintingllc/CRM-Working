'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { EstimateV2EditorDoorsVm } from '../_state/estimateV2EditorTypes'
import {
  Advanced,
  AdvancedPanelToggle,
  DoorsScopePanel,
  Field,
  ItemActionRow,
  OptionalInputFrame,
  PaintCoatButtons,
  PrimerModeButtons,
  RequiredInputFrame,
  ReorderDeleteActions,
  ScopeHelperBar,
} from './EstimateV2EditorPrimitives'

type EditorStyles = Record<string, CSSProperties>

const sharedStyles = (styles: EditorStyles) => ({
  label: styles.label,
  mono: styles.mono,
  panel: styles.panel,
})

export function EstimateV2DoorsSectionBody({
  styles,
  doorsVm,
  openDoorsAdvanced,
  setOpenDoorsAdvanced,
  toDisplayNumber,
}: {
  styles: EditorStyles
  doorsVm: EstimateV2EditorDoorsVm
  openDoorsAdvanced: Record<string, boolean>
  setOpenDoorsAdvanced: Dispatch<SetStateAction<Record<string, boolean>>>
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const {
    selectedRoom,
    selectedRoomDoorScopes,
    effectiveDoorPaintLabel,
    effectiveDoorPrimerLabel,
    doorPaintOptions,
    doorPrimerOptions,
    doorTypeOptions,
    doorScopeEffectiveUnitsById,
    doorScopeEffectiveTotalById,
    colorCodeOptions,
    addScope,
    moveScope,
    deleteScope,
    updateScope,
    updateDoorType,
  } = doorsVm

  if (!selectedRoom) return null

  return (
    <DoorsScopePanel>
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
          Door units for this room
        </div>
        <button type="button" style={styles.button} onClick={() => addScope(selectedRoom.roomId)}>
          + Add Door
        </button>
      </div>

      {selectedRoomDoorScopes.length === 0 && (
        <div style={{ ...styles.panel, color: 'var(--v2-ink-3)' }}>
          Add a door item to start door scope inputs for this room.
        </div>
      )}

      {selectedRoomDoorScopes.map((doorScope, doorIndex) => {
        const typeMeta = doorTypeOptions.find((item) => item.id === doorScope.doorTypeId)
        const rowUnits = doorScopeEffectiveUnitsById.get(doorScope.id)
        const rowSubtotal = doorScopeEffectiveTotalById.get(doorScope.id)
        const advancedOpen = !!openDoorsAdvanced[doorScope.id]

        return (
          <div
            key={doorScope.id}
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
              meta={<div style={styles.mono}>Door {doorIndex + 1}</div>}
              title={typeMeta?.label || doorScope.scopeName || doorScope.doorTypeId || 'Door item'}
              actions={
                <>
                  <span style={{ ...styles.scopePill, color: 'var(--v2-ink-2)' }}>
                    {rowUnits == null ? '--' : toDisplayNumber(rowUnits)} sides
                  </span>
                  <span style={{ ...styles.scopePill, color: 'var(--v2-ink-2)' }}>
                    {rowSubtotal == null ? '--' : `$${rowSubtotal.toFixed(2)}`}
                  </span>
                  <ReorderDeleteActions
                    styles={{ button: styles.button }}
                    disableMoveUp={doorIndex === 0}
                    disableMoveDown={doorIndex === selectedRoomDoorScopes.length - 1}
                    onMoveUp={() => moveScope(selectedRoom.roomId, doorScope.id, -1)}
                    onMoveDown={() => moveScope(selectedRoom.roomId, doorScope.id, 1)}
                    onDelete={() => deleteScope(selectedRoom.roomId, doorScope.id)}
                  />
                </>
              }
            />

            <ScopeHelperBar
              styles={{ mono: styles.mono, computedBig: styles.computedBig }}
              metrics={[
                { label: 'Quantity', value: doorScope.quantity || '--', muted: !doorScope.quantity },
                { label: 'Sides', value: doorScope.sides || '--', muted: !doorScope.sides },
                { label: 'Final Units', value: toDisplayNumber(rowUnits), muted: rowUnits == null },
                {
                  label: 'Subtotal',
                  value: rowSubtotal == null ? '--' : `$${rowSubtotal.toFixed(2)}`,
                  muted: rowSubtotal == null,
                },
              ]}
            />

            <div className="trim-setup-grid">
              <Field label="Door Type" styles={sharedStyles(styles)}>
                <RequiredInputFrame>
                  <select
                    value={doorScope.doorTypeId}
                    onChange={(e) => updateDoorType(doorScope.id, e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Select door rate</option>
                    {doorTypeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </RequiredInputFrame>
              </Field>
              <Field label="Include" styles={sharedStyles(styles)}>
                <OptionalInputFrame>
                  <select
                    value={doorScope.include}
                    onChange={(e) =>
                      updateScope(doorScope.id, { include: e.target.value as 'Y' | 'N' })
                    }
                    style={styles.input}
                  >
                    <option value="Y">Included</option>
                    <option value="N">Excluded</option>
                  </select>
                </OptionalInputFrame>
              </Field>
              <Field label="Quantity" styles={sharedStyles(styles)}>
                <RequiredInputFrame>
                  <input
                    value={doorScope.quantity}
                    onChange={(e) => updateScope(doorScope.id, { quantity: e.target.value })}
                    style={styles.input}
                    type="number"
                    min="0"
                    step="1"
                  />
                </RequiredInputFrame>
              </Field>
              <Field label="Sides" styles={sharedStyles(styles)}>
                <RequiredInputFrame>
                  <select
                    value={doorScope.sides}
                    onChange={(e) => updateScope(doorScope.id, { sides: e.target.value })}
                    style={styles.input}
                  >
                    <option value="">Select sides</option>
                    <option value="1">1 side</option>
                    <option value="2">2 sides</option>
                  </select>
                </RequiredInputFrame>
              </Field>
              <Field label="Coats" styles={sharedStyles(styles)}>
                <RequiredInputFrame>
                  <PaintCoatButtons
                    value={doorScope.paintCoats}
                    onChange={(value) => updateScope(doorScope.id, { paintCoats: value })}
                    styles={{ button: styles.button }}
                  />
                </RequiredInputFrame>
              </Field>
              <Field label="Primer Mode" styles={sharedStyles(styles)}>
                <RequiredInputFrame>
                  <PrimerModeButtons
                    currentMode={doorScope.primeMode}
                    onChange={(mode) =>
                      updateScope(doorScope.id, {
                        primeMode: mode,
                        primerProductId: mode === 'NONE' ? '' : doorScope.primerProductId,
                      })
                    }
                    styles={{ button: styles.button }}
                  />
                </RequiredInputFrame>
              </Field>
              {doorScope.primeMode === 'SPOT' && (
                <Field label="Spot Primer %" styles={sharedStyles(styles)}>
                  <OptionalInputFrame>
                    <input
                      value={doorScope.spotPrimePercent}
                      onChange={(e) =>
                        updateScope(doorScope.id, { spotPrimePercent: e.target.value })
                      }
                      style={styles.input}
                      type="number"
                      min="0"
                      max="100"
                    />
                  </OptionalInputFrame>
                </Field>
              )}
            </div>

            <Advanced styles={sharedStyles(styles)}>
              <AdvancedPanelToggle
                label="Advanced / Overrides"
                open={advancedOpen}
                onToggle={() =>
                  setOpenDoorsAdvanced((prev) => ({
                    ...prev,
                    [doorScope.id]: !advancedOpen,
                  }))
                }
                styles={{ mono: styles.mono }}
              />
              {advancedOpen && (
                <OptionalInputFrame>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div className="advanced-grid">
                      <Field label="Scope Name" styles={sharedStyles(styles)}>
                        <input
                          value={doorScope.scopeName}
                          onChange={(e) => updateScope(doorScope.id, { scopeName: e.target.value })}
                          style={styles.input}
                        />
                      </Field>
                      <Field label="Paint Override" styles={sharedStyles(styles)}>
                        <select
                          value={doorScope.paintProductId}
                          onChange={(e) =>
                            updateScope(doorScope.id, { paintProductId: e.target.value })
                          }
                          style={styles.input}
                        >
                          <option value="">{effectiveDoorPaintLabel}</option>
                          {doorPaintOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {doorScope.primeMode !== 'NONE' && (
                        <Field label="Primer Override" styles={sharedStyles(styles)}>
                          <select
                            value={doorScope.primerProductId}
                            onChange={(e) =>
                              updateScope(doorScope.id, { primerProductId: e.target.value })
                            }
                            style={styles.input}
                          >
                            <option value="">{effectiveDoorPrimerLabel}</option>
                            {doorPrimerOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label="Color Slot" styles={sharedStyles(styles)}>
                        <select
                          value={doorScope.colorId}
                          onChange={(e) => updateScope(doorScope.id, { colorId: e.target.value })}
                          style={styles.input}
                        >
                          <option value="">No color</option>
                          {colorCodeOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Labor Rate Override" styles={sharedStyles(styles)}>
                        <input
                          value={doorScope.laborRate}
                          onChange={(e) => updateScope(doorScope.id, { laborRate: e.target.value })}
                          style={styles.input}
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </Field>
                      <Field label="Material Rate Override" styles={sharedStyles(styles)}>
                        <input
                          value={doorScope.materialRate}
                          onChange={(e) => updateScope(doorScope.id, { materialRate: e.target.value })}
                          style={styles.input}
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </Field>
                      {doorScope.primeMode !== 'NONE' && (
                        <Field label="Primer Coats" styles={sharedStyles(styles)}>
                          <input
                            value={doorScope.primerCoats}
                            onChange={(e) =>
                              updateScope(doorScope.id, { primerCoats: e.target.value })
                            }
                            style={styles.input}
                          />
                        </Field>
                      )}
                    </div>

                    <div>
                      <div style={{ ...styles.mono, marginBottom: 6 }}>Overrides</div>
                      <div className="advanced-grid">
                        <Field label="Paint Hrs" styles={sharedStyles(styles)}>
                          <input
                            value={doorScope.overridePaintHours}
                            onChange={(e) =>
                              updateScope(doorScope.id, { overridePaintHours: e.target.value })
                            }
                            style={styles.input}
                          />
                        </Field>
                        <Field label="Primer Hrs" styles={sharedStyles(styles)}>
                          <input
                            value={doorScope.overridePrimerHours}
                            onChange={(e) =>
                              updateScope(doorScope.id, { overridePrimerHours: e.target.value })
                            }
                            style={styles.input}
                          />
                        </Field>
                        <Field label="Material Cost" styles={sharedStyles(styles)}>
                          <input
                            value={doorScope.overrideMaterialCost}
                            onChange={(e) =>
                              updateScope(doorScope.id, { overrideMaterialCost: e.target.value })
                            }
                            style={styles.input}
                          />
                        </Field>
                        <Field label="Supply Cost" styles={sharedStyles(styles)}>
                          <input
                            value={doorScope.overrideSupplyCost}
                            onChange={(e) =>
                              updateScope(doorScope.id, { overrideSupplyCost: e.target.value })
                            }
                            style={styles.input}
                          />
                        </Field>
                        <Field label="Total" styles={sharedStyles(styles)}>
                          <input
                            value={doorScope.overrideTotal}
                            onChange={(e) =>
                              updateScope(doorScope.id, { overrideTotal: e.target.value })
                            }
                            style={styles.input}
                          />
                        </Field>
                      </div>
                    </div>

                    <Field label="Notes" styles={sharedStyles(styles)}>
                      <textarea
                        value={doorScope.notes}
                        onChange={(e) => updateScope(doorScope.id, { notes: e.target.value })}
                        style={styles.textarea}
                      />
                    </Field>
                  </div>
                </OptionalInputFrame>
              )}
            </Advanced>
          </div>
        )
      })}
    </DoorsScopePanel>
  )
}
