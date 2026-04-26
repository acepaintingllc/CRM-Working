'use client'

import { sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { numberOrNull } from '../_lib/estimateV2EditorNormalize'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { EstimateV2EditorWallsVm } from '../_state/estimateV2EditorTypes'
import {
  AdvancedPanelToggle,
  Advanced,
  Field,
  GeometryBlock,
  ItemActionRow,
  PaintSetup,
  PrimerModeButtons,
  ReorderDeleteActions,
  SharedSegmentGrid,
  WallsScopePanel,
} from './EstimateV2EditorPrimitives'
import type { EstimateV2WallSegmentShape as WallSegmentShape } from '@/types/estimator/v2'

type EditorStyles = Record<string, CSSProperties>
const OPENING_STEP = 0.5

function nextOpeningCount(value: string, delta: number) {
  return String(Math.max(0, (numberOrNull(value) ?? 0) + delta))
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
    updateRoomComplexity,
    updateScope,
    updateSegment,
    addScope,
    moveScope,
    deleteScope,
    addSegment,
    moveSegment,
    deleteSegment,
  } = wallsVm

  if (!selectedRoom) return null

  return (
    <WallsScopePanel>
      <GeometryBlock styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
        {selectedRoomGeometryMode === 'SEG' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={styles.mono}>SEG Mode Scopes</div>
                <div style={{ fontSize: 'calc(16px + 4pt)', fontWeight: 700, marginTop: 6 }}>Segments</div>
              </div>
              <button type="button" style={styles.button} onClick={() => addScope(selectedRoom.roomId)}>
                + Add scope
              </button>
            </div>
            {selectedRoomScopes.map((scope, scopeIndex) => {
              const scopeSegments = sortByPosition(segments.filter((seg) => seg.wallScopeId === scope.id))
              const scopeEffectiveArea = displayedScopeEffectiveAreaById.get(scope.id) ?? null
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
                          <Field label="Name" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.segmentName} onChange={(e) => updateSegment(segment.id, { segmentName: e.target.value })} style={styles.input} /></Field>
                          <Field label="Include" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><select value={segment.include} onChange={(e) => updateSegment(segment.id, { include: e.target.value as 'Y' | 'N' })} style={styles.input}><option value="Y">Included</option><option value="N">Excluded</option></select></Field>
                          <Field label="Shape" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><select value={segment.shapeType} onChange={(e) => updateSegment(segment.id, { shapeType: e.target.value as WallSegmentShape })} style={styles.input}><option value="RECTANGLE">Rectangle</option><option value="TRIANGLE">Triangle</option><option value="MANUAL">Manual</option></select></Field>
                          <Field label="Qty" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.quantity} onChange={(e) => updateSegment(segment.id, { quantity: e.target.value })} style={styles.input} /></Field>
                          <Field label="Width (in)" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.widthIn} onChange={(e) => updateSegment(segment.id, { widthIn: e.target.value })} style={{ ...styles.input, opacity: segment.shapeType === 'RECTANGLE' ? 1 : 0.5 }} disabled={segment.shapeType !== 'RECTANGLE'} /></Field>
                          <Field label="Height (in)" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.heightIn} onChange={(e) => updateSegment(segment.id, { heightIn: e.target.value })} style={{ ...styles.input, opacity: segment.shapeType !== 'MANUAL' ? 1 : 0.5 }} disabled={segment.shapeType === 'MANUAL'} /></Field>
                          <Field label="Base (in)" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.baseIn} onChange={(e) => updateSegment(segment.id, { baseIn: e.target.value })} style={{ ...styles.input, opacity: segment.shapeType === 'TRIANGLE' ? 1 : 0.5 }} disabled={segment.shapeType !== 'TRIANGLE'} /></Field>
                          <Field label="Manual Area (sf)" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.manualAreaSqFt} onChange={(e) => updateSegment(segment.id, { manualAreaSqFt: e.target.value })} style={{ ...styles.input, opacity: segment.shapeType === 'MANUAL' ? 1 : 0.5 }} disabled={segment.shapeType !== 'MANUAL'} /></Field>
                          <Field label="Doors" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.standardDoorCount} onChange={(e) => updateSegment(segment.id, { standardDoorCount: e.target.value })} style={styles.input} type="number" min="0" step="0.5" /></Field>
                          <Field label="Windows" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.standardWindowCount} onChange={(e) => updateSegment(segment.id, { standardWindowCount: e.target.value })} style={styles.input} type="number" min="0" step="0.5" /></Field>
                          <Field label="Area Override (sf)" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><input value={segment.overrideAreaSqFt} onChange={(e) => updateSegment(segment.id, { overrideAreaSqFt: e.target.value })} style={styles.input} /></Field>
                        </SharedSegmentGrid>
                        <Field label="Notes" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}><textarea value={segment.notes} onChange={(e) => updateSegment(segment.id, { notes: e.target.value })} style={styles.textarea} /></Field>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {firstScope && (
              <div className="geometry-secondary-grid">
                <Field label="Doors" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
                  <div style={styles.stepper}>
                    <button type="button" className="stepper-btn" style={styles.stepperBtn} onClick={() => updateScope(firstScope.id, { standardDoorCount: nextOpeningCount(firstScope.standardDoorCount, -OPENING_STEP) })}>-</button>
                    <span style={styles.stepperVal}>{firstScope.standardDoorCount || '0'}</span>
                    <button type="button" className="stepper-btn" style={styles.stepperBtn} onClick={() => updateScope(firstScope.id, { standardDoorCount: nextOpeningCount(firstScope.standardDoorCount, OPENING_STEP) })}>+</button>
                  </div>
                </Field>
                <Field label="Windows" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
                  <div style={styles.stepper}>
                    <button type="button" className="stepper-btn" style={styles.stepperBtn} onClick={() => updateScope(firstScope.id, { standardWindowCount: nextOpeningCount(firstScope.standardWindowCount, -OPENING_STEP) })}>-</button>
                    <span style={styles.stepperVal}>{firstScope.standardWindowCount || '0'}</span>
                    <button type="button" className="stepper-btn" style={styles.stepperBtn} onClick={() => updateScope(firstScope.id, { standardWindowCount: nextOpeningCount(firstScope.standardWindowCount, OPENING_STEP) })}>+</button>
                  </div>
                </Field>
                <Field label="Coats" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
                  <div style={{ display: 'flex', border: '1px solid var(--v2-line)', borderRadius: 9, overflow: 'hidden', height: 34 }}>
                    {[1, 2, 3].map((n) => {
                      const currentCoats = Math.max(1, Math.round(numberOrNull(firstScope.paintCoats) ?? 2))
                      const isActive = currentCoats === n
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => updateScope(firstScope.id, { paintCoats: String(n) })}
                          style={{
                            ...styles.button,
                            border: 'none',
                            borderRadius: 0,
                            borderRight: n < 3 ? '1px solid var(--v2-line)' : 'none',
                            background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                            color: isActive ? 'var(--v2-ink)' : 'var(--v2-ink-3)',
                            minWidth: 40,
                            padding: '0 12px',
                          }}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                </Field>
                <Field label="Height Factor" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
                  <div style={{ ...styles.input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default', height: 34 }}>
                    <span>Standard</span>
                    <span style={{ ...styles.mono, color: 'var(--v2-green-2)' }}>{firstScope.heightFactor ? `${firstScope.heightFactor}x` : '1.0x'}</span>
                  </div>
                </Field>
              </div>
            )}
          </>
        )}
      </GeometryBlock>

      {firstScope && (
        <PaintSetup styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>Paint Setup</div>
            <span style={{ ...styles.mono, color: 'var(--v2-ink-3)' }}>from CAT_ProductionRates</span>
          </div>
          <div className="paint-setup-grid">
            <Field label="Wall Condition / Rate" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
              <select value={selectedRoom.wallComplexityId} onChange={(e) => updateRoomComplexity(selectedRoom.roomId, e.target.value)} style={styles.input}>
                <option value="">Painted drywall - standard repaint</option>
                {wallProductionRates.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Primer Mode" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
            <PrimerModeButtons
              currentMode={firstScope.primeMode}
              onChange={(mode) => updateScope(firstScope.id, { primeMode: mode, primerProductId: mode === 'NONE' ? '' : firstScope.primerProductId })}
              styles={{ button: styles.button }}
            />
          </Field>
          {firstScope.primeMode === 'SPOT' && (
            <Field label="Spot Primer %" styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
              <input value={firstScope.spotPrimePercent} onChange={(e) => updateScope(firstScope.id, { spotPrimePercent: e.target.value })} style={styles.input} type="number" min="0" max="100" step="1" placeholder="0 - 100" />
            </Field>
          )}
        </PaintSetup>
      )}

      <Advanced styles={{ label: styles.label, mono: styles.mono, panel: styles.panel }}>
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
        )}
      </Advanced>
    </WallsScopePanel>
  )
}
