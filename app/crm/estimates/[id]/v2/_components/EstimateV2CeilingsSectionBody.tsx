'use client'

import { sortByPosition } from '@/lib/estimator/v2DraftPayload'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { EstimateV2EditorCeilingsVm, EstimateV2EditorRoomVm } from '../_state/estimateV2EditorTypes'
import {
  Advanced,
  AdvancedPanelToggle,
  CeilingsScopePanel,
  Field,
  ItemActionRow,
  PaintCoatButtons,
  PrimerModeButtons,
  ReorderDeleteActions,
  RequiredInputFrame,
  ScopeHelperBar,
  SharedSegmentGrid,
} from './EstimateV2EditorPrimitives'
import { EstimateV2ConditionsPanel } from './EstimateV2ConditionsPanel'
import { EstimateV2DrywallRepairsBlock } from './EstimateV2DrywallRepairsBlock'
import type {
  EstimateV2CeilingGeometryMode,
  EstimateV2CeilingSegmentShape as CeilingSegmentShape,
} from '@/types/estimator/v2'
import type { EstimateV2CeilingScopeDraft } from '@/types/estimator/v2'
import type { EstimateV2CeilingScopePreviewMetrics } from '../_lib/estimateV2EditorDerived'

type EditorStyles = Record<string, CSSProperties>

const coreMeasurementGroupStyle: CSSProperties = {
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: 'rgba(148, 163, 184, 0.045)',
  borderRadius: 8,
  padding: 10,
}

const sharedStyles = (styles: EditorStyles) => ({
  label: styles.label,
  mono: styles.mono,
  panel: styles.panel,
})

type CeilingTypeShapeOption = {
  value: string
  label: string
  ceilingTypeId: string
  ceilingGeometryMode: EstimateV2CeilingGeometryMode
}

function inferCeilingGeometryMode(option: { id: string; label: string } | null): EstimateV2CeilingGeometryMode {
  const text = `${option?.id ?? ''} ${option?.label ?? ''}`.toUpperCase()
  if (text.includes('COFFER')) return 'COFFERED'
  if (text.includes('TRAY')) return 'TRAY'
  if (text.includes('VAULT') || text.includes('SLOPE') || text.includes('CATHEDRAL')) return 'VAULTED'
  if (text.includes('MANUAL')) return 'MANUAL'
  return 'FLAT'
}

function ceilingTypeShapeOptions(catalogs: EstimateV2EditorCeilingsVm['catalogs']) {
  const catalogOptions = catalogs.ceiling_types.map((opt): CeilingTypeShapeOption => ({
    value: opt.id,
    label: opt.label,
    ceilingTypeId: opt.id,
    ceilingGeometryMode: inferCeilingGeometryMode(opt),
  }))
  if (catalogOptions.some((opt) => opt.value === 'FLAT' || opt.label.toUpperCase() === 'FLAT')) {
    return catalogOptions
  }
  return [
    { value: 'FLAT', label: 'Flat', ceilingTypeId: 'FLAT', ceilingGeometryMode: 'FLAT' },
    ...catalogOptions,
  ]
}

function formatCurrency(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? 'Pending inputs' : `$${value.toFixed(2)}`
}

function CeilingTypeShapeField({
  scope,
  catalogs,
  styles,
  updateScope,
}: {
  scope: EstimateV2CeilingScopeDraft
  catalogs: EstimateV2EditorCeilingsVm['catalogs']
  styles: EditorStyles
  updateScope: EstimateV2EditorCeilingsVm['updateScope']
}) {
  const options = ceilingTypeShapeOptions(catalogs)
  const flatOption = options.find((opt) => opt.value === 'FLAT') ?? options.find((opt) => opt.ceilingGeometryMode === 'FLAT')
  const value = options.some((opt) => opt.value === scope.ceilingTypeId)
    ? scope.ceilingTypeId
    : flatOption?.value ?? options[0]?.value ?? 'FLAT'

  return (
    <Field label="Ceiling Type" styles={sharedStyles(styles)}>
      <RequiredInputFrame>
        <select
          value={value}
          onChange={(e) => {
            const selected = options.find((opt) => opt.value === e.target.value)
            if (!selected) return
            updateScope(scope.id, {
              ceilingTypeId: selected.ceilingTypeId,
              ceilingGeometryMode: selected.ceilingGeometryMode,
            })
          }}
          style={styles.input}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </RequiredInputFrame>
    </Field>
  )
}

