'use client'

import { useState, type CSSProperties } from 'react'
import type {
  EstimateV2DrywallRateOption,
  EstimateV2DrywallRepairDraft,
} from '@/types/estimator/v2'
import {
  Advanced,
  AdvancedPanelToggle,
  Field,
  ItemActionRow,
  OptionalInputFrame,
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

function formatCurrency(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? 'Pending inputs' : `$${value.toFixed(2)}`
}

function repairOptionsForSurface(
  rateOptions: EstimateV2DrywallRateOption[] = [],
  surface: EstimateV2DrywallRepairDraft['surface']
) {
  const allowed =
    surface === 'ceiling'
      ? new Set(['ceiling_crack', 'patch_opening_repair'])
      : new Set(['corner_tape_replacement', 'flat_wall_crack', 'stress_crack_at_seam', 'patch_opening_repair'])
  return rateOptions.filter((option) => allowed.has(option.id))
}

export function EstimateV2DrywallRepairsBlock({
  styles,
  title,
  roomId,
  surface,
  repairs,
  rateOptions,
  effectiveTotalById,
  subtotal,
  addRepair,
  updateRepair,
  deleteRepair,
}: {
  styles: EditorStyles
  title: string
  roomId: string
  surface: EstimateV2DrywallRepairDraft['surface']
  repairs: EstimateV2DrywallRepairDraft[]
  rateOptions: EstimateV2DrywallRateOption[]
  effectiveQuantityById: Map<string, number | null>
  effectiveTotalById: Map<string, number | null>
  subtotal: number | null
  addRepair: (roomId: string, surface: EstimateV2DrywallRepairDraft['surface'], repairType: string) => void
  updateRepair: (repairId: string, patch: Partial<EstimateV2DrywallRepairDraft>) => void
  deleteRepair: (roomId: string, repairId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const safeRateOptions = rateOptions ?? []
  const safeRepairs = repairs ?? []
  const options = repairOptionsForSurface(safeRateOptions, surface)
  const defaultRepairType = options[0]?.id ?? (surface === 'ceiling' ? 'ceiling_crack' : 'flat_wall_crack')

  return (
    <Advanced styles={sharedStyles(styles)}>
      <div style={{ display: 'grid', gap: 10 }}>
        <AdvancedPanelToggle
          label={title}
          open={open}
          onToggle={() => setOpen((value) => !value)}
          styles={{ mono: styles.mono }}
        />
        {open ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ ...styles.label, marginTop: 2 }}>Primer included in drywall repair pricing</div>
              <button
                type="button"
                style={styles.button}
                onClick={() => addRepair(roomId, surface, defaultRepairType)}
              >
                + Add repair
              </button>
            </div>

            {safeRepairs.length > 0 && (
              <ScopeHelperBar
                styles={{ mono: styles.mono, computedBig: styles.computedBig }}
                metrics={[
                  { label: 'Repair Items', value: String(safeRepairs.length) },
                  { label: 'Subtotal', value: formatCurrency(subtotal), muted: subtotal == null },
                ]}
              />
            )}

            {safeRepairs.map((repair, index) => {
              const option = safeRateOptions.find((item) => item.id === repair.repairType)
              const effectiveTotal = effectiveTotalById.get(repair.id) ?? null
              return (
                <div
                  key={repair.id}
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
                    meta={`Repair ${index + 1}`}
                    title={option?.label || repair.repairType || 'Drywall repair'}
                    actions={
                      <>
                        <span style={{ ...styles.scopePill, color: 'var(--v2-ink-2)' }}>
                          {formatCurrency(effectiveTotal)}
                        </span>
                        <ReorderDeleteActions
                          styles={{ button: styles.button }}
                          disableMoveUp
                          disableMoveDown
                          onMoveUp={() => undefined}
                          onMoveDown={() => undefined}
                          onDelete={() => deleteRepair(roomId, repair.id)}
                        />
                      </>
                    }
                  />
                  <div className="drywall-repair-grid">
                    <Field label="Repair Type" styles={sharedStyles(styles)}>
                      <RequiredInputFrame>
                        <select
                          value={repair.repairType}
                          onChange={(event) => updateRepair(repair.id, { repairType: event.target.value })}
                          style={styles.input}
                        >
                          {options.map((rate) => (
                            <option key={rate.id} value={rate.id}>
                              {rate.label}
                            </option>
                          ))}
                        </select>
                      </RequiredInputFrame>
                    </Field>
                    <Field label={`Quantity (${repair.unit})`} styles={sharedStyles(styles)}>
                      <RequiredInputFrame>
                        <input
                          value={repair.quantity}
                          onChange={(event) => updateRepair(repair.id, { quantity: event.target.value })}
                          style={styles.input}
                          type="number"
                          min="0"
                          step="0.1"
                        />
                      </RequiredInputFrame>
                    </Field>
                    <Field label="Total Override" styles={sharedStyles(styles)}>
                      <OptionalInputFrame>
                        <input
                          value={repair.overrideTotal}
                          onChange={(event) => updateRepair(repair.id, { overrideTotal: event.target.value })}
                          style={styles.input}
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </OptionalInputFrame>
                    </Field>
                  </div>
                </div>
              )
            })}
          </>
        ) : null}
      </div>
    </Advanced>
  )
}
