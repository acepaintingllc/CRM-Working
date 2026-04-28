'use client'

import { activeConditionCount, type EstimateV2ConditionLevel, type EstimateV2ConditionModifier, type EstimateV2ConditionScope, type EstimateV2ConditionSelections } from '@/lib/estimator/conditionModifiers'
import type { CSSProperties } from 'react'

const LEVELS: Array<{ value: EstimateV2ConditionLevel | 'none'; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'major', label: 'Major' },
]

export function EstimateV2ConditionsPanel({
  title,
  scope,
  catalog,
  selections,
  onChange,
  styles,
  collapsible = true,
}: {
  title: string
  scope: EstimateV2ConditionScope
  catalog: EstimateV2ConditionModifier[]
  selections: EstimateV2ConditionSelections
  onChange: (conditionId: string, level: EstimateV2ConditionLevel | 'none') => void
  styles: Record<string, CSSProperties>
  collapsible?: boolean
}) {
  const rows = catalog.filter((condition) => condition.scope === scope && condition.active !== 'N')
  const activeCount = activeConditionCount(selections)

  if (rows.length === 0) {
    return (
      <section className="section-card section-card-compact" style={{ ...styles.panel, display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>{title}</div>
        <div style={{ color: 'var(--v2-warn)', fontSize: 'calc(13px + 4pt)' }}>
          Condition modifier template rows have not been seeded for this scope.
        </div>
      </section>
    )
  }

  const conditionGridStyle: CSSProperties = {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
    alignItems: 'start',
  }

  const conditionItemStyle: CSSProperties = {
    display: 'grid',
    gap: 6,
    minWidth: 0,
  }

  const levelGridStyle: CSSProperties = {
    display: 'grid',
    gap: 6,
    gridTemplateColumns: 'repeat(auto-fit, minmax(72px, max-content))',
    alignItems: 'center',
  }

  const content = (
    <div style={conditionGridStyle}>
      {rows.map((condition) => {
        const current = selections[condition.id]
        if (condition.modifier_type === 'binary') {
          return (
            <label
              key={condition.id}
              style={{
                ...conditionItemStyle,
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                alignItems: 'center',
                columnGap: 10,
                color: 'var(--v2-ink)',
                fontSize: 'calc(13px + 4pt)',
              }}
            >
              <input
                type="checkbox"
                checked={current === 'active'}
                onChange={(event) => onChange(condition.id, event.currentTarget.checked ? 'active' : 'none')}
              />
              <span>{condition.label}</span>
            </label>
          )
        }
        return (
          <div key={condition.id} style={conditionItemStyle}>
            <div style={{ color: 'var(--v2-ink)', fontSize: 'calc(13px + 4pt)', fontWeight: 700 }}>
              {condition.label}
            </div>
            <div style={levelGridStyle}>
              {LEVELS.map((level) => {
                const active = (level.value === 'none' && !current) || current === level.value
                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => onChange(condition.id, level.value)}
                    style={{
                      ...styles.button,
                      borderColor: active ? 'rgba(134,239,172,0.34)' : 'var(--v2-line)',
                      background: active ? 'rgba(74,222,128,0.08)' : '#111111',
                      color: active ? 'var(--v2-green-2)' : 'var(--v2-ink)',
                      minHeight: 32,
                    }}
                  >
                    {level.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (!collapsible) {
    return (
      <section className="section-card section-card-compact" style={{ ...styles.panel, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>{title}</div>
          <span style={{ ...styles.mono, color: activeCount > 0 ? 'var(--v2-green-2)' : 'var(--v2-ink-3)' }}>
            {activeCount > 0 ? `${activeCount} active` : 'none active'}
          </span>
        </div>
        {content}
      </section>
    )
  }

  return (
    <details
      open={activeCount > 0}
      className="section-card section-card-compact"
      style={{ ...styles.panel, display: 'grid', gap: 10 }}
    >
      <summary
        style={{
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          color: 'var(--v2-ink)',
          fontSize: 'calc(15px + 4pt)',
          fontWeight: 700,
        }}
      >
        <span>{title}</span>
        <span style={{ ...styles.mono, color: activeCount > 0 ? 'var(--v2-green-2)' : 'var(--v2-ink-3)' }}>
          {activeCount > 0 ? `${activeCount} active` : 'none active'}
        </span>
      </summary>
      <div style={{ marginTop: 10 }}>{content}</div>
    </details>
  )
}