function CeilingGeometryFields({
  scope,
  styles,
  updateScope,
  toDisplayNumber,
  metrics,
  subtotal,
}: {
  scope: EstimateV2CeilingScopeDraft
  styles: EditorStyles
  updateScope: EstimateV2EditorCeilingsVm['updateScope']
  toDisplayNumber: (value: number | null | undefined) => string
  metrics: EstimateV2CeilingScopePreviewMetrics | null
  subtotal?: number | null
}) {
  const mode = scope.ceilingGeometryMode || 'FLAT'

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {(mode === 'VAULTED' || mode === 'COFFERED') && (
        <div style={coreMeasurementGroupStyle}>
          <div className="paint-setup-grid">
            {mode === 'VAULTED' && (
              <>
                <Field label="Ridge Length (in)" styles={sharedStyles(styles)}>
                  <input
                    value={scope.vaultedRidgeLengthIn ?? ''}
                    onChange={(e) => updateScope(scope.id, { vaultedRidgeLengthIn: e.target.value })}
                    style={styles.input}
                    type="number"
                    min="0"
                    placeholder="room length"
                  />
                </Field>
                <Field label="Slope Length (in)" styles={sharedStyles(styles)}>
                  <input
                    value={scope.vaultedSlopeLengthIn ?? ''}
                    onChange={(e) => updateScope(scope.id, { vaultedSlopeLengthIn: e.target.value })}
                    style={styles.input}
                    type="number"
                    min="0"
                    placeholder="eave to ridge"
                  />
                </Field>
                <Field label="Planes" styles={sharedStyles(styles)}>
                  <input
                    value={scope.vaultedPlaneCount ?? ''}
                    onChange={(e) => updateScope(scope.id, { vaultedPlaneCount: e.target.value })}
                    style={styles.input}
                    type="number"
                    min="1"
                    step="1"
                  />
                </Field>
              </>
            )}
            {mode === 'COFFERED' && (
              <>
                <Field label="Section Length (in)" styles={sharedStyles(styles)}><input value={scope.cofferSectionLengthIn ?? ''} onChange={(e) => updateScope(scope.id, { cofferSectionLengthIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
                <Field label="Section Width (in)" styles={sharedStyles(styles)}><input value={scope.cofferSectionWidthIn ?? ''} onChange={(e) => updateScope(scope.id, { cofferSectionWidthIn: e.target.value })} style={styles.input} type="number" min="0" /></Field>
                <Field label="Section Count" styles={sharedStyles(styles)}><input value={scope.cofferSectionCount ?? ''} onChange={(e) => updateScope(scope.id, { cofferSectionCount: e.target.value })} style={styles.input} type="number" min="0" /></Field>
              </>
            )}
          </div>
        </div>
      )}
      {mode === 'COFFERED' && (
        <div className="paint-setup-grid">
          <Field label="Recess Depth Optional (in)" styles={sharedStyles(styles)}><input value={scope.cofferFaceHeightIn ?? ''} onChange={(e) => updateScope(scope.id, { cofferFaceHeightIn: e.target.value })} style={styles.input} type="number" min="0" placeholder="optional" /></Field>
          <Field label="Beam Width Optional (in)" styles={sharedStyles(styles)}><input value={scope.cofferBottomWidthIn ?? ''} onChange={(e) => updateScope(scope.id, { cofferBottomWidthIn: e.target.value })} style={styles.input} type="number" min="0" placeholder="optional" /></Field>
        </div>
      )}
      <ScopeHelperBar
        styles={{ mono: styles.mono, computedBig: styles.computedBig }}
        metrics={[
          { label: 'Base Sq Ft', value: toDisplayNumber(metrics?.baseAreaSqFt), muted: metrics?.baseAreaSqFt == null },
          { label: 'Helper Extra', value: toDisplayNumber(metrics?.helperExtraAreaSqFt), muted: (metrics?.helperExtraAreaSqFt ?? 0) <= 0 },
          { label: 'Area Factor', value: toDisplayNumber(metrics?.areaFactor) },
          { label: 'Final Sq Ft', value: toDisplayNumber(metrics?.effectiveAreaSqFt), muted: metrics?.effectiveAreaSqFt == null },
          { label: 'Subtotal', value: formatCurrency(subtotal), muted: subtotal == null },
        ]}
      />
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
    ceilingScopePreviewMetricsById,
    ceilingScopeEffectiveTotalById,
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
            const ceilingGeometryMode = firstCeilingScope.ceilingGeometryMode || 'FLAT'
            const previewMetrics = ceilingScopePreviewMetricsById.get(firstCeilingScope.id) ?? null
            const previewArea = previewMetrics?.effectiveAreaSqFt ?? null
            const subtotal = ceilingScopeEffectiveTotalById.get(firstCeilingScope.id) ?? null
            return (
              <>
                <div className="geometry-primary-grid">
                  <Field
                    label={ceilingGeometryMode === 'VAULTED' ? 'Vaulted Sq Ft Override' : 'Area Override (sf)'}
                    styles={sharedStyles(styles)}
                  >
                    <input
                      value={firstCeilingScope.areaSf}
                      onChange={(e) => updateScope(firstCeilingScope.id, { areaSf: e.target.value })}
                      style={styles.input}
                      type="number"
                      min="0"
                      placeholder={ceilingGeometryMode === 'VAULTED' ? 'optional direct total' : 'optional - uses room LxW'}
                    />
                  </Field>
                  <div className={previewArea != null ? 'walksqft-box' : 'walksqft-box-empty'}>
                    <div style={styles.mono}>Ceiling Sq Ft</div>
                    <div
                      style={{
                        ...styles.computedBig,
                        color: previewArea != null ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
                      }}
                    >
                      {toDisplayNumber(previewArea)}
                    </div>
                  </div>
                </div>
                <div style={coreMeasurementGroupStyle}>
                  <div className="paint-setup-grid">
                    <CeilingTypeShapeField
                      scope={firstCeilingScope}
                      catalogs={catalogs}
                      styles={styles}
                      updateScope={updateScope}
                    />
                    <Field label="Coats" styles={sharedStyles(styles)}>
                      <RequiredInputFrame>
                        <PaintCoatButtons
                          value={firstCeilingScope.paintCoats}
                          onChange={(value) => updateScope(firstCeilingScope.id, { paintCoats: value })}
                          styles={{ button: styles.button }}
                        />
                      </RequiredInputFrame>
                    </Field>
                  </div>
                </div>
                <CeilingGeometryFields
                  scope={firstCeilingScope}
                  styles={styles}
                  updateScope={updateScope}
                  toDisplayNumber={toDisplayNumber}
                  metrics={previewMetrics}
                  subtotal={subtotal}
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
              {selectedRoomCeilingScopes.length === 0 && (
                <button type="button" style={styles.button} onClick={() => addScope(selectedRoom.roomId)}>
                  + Add ceiling segments
                </button>
              )}
              {selectedRoomCeilingScopes.map((scope, scopeIndex) => {
                const scopeSegs = sortByPosition(
                  ceilingSegments.filter((segment) => segment.ceilingScopeId === scope.id)
                )
                const segmentFlatScope = {
                  ...scope,
                  ceilingTypeId: 'FLAT',
                  ceilingGeometryMode: 'FLAT' as const,
                }
                const subtotal = ceilingScopeEffectiveTotalById.get(scope.id) ?? null
                const previewMetrics = ceilingScopePreviewMetricsById.get(scope.id) ?? null
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
                    {selectedRoomCeilingScopes.length > 1 && (
                      <ItemActionRow
                        styles={{ mono: styles.mono }}
                        meta={`Area ${scopeIndex + 1}`}
                        title={scope.scopeName || 'Ceiling area'}
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
                    )}
                    <CeilingGeometryFields
                      scope={segmentFlatScope}
                      styles={styles}
                      updateScope={updateScope}
                      toDisplayNumber={toDisplayNumber}
                      metrics={previewMetrics}
                      subtotal={subtotal}
                    />
                    <Field label="Coats" styles={sharedStyles(styles)}>
                      <PaintCoatButtons
                        value={scope.paintCoats}
                        onChange={(value) => updateScope(scope.id, { paintCoats: value })}
                        styles={{ button: styles.button }}
                      />
                    </Field>
                    <Field label="Primer Mode" styles={sharedStyles(styles)}>
                      <PrimerModeButtons
                        currentMode={scope.primeMode}
                        onChange={(mode) =>
                          updateScope(scope.id, {
                            primeMode: mode,
                            primerProductId: mode === 'NONE' ? '' : scope.primerProductId,
                          })
                        }
                        styles={{ button: styles.button }}
                      />
                    </Field>
                    {scope.primeMode === 'SPOT' && (
                      <Field label="Spot Primer %" styles={sharedStyles(styles)}>
                        <input
                          value={scope.spotPrimePercent}
                          onChange={(e) => updateScope(scope.id, { spotPrimePercent: e.target.value })}
                          style={styles.input}
                          type="number"
                          min="0"
                          max="100"
                        />
                      </Field>
                    )}
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
                          {segment.shapeType === 'RECTANGLE' && (
                            <>
                              <Field label="Width (in)" styles={sharedStyles(styles)}><input value={segment.widthIn} onChange={(e) => updateSegment(segment.id, { widthIn: e.target.value })} style={styles.input} /></Field>
                              <Field label="Length (in)" styles={sharedStyles(styles)}><input value={segment.heightIn} onChange={(e) => updateSegment(segment.id, { heightIn: e.target.value })} style={styles.input} /></Field>
                            </>
                          )}
                          {segment.shapeType === 'TRIANGLE' && (
                            <>
                              <Field label="Triangle Base Edge (in)" styles={sharedStyles(styles)}><input value={segment.baseIn} onChange={(e) => updateSegment(segment.id, { baseIn: e.target.value })} style={styles.input} /></Field>
                              <Field label="Triangle Depth (in)" styles={sharedStyles(styles)}><input value={segment.heightIn} onChange={(e) => updateSegment(segment.id, { heightIn: e.target.value })} style={styles.input} /></Field>
                            </>
                          )}
                          {segment.shapeType === 'MANUAL' && (
                            <Field label="Manual Area (sf)" styles={sharedStyles(styles)}><input value={segment.manualAreaSqFt} onChange={(e) => updateSegment(segment.id, { manualAreaSqFt: e.target.value })} style={styles.input} /></Field>
                          )}
                        </SharedSegmentGrid>
                      </div>
                    ))}
                  </div>
                )
              })}
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

      <EstimateV2DrywallRepairsBlock
        styles={styles}
        title="Ceiling Drywall Repairs"
        roomId={selectedRoom.roomId}
        surface="ceiling"
        repairs={ceilingsVm.selectedRoomCeilingDrywallRepairs}
        rateOptions={ceilingsVm.drywallRateOptions}
        effectiveQuantityById={ceilingsVm.drywallRepairEffectiveQuantityById}
        effectiveTotalById={ceilingsVm.drywallRepairEffectiveTotalById}
        subtotal={ceilingsVm.selectedCeilingDrywallSubtotal}
        addRepair={ceilingsVm.addDrywallRepair}
        updateRepair={ceilingsVm.updateDrywallRepair}
        deleteRepair={ceilingsVm.deleteDrywallRepair}
      />

      {firstCeilingScope && (
        <Advanced styles={sharedStyles(styles)}>
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
        </Advanced>
      )}
    </CeilingsScopePanel>
  )
}
