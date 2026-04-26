'use client'

import { sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { numberOrNull } from '../_lib/estimateV2EditorNormalize'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { EstimateV2EditorCeilingsVm, EstimateV2EditorRoomVm } from '../_state/estimateV2EditorTypes'
import {
  Advanced,
  AdvancedPanelToggle,
  CeilingsScopePanel,
  Field,
  ItemActionRow,
  PrimerModeButtons,
  ReorderDeleteActions,
  SharedSegmentGrid,
} from './EstimateV2EditorPrimitives'
import { EstimateV2ConditionsPanel } from './EstimateV2ConditionsPanel'
import type { EstimateV2CeilingSegmentShape as CeilingSegmentShape } from '@/types/estimator/v2'
import type { EstimateV2CeilingScopeDraft, EstimateV2RoomDraft } from '@/types/estimator/v2'

type EditorStyles = Record<string, CSSProperties>

const sharedStyles = (styles: EditorStyles) => ({
  label: styles.label,
  mono: styles.mono,
  panel: styles.panel,
})

function ceilingTypeAreaFactor(
  catalogs: EstimateV2EditorCeilingsVm['catalogs'],
  ceilingTypeId: string
) {
  if (!ceilingTypeId) return 1
  const factor = catalogs.ceiling_types.find((opt) => opt.id === ceilingTypeId)?.area_factor
  return typeof factor === 'number' && Number.isFinite(factor) && factor > 0 ? factor : 1
}

function ceilingBaseArea(scope: EstimateV2CeilingScopeDraft, room: EstimateV2RoomDraft | null) {
  const direct = numberOrNull(scope.areaSf)
  if (direct != null) return direct
  const length = numberOrNull(scope.lengthIn) ?? numberOrNull(room?.lengthIn ?? '')
  const width = numberOrNull(scope.widthIn) ?? numberOrNull(room?.widthIn ?? '')
  return length != null && width != null ? (length * width) / 144 : null
}

function ceilingHelperExtraArea(scope: EstimateV2CeilingScopeDraft, baseArea: number | null) {
  const base = baseArea ?? 0
  if (base <= 0) return 0
  if (scope.ceilingGeometryMode === 'VAULTED') {
    const factor = numberOrNull(scope.vaultedAreaFactor ?? '') ?? 1.2
    return Math.max(base * factor - base, 0)
  }
  if (scope.ceilingGeometryMode === 'TRAY') {
    const perimeter = numberOrNull(scope.trayPerimeterIn ?? '') ?? 0
    const stepHeight = numberOrNull(scope.trayStepHeightIn ?? '') ?? 0
    const bandWidth = numberOrNull(scope.trayBandWidthIn ?? '') ?? 0
    return (perimeter * stepHeight) / 144 + (perimeter * bandWidth) / 144
  }
  if (scope.ceilingGeometryMode === 'COFFERED') {
    const sectionLength = numberOrNull(scope.cofferSectionLengthIn ?? '') ?? 0
    const sectionWidth = numberOrNull(scope.cofferSectionWidthIn ?? '') ?? 0
    const sectionCount = Math.max(0, Math.floor(numberOrNull(scope.cofferSectionCount ?? '') ?? 0))
    const faceHeight = numberOrNull(scope.cofferFaceHeightIn ?? '') ?? 0
    const bottomWidth = numberOrNull(scope.cofferBottomWidthIn ?? '') ?? 0
    const sectionPerimeter = 2 * (sectionLength + sectionWidth)
    return sectionCount * ((sectionPerimeter * faceHeight) / 144 + (sectionPerimeter * bottomWidth) / 144)
  }
  return 0
}

function CeilingGeometryFields({
  scope,
  room,
  catalogs,
  styles,
  updateScope,
  toDisplayNumber,
}: {
  scope: EstimateV2CeilingScopeDraft
  room: EstimateV2RoomDraft | null
  catalogs: EstimateV2EditorCeilingsVm['catalogs']
  styles: EditorStyles
  updateScope: EstimateV2EditorCeilingsVm['updateScope']
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const mode = scope.ceilingGeometryMode || 'FLAT'
  const baseArea = ceilingBaseArea(scope, room)
  const helperExtra = ceilingHelperExtraArea(scope, baseArea)
  const areaFactor = ceilingTypeAreaFactor(catalogs, scope.ceilingTypeId)
  const finalArea = baseArea == null ? null : (baseArea + helperExtra) * areaFactor

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="paint-setup-grid">
        <Field label="Ceiling Shape" styles={sharedStyles(styles)}>
          <select
            value={mode}
            onChange={(e) => updateScope(scope.id, { ceilingGeometryMode: e.target.value })}
            style={styles.input}
          >
            <option value="FLAT">Flat</option>
            <option value="VAULTED">Vaulted</option>
            <option value="TRAY">Tray</option>
            <option value="COFFERED">Coffered</option>
            <option value="MANUAL">Manual</option>
          </select>
        </Field>
        {mode === 'VAULTED' && (
          <Field label="Vaulted Area Factor" styles={sharedStyles(styles)}>
            <input value={scope.vaultedAreaFactor ?? ''} onChange={(e) => updateScope(scope.id, { vaultedAreaFactor: e.target.value })} style={styles.input} type="number" min="0" placeholder="1.20" />
          </Field>
        )}
        {mode === 'TRAY' && (
          <>
            <Field label="Tray Perimeter (in)" styles={sharedStyles(styles)}><input value={scope.trayPerimeterIn ?? ''} onChange={(e) => updateScope(scope.id, { trayPerimeterIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
            <Field label="Step Height (in)" styles={sharedStyles(styles)}><input value={scope.trayStepHeightIn ?? ''} onChange={(e) => updateScope(scope.id, { trayStepHeightIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
            <Field label="Band Width (in)" styles={sharedStyles(styles)}><input value={scope.trayBandWidthIn ?? ''} onChange={(e) => updateScope(scope.id, { trayBandWidthIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
          </>
        )}
        {mode === 'COFFERED' && (
          <>
            <Field label="Section Length (in)" styles={sharedStyles(styles)}><input value={scope.cofferSectionLengthIn ?? ''} onChange={(e) => updateScope(scope.id, { cofferSectionLengthIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
            <Field label="Section Width (in)" styles={sharedStyles(styles)}><input value={scope.cofferSectionWidthIn ?? ''} onChange={(e) => updateScope(scope.id, { cofferSectionWidthIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
            <Field label="Section Count" styles={sharedStyles(styles)}><input value={scope.cofferSectionCount ?? ''} onChange={(e) => updateScope(scope.id, { cofferSectionCount: e.target.value })} style={styles.input} type="number" min="0" /></Field>
            <Field label="Face Height (in)" styles={sharedStyles(styles)}><input value={scope.cofferFaceHeightIn ?? ''} onChange={(e) => updateScope(scope.id, { cofferFaceHeightIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
            <Field label="Bottom Width (in)" styles={sharedStyles(styles)}><input value={scope.cofferBottomWidthIn ?? ''} onChange={(e) => updateScope(scope.id, { cofferBottomWidthIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
          </>
        )}
      </div>
      <div className="paint-setup-grid">
        <div className="walksqft-box"><div style={styles.mono}>Base Sq Ft</div><div style={styles.computedBig}>{toDisplayNumber(baseArea)}</div></div>
        <div className="walksqft-box"><div style={styles.mono}>Helper Extra</div><div style={styles.computedBig}>{toDisplayNumber(helperExtra)}</div></div>
        <div className="walksqft-box"><div style={styles.mono}>Area Factor</div><div style={styles.computedBig}>{toDisplayNumber(areaFactor)}</div></div>
        <div className="walksqft-box"><div style={styles.mono}>Final Sq Ft</div><div style={styles.computedBig}>{toDisplayNumber(finalArea)}</div></div>
      </div>
    </div>
  )
}

export function EstimateV2CeilingsSectionBody({
  styles,
  ceilingsVm,
  openCeilingAdvanced,
  setOpenCeilingAdvanced,
  switchRoomGeometryMode,
  toDisplayNumber,
}: {
  styles: EditorStyles
  ceilingsVm: EstimateV2EditorCeilingsVm
  openCeilingAdvanced: Record<string, boolean>
  setOpenCeilingAdvanced: Dispatch<SetStateAction<Record<string, boolean>>>
  switchRoomGeometryMode: EstimateV2EditorRoomVm['switchRoomGeometryMode']
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const {
    catalogs,
    selectedRoom,
    selectedRoomGeometryMode,
    selectedRoomCeilingScopes,
    ceilingSegments,
    firstCeilingScope,
    effectiveCeilingPaintLabel,
    effectiveCeilingPrimerLabel,
    ceilingPaintOptions,
    ceilingPrimerOptions,
    colorCodeOptions,
    updateScope,
    addScope,
    deleteScope,
    moveScope,
    addSegment,
    deleteSegment,
    moveSegment,
    updateSegment,
  } = ceilingsVm

  if (!selectedRoom) return null

  return (
    <CeilingsScopePanel>
      <Advanced styles={sharedStyles(styles)}>
        <div style={{ ...styles.mono, marginBottom: 6 }}>Ceiling Setup</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 2 }}>
          {selectedRoomCeilingScopes.length === 0 && (
            <button
              type="button"
              style={styles.button}
              onClick={() => switchRoomGeometryMode(selectedRoom.roomId, selectedRoomGeometryMode)}
            >
              + Add ceiling scope
            </button>
          )}

          {selectedRoomGeometryMode === 'RECT' && firstCeilingScope && (() => {
            const ceilLenSf =
              numberOrNull(firstCeilingScope.areaSf) ??
              (() => {
                const L = numberOrNull(selectedRoom.lengthIn)
                const W = numberOrNull(selectedRoom.widthIn)
                return L && W ? (L * W) / 144 : null
              })()
            return (
              <>
                <div className="geometry-primary-grid">
                  <Field label="Area Override (sf)" styles={sharedStyles(styles)}>
                    <input
                      value={firstCeilingScope.areaSf}
                      onChange={(e) => updateScope(firstCeilingScope.id, { areaSf: e.target.value })}
                      style={styles.input}
                      type="number"
                      min="0"
                      placeholder="optional - uses room LxW"
                    />
                  </Field>
                  <div className={ceilLenSf != null ? 'walksqft-box' : 'walksqft-box-empty'}>
                    <div style={styles.mono}>Ceiling Sq Ft</div>
                    <div
                      style={{
                        ...styles.computedBig,
                        color: ceilLenSf != null ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
                      }}
                    >
                      {toDisplayNumber(ceilLenSf)}
                    </div>
                  </div>
                </div>
                <div className="paint-setup-grid">
                  <Field label="Ceiling Type" styles={sharedStyles(styles)}>
                    <select
                      value={firstCeilingScope.ceilingTypeId}
                      onChange={(e) => updateScope(firstCeilingScope.id, { ceilingTypeId: e.target.value })}
                      style={styles.input}
                    >
                      <option value="">Flat (1.0x)</option>
                      {catalogs.ceiling_types.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <CeilingGeometryFields
                  scope={firstCeilingScope}
                  room={selectedRoom}
                  catalogs={catalogs}
                  styles={styles}
                  updateScope={updateScope}
                  toDisplayNumber={toDisplayNumber}
                />
                <Field label="Primer Mode" styles={sharedStyles(styles)}>
                  <PrimerModeButtons
                    currentMode={firstCeilingScope.primeMode}
                    onChange={(mode) => updateScope(firstCeilingScope.id, { primeMode: mode, primerProductId: mode === 'NONE' ? '' : firstCeilingScope.primerProductId })}
                    styles={{ button: styles.button }}
                  />
                </Field>
                {firstCeilingScope.primeMode === 'SPOT' && (
                  <Field label="Spot Primer %" styles={sharedStyles(styles)}>
                    <input
                      value={firstCeilingScope.spotPrimePercent}
                      onChange={(e) => updateScope(firstCeilingScope.id, { spotPrimePercent: e.target.value })}
                      style={styles.input}
                      type="number"
                      min="0"
                      max="100"
                    />
                  </Field>
                )}
              </>
            )
          })()}

          {selectedRoomGeometryMode === 'SEG' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>Ceiling Scopes</div>
                <button type="button" style={styles.button} onClick={() => addScope(selectedRoom.roomId)}>
                  + Add scope
                </button>
              </div>
              {selectedRoomCeilingScopes.map((scope, scopeIndex) => {
                const scopeSegs = sortByPosition(
                  ceilingSegments.filter((segment) => segment.ceilingScopeId === scope.id)
                )
                return (
                  <div
                    key={scope.id}
                    style={{
                      border: '1px solid var(--v2-line)',
                      borderRadius: 14,
                      padding: 16,
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    <ItemActionRow
                      styles={{ mono: styles.mono }}
                      meta={`Scope ${scopeIndex + 1}`}
                      title={scope.scopeName || 'Ceiling scope'}
                      actions={
                        <ReorderDeleteActions
                          styles={{ button: styles.button }}
                          disableMoveUp={scopeIndex === 0}
                          disableMoveDown={scopeIndex === selectedRoomCeilingScopes.length - 1}
                          onMoveUp={() => moveScope(selectedRoom.roomId, scope.id, -1)}
                          onMoveDown={() => moveScope(selectedRoom.roomId, scope.id, 1)}
                          onDelete={() => deleteScope(selectedRoom.roomId, scope.id)}
                        />
                      }
                    />
                    <div className="paint-setup-grid">
                      <Field label="Ceiling Type" styles={sharedStyles(styles)}>
                        <select
                          value={scope.ceilingTypeId}
                          onChange={(e) => updateScope(scope.id, { ceilingTypeId: e.target.value })}
                          style={styles.input}
                        >
                          <option value="">Flat (1.0x)</option>
                          {catalogs.ceiling_types.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <CeilingGeometryFields
                      scope={scope}
                      room={selectedRoom}
                      catalogs={catalogs}
                      styles={styles}
                      updateScope={updateScope}
                      toDisplayNumber={toDisplayNumber}
                    />
                    <button type="button" style={styles.button} onClick={() => addSegment(selectedRoom.roomId, scope.id)}>
                      + Add segment
                    </button>
                    {scopeSegs.map((segment, segmentIndex) => (
                      <div
                        key={segment.id}
                        style={{
                          border: '1px solid var(--v2-line)',
                          borderRadius: 12,
                          padding: 14,
                          background: '#111111',
                          display: 'grid',
                          gap: 12,
                        }}
                      >
                        <ItemActionRow
                          styles={{ mono: styles.mono }}
                          meta={`Segment ${segmentIndex + 1}`}
                          title={segment.segmentName || 'unnamed'}
                          actions={
                            <ReorderDeleteActions
                              styles={{ button: styles.button }}
                              disableMoveUp={segmentIndex === 0}
                              disableMoveDown={segmentIndex === scopeSegs.length - 1}
                              onMoveUp={() => moveSegment(scope.id, segment.id, -1)}
                              onMoveDown={() => moveSegment(scope.id, segment.id, 1)}
                              onDelete={() => deleteSegment(scope.id, segment.id)}
                            />
                          }
                        />
                        <SharedSegmentGrid>
                          <Field label="Name" styles={sharedStyles(styles)}><input value={segment.segmentName} onChange={(e) => updateSegment(segment.id, { segmentName: e.target.value })} style={styles.input} /></Field>
                          <Field label="Include" styles={sharedStyles(styles)}><select value={segment.include} onChange={(e) => updateSegment(segment.id, { include: e.target.value as 'Y' | 'N' })} style={styles.input}><option value="Y">Included</option><option value="N">Excluded</option></select></Field>
                          <Field label="Shape" styles={sharedStyles(styles)}><select value={segment.shapeType} onChange={(e) => updateSegment(segment.id, { shapeType: e.target.value as CeilingSegmentShape })} style={styles.input}><option value="RECTANGLE">Rectangle</option><option value="TRIANGLE">Triangle</option><option value="MANUAL">Manual</option></select></Field>
                          <Field label="Qty" styles={sharedStyles(styles)}><input value={segment.quantity} onChange={(e) => updateSegment(segment.id, { quantity: e.target.value })} style={styles.input} /></Field>
                          <Field label="Width (in)" styles={sharedStyles(styles)}><input value={segment.widthIn} onChange={(e) => updateSegment(segment.id, { widthIn: e.target.value })} style={{ ...styles.input, opacity: segment.shapeType === 'RECTANGLE' ? 1 : 0.5 }} disabled={segment.shapeType !== 'RECTANGLE'} /></Field>
                          <Field label="Height (in)" styles={sharedStyles(styles)}><input value={segment.heightIn} onChange={(e) => updateSegment(segment.id, { heightIn: e.target.value })} style={{ ...styles.input, opacity: segment.shapeType !== 'MANUAL' ? 1 : 0.5 }} disabled={segment.shapeType === 'MANUAL'} /></Field>
                          <Field label="Base (in)" styles={sharedStyles(styles)}><input value={segment.baseIn} onChange={(e) => updateSegment(segment.id, { baseIn: e.target.value })} style={{ ...styles.input, opacity: segment.shapeType === 'TRIANGLE' ? 1 : 0.5 }} disabled={segment.shapeType !== 'TRIANGLE'} /></Field>
                          <Field label="Manual Area (sf)" styles={sharedStyles(styles)}><input value={segment.manualAreaSqFt} onChange={(e) => updateSegment(segment.id, { manualAreaSqFt: e.target.value })} style={{ ...styles.input, opacity: segment.shapeType === 'MANUAL' ? 1 : 0.5 }} disabled={segment.shapeType !== 'MANUAL'} /></Field>
                        </SharedSegmentGrid>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {firstCeilingScope && (
            <div style={{ border: '1px solid var(--v2-line)', borderRadius: 9, padding: 10 }}>
              <AdvancedPanelToggle
                label="Ceiling Overrides"
                open={!!openCeilingAdvanced[selectedRoom.roomId]}
                onToggle={() =>
                  setOpenCeilingAdvanced((prev) => ({
                    ...prev,
                    [selectedRoom.roomId]: !prev[selectedRoom.roomId],
                  }))
                }
                styles={{ mono: styles.mono }}
              />
              {openCeilingAdvanced[selectedRoom.roomId] && (
                <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                  <div className="advanced-grid">
                    <Field label="Include" styles={sharedStyles(styles)}><select value={firstCeilingScope.include} onChange={(e) => updateScope(firstCeilingScope.id, { include: e.target.value as 'Y' | 'N' })} style={styles.input}><option value="Y">Included</option><option value="N">Excluded</option></select></Field>
                    <Field label="Scope Name" styles={sharedStyles(styles)}><input value={firstCeilingScope.scopeName} onChange={(e) => updateScope(firstCeilingScope.id, { scopeName: e.target.value })} style={styles.input} /></Field>
                    <Field label="Height Factor" styles={sharedStyles(styles)}><input value={firstCeilingScope.heightFactor} onChange={(e) => updateScope(firstCeilingScope.id, { heightFactor: e.target.value })} style={styles.input} /></Field>
                    <Field label="Complexity Factor" styles={sharedStyles(styles)}><input value={firstCeilingScope.complexityFactor} readOnly style={{ ...styles.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                    <Field label="Ceiling Flag Factor" styles={sharedStyles(styles)}><input value={firstCeilingScope.ceilingFlagFactor} readOnly style={{ ...styles.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                    <Field label="Paint Coats" styles={sharedStyles(styles)}><input value={firstCeilingScope.paintCoats} onChange={(e) => updateScope(firstCeilingScope.id, { paintCoats: e.target.value })} style={styles.input} /></Field>
                  </div>
                  <div>
                    <div style={{ ...styles.mono, marginBottom: 6 }}>Overrides</div>
                    <div className="advanced-grid">
                      <Field label="Paint Override" styles={sharedStyles(styles)}><select value={firstCeilingScope.paintProductId} onChange={(e) => updateScope(firstCeilingScope.id, { paintProductId: e.target.value })} style={styles.input}><option value="">{effectiveCeilingPaintLabel}</option>{ceilingPaintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></Field>
                      {firstCeilingScope.primeMode !== 'NONE' && (
                        <Field label="Primer Override" styles={sharedStyles(styles)}><select value={firstCeilingScope.primerProductId} onChange={(e) => updateScope(firstCeilingScope.id, { primerProductId: e.target.value })} style={styles.input}><option value="">{effectiveCeilingPrimerLabel}</option>{ceilingPrimerOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></Field>
                      )}
                      <Field label="Color Slot" styles={sharedStyles(styles)}><select value={firstCeilingScope.colorId} onChange={(e) => updateScope(firstCeilingScope.id, { colorId: e.target.value })} style={styles.input}>{colorCodeOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></Field>
                      <Field label="Area (sf)" styles={sharedStyles(styles)}><input value={firstCeilingScope.overrideAreaSqFt} onChange={(e) => updateScope(firstCeilingScope.id, { overrideAreaSqFt: e.target.value })} style={styles.input} /></Field>
                      <Field label="Paint Hrs" styles={sharedStyles(styles)}><input value={firstCeilingScope.overridePaintHours} onChange={(e) => updateScope(firstCeilingScope.id, { overridePaintHours: e.target.value })} style={styles.input} /></Field>
                      <Field label="Primer Hrs" styles={sharedStyles(styles)}><input value={firstCeilingScope.overridePrimerHours} onChange={(e) => updateScope(firstCeilingScope.id, { overridePrimerHours: e.target.value })} style={styles.input} /></Field>
                      <Field label="Supply Cost" styles={sharedStyles(styles)}><input value={firstCeilingScope.overrideSupplyCost} onChange={(e) => updateScope(firstCeilingScope.id, { overrideSupplyCost: e.target.value })} style={styles.input} /></Field>
                      <Field label="Total" styles={sharedStyles(styles)}><input value={firstCeilingScope.overrideTotal} onChange={(e) => updateScope(firstCeilingScope.id, { overrideTotal: e.target.value })} style={styles.input} /></Field>
                    </div>
                  </div>
                  <Field label="Notes" styles={sharedStyles(styles)}><textarea value={firstCeilingScope.notes} onChange={(e) => updateScope(firstCeilingScope.id, { notes: e.target.value })} style={styles.textarea} /></Field>
                </div>
              )}
            </div>
          )}
        </div>
      </Advanced>
      <EstimateV2ConditionsPanel
        title="Ceiling Conditions"
        scope="ceiling"
        catalog={ceilingsVm.conditionModifiers ?? []}
        selections={ceilingsVm.conditionSelections}
        onChange={ceilingsVm.setSelectedRoomCeilingCondition ?? (() => undefined)}
        styles={styles}
      />
    </CeilingsScopePanel>
  )
}
