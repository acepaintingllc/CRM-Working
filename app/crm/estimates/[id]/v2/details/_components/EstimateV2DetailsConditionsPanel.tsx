'use client'

import { useState, useEffect } from 'react'
import type { ConditionLevel, EstimateV2ConditionModifier } from '@/types/estimator/v2'
import { countActiveConditions } from '../_lib/estimateV2DetailsConditions'

const SEVERITY_LEVELS: ConditionLevel[] = ['minor', 'moderate', 'major']

const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

export function EstimateV2DetailsConditionsPanel({
  scope,
  conditions,
  selections,
  onToggle,
  available,
}: {
  scope: 'wall' | 'ceiling' | 'trim'
  conditions: EstimateV2ConditionModifier[]
  selections: Record<string, ConditionLevel>
  onToggle: (conditionId: string, level: ConditionLevel | null) => void
  available: boolean
}) {
  const scopeConditions = conditions.filter((c) => c.scope === scope)
  const activeCount = countActiveConditions(selections)
  const [open, setOpen] = useState(activeCount > 0)

  useEffect(() => {
    if (activeCount > 0) setOpen(true)
  }, [activeCount])

  if (scopeConditions.length === 0 && available) return null

  const scopeLabel = scope === 'wall' ? 'Wall' : scope === 'ceiling' ? 'Ceiling' : 'Trim'

  return (
    <div className="border-t border-[color:var(--crm-ui-border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2 text-left text-sm text-[color:var(--crm-ui-muted)] hover:text-[color:var(--crm-ui-ink)]"
      >
        <span>{open ? '▼' : '▶'}</span>
        <span className={labelClassName}>{scopeLabel} Conditions</span>
        {activeCount > 0 ? (
          <span className="ml-auto text-xs font-medium text-[color:var(--crm-ui-warning-text)]">
            {activeCount} active ⚠
          </span>
        ) : (
          <span className="ml-auto text-xs text-[color:var(--crm-ui-muted-2)]">none active</span>
        )}
      </button>

      {open && (
        <div className="space-y-4 pb-3 pt-1">
          {!available && (
            <p className="text-xs text-[color:var(--crm-ui-warning-text)]">
              Conditions not configured in template — contact your administrator.
            </p>
          )}
          {available &&
            scopeConditions.map((condition) => {
              const currentLevel = selections[condition.id] ?? null

              if (condition.modifierType === 'binary') {
                return (
                  <label key={condition.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={currentLevel === 'active'}
                      onChange={() =>
                        onToggle(condition.id, currentLevel === 'active' ? null : 'active')
                      }
                      className="h-4 w-4 rounded border-[color:var(--crm-ui-border)]"
                    />
                    <span>{condition.displayName}</span>
                  </label>
                )
              }

              return (
                <div key={condition.id}>
                  <p className="mb-1 text-sm text-[color:var(--crm-ui-ink)]">
                    {condition.displayName}
                  </p>
                  <div className="flex gap-1">
                    {(['none', ...SEVERITY_LEVELS] as const).map((level) => {
                      const isNone = level === 'none'
                      const selected = isNone ? currentLevel == null : currentLevel === level
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() =>
                            onToggle(condition.id, isNone ? null : (level as ConditionLevel))
                          }
                          className={[
                            'rounded border px-3 py-1 text-xs font-medium capitalize transition-colors',
                            selected
                              ? 'border-[color:var(--crm-ui-accent)] bg-[color:var(--crm-ui-accent)] text-white'
                              : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)] text-[color:var(--crm-ui-muted)] hover:bg-[color:var(--crm-ui-surface-muted)]',
                          ].join(' ')}
                        >
                          {level}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
