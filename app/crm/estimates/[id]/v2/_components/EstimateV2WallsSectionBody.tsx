'use client'

import { deriveEstimateV2Segment, sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { numberOrNull } from '../_lib/estimateV2EditorNormalize'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { EstimateV2EditorWallsVm } from '../_state/estimateV2EditorTypes'
import {
  AdvancedPanelToggle,
  Advanced,
  Field,
  ItemActionRow,
  OptionalInputFrame,
  PaintCoatButtons,
  PrimerModeButtons,
  RequiredInputFrame,
  ReorderDeleteActions,
  ScopeHelperBar,
  SharedSegmentGrid,
  WallsScopePanel,
} from './EstimateV2EditorPrimitives'
import { EstimateV2ConditionsPanel } from './EstimateV2ConditionsPanel'
import type {
  EstimateV2RoomDraft,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
  EstimateV2WallSegmentShape as WallSegmentShape,
} from '@/types/estimator/v2'

type EditorStyles = Record<string, CSSProperties>
const OPENING_STEP = 0.5
const STANDARD_DOOR_DEDUCTION_SF = 21
const STANDARD_WINDOW_DEDUCTION_SF = 15

const sharedStyles = (styles: EditorStyles) => ({
  label: styles.label,
  mono: styles.mono,
  panel: styles.panel,
})

function nextOpeningCount(value: string, delta: number) {
  return String(Math.max(0, (numberOrNull(value) ?? 0) + delta))
}

function positiveFactor(value: string) {
  const parsed = numberOrNull(value)
  return parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function wallAreaFactor(scope: EstimateV2WallScopeDraft) {
  return (
    positiveFactor(scope.heightFactor) *
    positiveFactor(scope.complexityFactor) *
    positiveFactor(scope.wallFlagFactor)
  )
}

function formatCurrency(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '--' : `$${value.toFixed(2)}`
}

function rectWallBaseArea(scope: EstimateV2WallScopeDraft, room: EstimateV2RoomDraft | null) {
  const perimeter =
    numberOrNull(scope.perimeterIn) ??
    (() => {
      const length = numberOrNull(room?.lengthIn ?? '')
      const width = numberOrNull(room?.widthIn ?? '')
      return length != null && width != null ? 2 * (length + width) : null
    })()
  const height = numberOrNull(scope.heightIn) ?? numberOrNull(room?.heightIn ?? '')
  return perimeter != null && height != null ? (perimeter * height) / 144 : null
}

function wallOpeningDeduct(source: {
  standardDoorCount: string
  standardWindowCount: string
}) {
  return (
    (numberOrNull(source.standardDoorCount) ?? 0) * STANDARD_DOOR_DEDUCTION_SF +
    (numberOrNull(source.standardWindowCount) ?? 0) * STANDARD_WINDOW_DEDUCTION_SF
  )
}

function segmentBaseArea(segment: EstimateV2WallSegmentDraft) {
  return deriveEstimateV2Segment(segment).rawArea
}

function segmentOpeningDeduct(segment: EstimateV2WallSegmentDraft) {
  return deriveEstimateV2Segment(segment).deductionArea
}

export function EstimateV2WallsSectionBody({
  styles,
  wallsVm,
  openAdvanced,
  setOpenAdvanced,
  toDisplayNumber,
}: {
  styles: EditorStyles
  wallsVm: EstimateV2EditorWallsVm
  openAdvanced: Record<string, boolean>
  setOpenAdvanced: Dispatch<SetStateAction<Record<string, boolean>>>
  toDisplayNumber: (value: number | null | undefined) => string
}) {
  const {
    selectedRoom,
    selectedRoomGeometryMode,
    selectedRoomScopes,
    segments,
    displayedSegmentEffectiveAreaById,
    displayedScopeEffectiveAreaById,
    firstScope,
    wallProductionRates,
    wallPaintOptions,
    wallPrimerOptions,
    colorCodeOptions,
    effectiveWallPaintLabel,
    effectiveWallPrimerLabel,
    wallScopeEffectiveTotalById,
    updateRoomComplexity,
    updateScope,
    updateSegment,
    moveScope,
    deleteScope,
    addSegment,
    moveSegment,
    deleteSegment,
  } = wallsVm

  if (!selectedRoom) return null

  return (
    <WallsScopePanel>
      <Advanced styles={sharedStyles(styles)}>
        <div style={{ ...styles.mono, marginBottom: 6 }}>Wall Setup</div>
        {firstScope && (
          <>
            <div className="paint-setup-grid">
              <Field label="Wall Condition / Rate" styles={sharedStyles(styles)}>
                <RequiredInputFrame>
                  <select value={selectedRoom.wallComplexityId} onChange={(e) => updateRoomComplexity(selectedRoom.roomId, e.target.value)} style={styles.input}>
                    <option value="">Painted drywall - standard repaint</option>
                    {wallProductionRates.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </RequiredInputFrame>
              </Field>
              <Field label="Coats" styles={sharedStyles(styles)}>
                <RequiredInputFrame>
                  <PaintCoatButtons
                    value={firstScope.paintCoats}
                    onChange={(value) => updateScope(firstScope.id, { paintCoats: value })}
                    styles={{ button: styles.button }}
                  />
                </RequiredInputFrame>
              </Field>
            </div>
            <Field label="Primer Mode" styles={sharedStyles(styles)}>
              <RequiredInputFrame>
                <PrimerModeButtons
                  currentMode={firstScope.primeMode}
                  onChange={(mode) => updateScope(firstScope.id, { primeMode: mode, primerProductId: mode === 'NONE' ? '' : firstScope.primerProductId })}
                  styles={{ button: styles.button }}
                />
              </RequiredInputFrame>
            </Field>
            {firstScope.primeMode === 'SPOT' && (
              <Field label="Spot Primer %" styles={sharedStyles(styles)}>
                <OptionalInputFrame>
                  <input value={firstScope.spotPrimePercent} onChange={(e) => updateScope(firstScope.id, { spotPrimePercent: e.target.value })} style={styles.input} type="number" min="0" max="100" step="1" placeholder="0 - 100" />
                </OptionalInputFrame>
              </Field>
            )}
          </>
        )}
        {selectedRoomGeometryMode === 'SEG' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {selectedRoomScopes.map((scope, scopeIndex) => {
              const scopeSegments = sortByPosition(segments.filter((seg) => seg.wallScopeId === scope.id))
              const scopeEffectiveArea = displayedScopeEffectiveAreaById.get(scope.id) ?? null
              const scopeSubtotal = wallScopeEffectiveTotalById.get(scope.id) ?? null
              const scopeBaseArea = scopeSegments.reduce((sum, segment) => sum + (segmentBaseArea(segment) ?? 0), 0)
              const scopeOpeningDeduct = scopeSegments.reduce((sum, segment) => sum + segmentOpeningDeduct(segment), 0)
              const scopeFactor = wallAreaFactor(scope)
              return (
                <div
                  key={scope.id}
                  style={{
                    border: '1px solid var(--v2-line)',
                    borderRadius: 14,
                    padding: 16,
                    background: '#111111',
                    display: 'grid',
                    gap: 16,
                  }}
                >
                  <ScopeHelperBar
                    styles={{ mono: styles.mono, computedBig: styles.computedBig }}
                    metrics={[
                      { label: 'Base Sq Ft', value: toDisplayNumber(scopeBaseArea) },
                      { label: 'Opening Deduct', value: toDisplayNumber(scopeOpeningDeduct), muted: scopeOpeningDeduct <= 0 },
                      { label: 'Area Factor', value: toDisplayNumber(scopeFactor) },
                      { label: 'Final Sq Ft', value: toDisplayNumber(scopeEffectiveArea), muted: scopeEffectiveArea == null },
                      { label: 'Subtotal', value: formatCurrency(scopeSubtotal), muted: scopeSubtotal == null },
                    ]}
                  />
                  {selectedRoomScopes.length > 1 && (
                    <ItemActionRow
                      styles={{ mono: styles.mono }}
                      meta={`Scope ${scopeIndex + 1}`}
                      title={`${scope.scopeName || 'SEG scope'} - ${toDisplayNumber(scopeEffectiveArea)} sf`}
                      actions={
                        <ReorderDeleteActions
                          styles={{ button: styles.button }}
                          disableMoveUp={scopeIndex === 0}
                          disableMoveDown={scopeIndex === selectedRoomScopes.length - 1}
                          onMoveUp={() => moveScope(selectedRoom.roomId, scope.id, -1)}
                          onMoveDown={() => moveScope(selectedRoom.roomId, scope.id, 1)}
                          onDelete={() => deleteScope(selectedRoom.roomId, scope.id)}
                        />
                      }
                    />
                  )}
                  <button type="button" style={styles.button} onClick={() => addSegment(selectedRoom.roomId, scope.id)}>
                    + Add segment
                  </button>
                  {scopeSegments.map((segment, segIdx) => {
                    const segmentEffectiveArea = displayedSegmentEffectiveAreaById.get(segment.id) ?? null
                    return (
                      <div
                        key={segment.id}
                        style={{
                          border: '1px solid var(--v2-line)',
                          borderRadius: 12,
                          padding: 14,
                          background: '#111111',
                          display: 'grid',
                          gap: 14,
                        }}
                      >
                        <ItemActionRow
                          styles={{ mono: styles.mono }}
                          meta={`Segment ${segIdx + 1}`}
                          title={`${segment.segmentName || 'Unnamed'} - ${toDisplayNumber(segmentEffectiveArea)} sf`}
                          actions={
                            <ReorderDeleteActions
                              styles={{ button: styles.button }}
                              disableMoveUp={segIdx === 0}
                              disableMoveDown={segIdx === scopeSegments.length - 1}
                              onMoveUp={() => moveSegment(scope.id, segment.id, -1)}
                              onMoveDown={() => moveSegment(scope.id, segment.id, 1)}
                              onDelete={() => deleteSegment(scope.id, segment.id)}
                            />
                          }
                        />
                        <SharedSegmentGrid>
                          <Field label="Name" styles={sharedStyles(styles)}><OptionalInputFrame><input value={segment.segmentName} onChange={(e) => updateSegment(segment.id, { segmentName: e.target.value })} style={styles.input} /></OptionalInputFrame></Field>
                          <Field label="Include" styles={sharedStyles(styles)}><OptionalInputFrame><select value={segment.include} onChange={(e) => updateSegment(segment.id, { include: e.target.value as 'Y' | 'N' })} style={styles.input}><option value="Y">Included</option><option value="N">Excluded</option></select></OptionalInputFrame></Field>
                          <Field label="Shape" styles={sharedStyles(styles)}><RequiredInputFrame><select value={segment.shapeType} onChange={(e) => updateSegment(segment.id, { shapeType: e.target.value as WallSegmentShape })} style={styles.input}><option value="RECTANGLE">Rectangle</option><option value="TRIANGLE">Triangle</option><option value="MANUAL">Manual</option></select></RequiredInputFrame></Field>
                          <Field label="Qty" styles={sharedStyles(styles)}><RequiredInputFrame><input value={segment.quantity} onChange={(e) => updateSegment(segment.id, { quantity: e.target.value })} style={styles.input} /></RequiredInputFrame></Field>
                          <Field label="Width (in)" styles={sharedStyles(styles)}>{segment.shapeType === 'RECTANGLE' ? <RequiredInputFrame><input value={segment.widthIn} onChange={(e) => updateSegment(segment.id, { widthIn: e.target.value })} style={styles.input} /></RequiredInputFrame> : <OptionalInputFrame><input value={segment.widthIn} onChange={(e) => updateSegment(segment.id, { widthIn: e.target.value })} style={{ ...styles.input, opacity: 0.5 }} disabled /></OptionalInputFrame>}</Field>
                          <Field label="Height (in)" styles={sharedStyles(styles)}>{segment.shapeType !== 'MANUAL' ? <RequiredInputFrame><input value={segment.heightIn} onChange={(e) => updateSegment(segment.id, { heightIn: e.target.value })} style={styles.input} /></RequiredInputFrame> : <OptionalInputFrame><input value={segment.heightIn} onChange={(e) => updateSegment(segment.id, { heightIn: e.target.value })} style={{ ...styles.input, opacity: 0.5 }} disabled /></OptionalInputFrame>}</Field>
                          <Field label="Base (in)" styles={sharedStyles(styles)}>{segment.shapeType === 'TRIANGLE' ? <RequiredInputFrame><input value={segment.baseIn} onChange={(e) => updateSegment(segment.id, { baseIn: e.target.value })} style={styles.input} /></RequiredInputFrame> : <OptionalInputFrame><input value={segment.baseIn} onChange={(e) => updateSegment(segment.id, { baseIn: e.target.value })} style={{ ...styles.input, opacity: 0.5 }} disabled /></OptionalInputFrame>}</Field>
                          <Field label="Manual Area (sf)" styles={sharedStyles(styles)}>{segment.shapeType === 'MANUAL' ? <RequiredInputFrame><input value={segment.manualAreaSqFt} onChange={(e) => updateSegment(segment.id, { manualAreaSqFt: e.target.value })} style={styles.input} /></RequiredInputFrame> : <OptionalInputFrame><input value={segment.manualAreaSqFt} onChange={(e) => updateSegment(segment.id, { manualAreaSqFt: e.target.value })} style={{ ...styles.input, opacity: 0.5 }} disabled /></OptionalInputFrame>}</Field>
                          <Field label="Doors" styles={sharedStyles(styles)}><OptionalInputFrame><input value={segment.standardDoorCount} onChange={(e) => updateSegment(segment.id, { standardDoorCount: e.target.value })} style={styles.input} type="number" min="0" step="0.5" /></OptionalInputFrame></Field>
                          <Field label="Windows" styles={sharedStyles(styles)}><OptionalInputFrame><input value={segment.standardWindowCount} onChange={(e) => updateSegment(segment.id, { standardWindowCount: e.target.value })} style={styles.input} type="number" min="0" step="0.5" /></OptionalInputFrame></Field>
                          <Field label="Area Override (sf)" styles={sharedStyles(styles)}><OptionalInputFrame><input value={segment.overrideAreaSqFt} onChange={(e) => updateSegment(segment.id, { overrideAreaSqFt: e.target.value })} style={styles.input} /></OptionalInputFrame></Field>
                        </SharedSegmentGrid>
                        <Field label="Notes" styles={sharedStyles(styles)}><OptionalInputFrame><textarea value={segment.notes} onChange={(e) => updateSegment(segment.id, { notes: e.target.value })} style={styles.textarea} /></OptionalInputFrame></Field>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {firstScope && (() => {
              const baseArea = rectWallBaseArea(firstScope, selectedRoom)
              const openingDeduct = wallOpeningDeduct(firstScope)
              const areaFactor = wallAreaFactor(firstScope)
              const finalArea = displayedScopeEffectiveAreaById.get(firstScope.id) ?? null
              const subtotal = wallScopeEffectiveTotalById.get(firstScope.id) ?? null
              return (
                <div style={{ display: 'grid', gap: 10 }}>
                  <ScopeHelperBar
                    styles={{ mono: styles.mono, computedBig: styles.computedBig }}
                    metrics={[
                      { label: 'Base Sq Ft', value: toDisplayNumber(baseArea) },
                      { label: 'Opening Deduct', value: toDisplayNumber(openingDeduct), muted: openingDeduct <= 0 },
                      { label: 'Area Factor', value: toDisplayNumber(areaFactor) },
                      { label: 'Final Sq Ft', value: toDisplayNumber(finalArea), muted: finalArea == null },
                      { label: 'Subtotal', value: formatCurrency(subtotal), muted: subtotal == null },
                    ]}
                  />
                  <div className="geometry-secondary-grid">
                    <Field label="Doors" styles={sharedStyles(styles)}>
                      <OptionalInputFrame><div style={styles.stepper}>
                    <button type="button" className="stepper-btn" style={styles.stepperBtn} onClick={() => updateScope(firstScope.id, { standardDoorCount: nextOpeningCount(firstScope.standardDoorCount, -OPENING_STEP) })}>-</button>
                    <span style={styles.stepperVal}>{firstScope.standardDoorCount || '0'}</span>
                    <button type="button" className="stepper-btn" style={styles.stepperBtn} onClick={() => updateScope(firstScope.id, { standardDoorCount: nextOpeningCount(firstScope.standardDoorCount, OPENING_STEP) })}>+</button>
                      </div></OptionalInputFrame>
                    </Field>
                    <Field label="Windows" styles={sharedStyles(styles)}>
                      <OptionalInputFrame><div style={styles.stepper}>
                    <button type="button" className="stepper-btn" style={styles.stepperBtn} onClick={() => updateScope(firstScope.id, { standardWindowCount: nextOpeningCount(firstScope.standardWindowCount, -OPENING_STEP) })}>-</button>
                    <span style={styles.stepperVal}>{firstScope.standardWindowCount || '0'}</span>
                    <button type="button" className="stepper-btn" style={styles.stepperBtn} onClick={() => updateScope(firstScope.id, { standardWindowCount: nextOpeningCount(firstScope.standardWindowCount, OPENING_STEP) })}>+</button>
                      </div></OptionalInputFrame>
                    </Field>
                    <Field label="Height Factor" styles={sharedStyles(styles)}>
                      <OptionalInputFrame><div style={{ ...styles.input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default', height: 34 }}>
                    <span>Standard</span>
                    <span style={{ ...styles.mono, color: 'var(--v2-green-2)' }}>{firstScope.heightFactor ? `${firstScope.heightFactor}x` : '1.0x'}</span>
                      </div></OptionalInputFrame>
                    </Field>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </Advanced>

      <EstimateV2ConditionsPanel
        title="Wall Conditions"
        scope="wall"
        catalog={wallsVm.conditionModifiers ?? []}
        selections={wallsVm.conditionSelections}
        onChange={wallsVm.setSelectedRoomWallCondition ?? (() => undefined)}
        styles={styles}
      />

      <Advanced styles={sharedStyles(styles)}>
        <AdvancedPanelToggle
          label="Advanced / Overrides"
          open={!!openAdvanced[selectedRoom.roomId]}
          onToggle={() =>
            setOpenAdvanced((prev) => ({
              ...prev,
              [selectedRoom.roomId]: !prev[selectedRoom.roomId],
            }))
          }
          styles={{ mono: styles.mono }}
        />
        {openAdvanced[selectedRoom.roomId] && firstScope && (
          <OptionalInputFrame>
          <div style={{ marginTop: 2, display: 'grid', gap: 10 }}>
            <div className="advanced-grid">
              <Field label="Include" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><select value={firstScope.include} onChange={(e) => updateScope(firstScope.id, { include: e.target.value as 'Y' | 'N' })} style={styles.input}><option value="Y">Included</option><option value="N">Excluded</option></select></Field>
              <Field label="Scope Name" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.scopeName} onChange={(e) => updateScope(firstScope.id, { scopeName: e.target.value })} style={styles.input} /></Field>
              <Field label="Height (in)" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.heightIn} onChange={(e) => updateScope(firstScope.id, { heightIn: e.target.value })} style={styles.input} /></Field>
              <Field label="Perimeter (in)" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.perimeterIn} onChange={(e) => updateScope(firstScope.id, { perimeterIn: e.target.value })} style={styles.input} /></Field>
              <Field label="Height Factor" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.heightFactor} onChange={(e) => updateScope(firstScope.id, { heightFactor: e.target.value })} style={styles.input} /></Field>
                <Field label="Complexity Factor" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.complexityFactor} readOnly style={{ ...styles.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                <Field label="Wall Flag Factor" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.wallFlagFactor} readOnly style={{ ...styles.input, opacity: 0.7, cursor: 'not-allowed' }} /></Field>
                <Field label="Cut-In Top" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.cutInTopFactor} onChange={(e) => updateScope(firstScope.id, { cutInTopFactor: e.target.value })} style={styles.input} /></Field>
                <Field label="Cut-In Bottom" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.cutInBottomFactor} onChange={(e) => updateScope(firstScope.id, { cutInBottomFactor: e.target.value })} style={styles.input} /></Field>
              </div>
            <div>
              <div style={{ ...styles.mono, marginBottom: 6 }}>Overrides</div>
              <div className="advanced-grid">
                <Field label="Paint Override" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><select value={firstScope.paintProductId} onChange={(e) => updateScope(firstScope.id, { paintProductId: e.target.value })} style={styles.input}><option value="">{effectiveWallPaintLabel}</option>{wallPaintOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></Field>
                {firstScope.primeMode !== 'NONE' && (
                  <Field label="Primer Override" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><select value={firstScope.primerProductId} onChange={(e) => updateScope(firstScope.id, { primerProductId: e.target.value })} style={styles.input}><option value="">{effectiveWallPrimerLabel}</option>{wallPrimerOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></Field>
                )}
                <Field label="Color Slot" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><select value={firstScope.colorId} onChange={(e) => updateScope(firstScope.id, { colorId: e.target.value })} style={styles.input}>{colorCodeOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></Field>
                <Field label="Area Override (sf)" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.overrideAreaSqFt} onChange={(e) => updateScope(firstScope.id, { overrideAreaSqFt: e.target.value })} style={styles.input} /></Field>
                <Field label="Paint Hours Override" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.overridePaintHours} onChange={(e) => updateScope(firstScope.id, { overridePaintHours: e.target.value })} style={styles.input} /></Field>
                <Field label="Primer Hours Override" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.overridePrimerHours} onChange={(e) => updateScope(firstScope.id, { overridePrimerHours: e.target.value })} style={styles.input} /></Field>
                <Field label="Supply Cost Override" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.overrideSupplyCost} onChange={(e) => updateScope(firstScope.id, { overrideSupplyCost: e.target.value })} style={styles.input} /></Field>
                <Field label="Total Override" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={firstScope.overrideTotal} onChange={(e) => updateScope(firstScope.id, { overrideTotal: e.target.value })} style={styles.input} /></Field>
              </div>
            </div>
            <Field label="Scope Notes" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><textarea value={firstScope.notes} onChange={(e) => updateScope(firstScope.id, { notes: e.target.value })} style={styles.textarea} /></Field>
          </div>
          </OptionalInputFrame>
        )}
      </Advanced>

    </WallsScopePanel>
  )
}
