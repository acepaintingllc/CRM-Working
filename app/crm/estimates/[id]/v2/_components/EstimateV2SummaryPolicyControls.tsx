'use client'

import type { CSSProperties } from 'react'

type SummaryPolicyVm = {
  draft: {
    laborDayEnabled: boolean
    dayhours: number
    roundIncrement: number
    laborRate: number
    jobMinEnabled: boolean
    jobMinAmount: number
  }
  update: (patch: Partial<{
    laborDayEnabled: boolean
    dayhours: number
    roundIncrement: number
    laborRate: number
    jobMinEnabled: boolean
    jobMinAmount: number
  }>) => void
  saving: boolean
}

export function SummaryToggle({
  on,
  onClick,
  color,
  ariaLabel,
}: {
  on: boolean
  onClick: () => void
  color: { green: string; cardDark: string }
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? color.green : '#333',
        position: 'relative',
        flexShrink: 0,
        cursor: 'pointer',
        border: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 19 : 3,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: on ? color.cardDark : '#666',
          transition: 'left 0.15s',
          display: 'block',
        }}
      />
    </button>
  )
}

export function EstimateV2SummaryPolicyControls({
  vm,
  card,
  inputStyle,
  colors,
  open,
  onToggleOpen,
  compact,
}: {
  vm: SummaryPolicyVm
  card: CSSProperties
  inputStyle: CSSProperties
  colors: { border: string; ink3: string; green: string; cardDark: string }
  open: boolean
  onToggleOpen?: () => void
  compact?: boolean
}) {
  const { draft } = vm

  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.ink3 }}>
            Labor Day Policy
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: draft.laborDayEnabled ? colors.green : colors.ink3 }}>
              {draft.laborDayEnabled ? 'ON' : 'OFF'}
            </span>
            <SummaryToggle
              on={draft.laborDayEnabled}
              onClick={() => vm.update({ laborDayEnabled: !draft.laborDayEnabled })}
              color={colors}
              ariaLabel="Toggle labor day policy"
            />
            {onToggleOpen ? (
              <button
                type="button"
                onClick={onToggleOpen}
                aria-expanded={open}
                aria-label={open ? 'Collapse labor day policy settings' : 'Expand labor day policy settings'}
                style={{
                  background: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  color: colors.ink3,
                  fontSize: 10,
                  lineHeight: 1,
                }}
              >
                <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>v</span>
              </button>
            ) : null}
          </div>
        </div>
        {(!compact || open) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}`, display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: colors.ink3, fontWeight: 600, marginBottom: 4 }}>Hours / day</div>
                <input aria-label="Hours per day" type="number" min={1} step={1} value={draft.dayhours} onChange={(e) => vm.update({ dayhours: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: colors.ink3, fontWeight: 600, marginBottom: 4 }}>Round (hrs)</div>
                <input aria-label="Round labor hours increment" type="number" min={0.5} step={0.5} value={draft.roundIncrement} onChange={(e) => vm.update({ roundIncrement: Number(e.target.value) })} style={inputStyle} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: colors.ink3, fontWeight: 600, marginBottom: 4 }}>Labor rate ($/hr)</div>
              <input aria-label="Labor rate dollars per hour" type="number" min={0} step={1} value={draft.laborRate} onChange={(e) => vm.update({ laborRate: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.ink3 }}>
            Job Minimum
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: draft.jobMinEnabled ? colors.green : colors.ink3 }}>
              {draft.jobMinEnabled ? 'ON' : 'OFF'}
            </span>
            <SummaryToggle
              on={draft.jobMinEnabled}
              onClick={() => vm.update({ jobMinEnabled: !draft.jobMinEnabled })}
              color={colors}
              ariaLabel="Toggle job minimum"
            />
          </div>
        </div>
        {draft.jobMinEnabled && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 10, color: colors.ink3, fontWeight: 600, marginBottom: 4 }}>Minimum amount ($)</div>
            <input aria-label="Job minimum amount dollars" type="number" min={0} step={50} value={draft.jobMinAmount} onChange={(e) => vm.update({ jobMinAmount: Number(e.target.value) })} style={inputStyle} />
          </div>
        )}
      </div>
    </>
  )
}
