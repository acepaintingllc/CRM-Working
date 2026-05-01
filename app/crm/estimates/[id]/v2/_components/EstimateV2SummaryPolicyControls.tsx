'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'

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
  const [laborSettingsOpen, setLaborSettingsOpen] = useState(true)
  const laborDayStatus = draft.laborDayEnabled ? 'On' : 'Off'
  const jobMinimumStatus = draft.jobMinEnabled ? 'On' : 'Off'
  const policySummary = `Policies: Labor Day ${laborDayStatus} • Job Minimum ${jobMinimumStatus}`

  return (
    <div
      style={{
        ...card,
        border: `1px solid color-mix(in srgb, ${colors.green} ${open ? '34%' : '48%'}, ${colors.border})`,
        background: open
          ? colors.cardDark
          : `linear-gradient(135deg, color-mix(in srgb, ${colors.green} 7%, ${colors.cardDark}), ${colors.cardDark})`,
        boxShadow: open ? 'none' : `0 0 0 1px color-mix(in srgb, ${colors.green} 8%, transparent)`,
      }}
    >
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-label={open ? 'Collapse pricing policies' : 'Expand pricing policies'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: onToggleOpen ? 'pointer' : 'default',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'grid', gap: 5, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.green, opacity: open ? 0.75 : 0.9 }} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: open ? colors.ink3 : colors.green }}>
              Pricing Policies
            </span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 850, color: 'var(--crm-ui-ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {policySummary}
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              border: `1px solid color-mix(in srgb, ${colors.green} 38%, ${colors.border})`,
              borderRadius: 999,
              color: open ? colors.ink3 : colors.green,
              fontSize: 10,
              fontWeight: 900,
              lineHeight: 1,
              padding: '5px 8px',
              textTransform: 'uppercase',
            }}
          >
            Edit
          </span>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              border: `1px solid color-mix(in srgb, ${colors.green} 34%, ${colors.border})`,
              borderRadius: 6,
              color: open ? colors.ink3 : colors.green,
              fontSize: 10,
              lineHeight: 1,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
              flexShrink: 0,
            }}
          >
            v
          </span>
        </span>
      </button>

      {open ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}`, display: 'grid', gap: compact ? 10 : 12 }}>
          <div style={{ display: 'grid', gap: 10 }}>
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
                <button
                  type="button"
                  onClick={() => setLaborSettingsOpen((current) => !current)}
                  aria-expanded={laborSettingsOpen}
                  aria-label={laborSettingsOpen ? 'Collapse labor day policy settings' : 'Expand labor day policy settings'}
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
                  <span style={{ display: 'inline-block', transform: laborSettingsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>v</span>
                </button>
              </div>
            </div>
            {laborSettingsOpen ? (
              <>
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
              </>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
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
              <div>
                <div style={{ fontSize: 10, color: colors.ink3, fontWeight: 600, marginBottom: 4 }}>Minimum amount ($)</div>
                <input aria-label="Job minimum amount dollars" type="number" min={0} step={50} value={draft.jobMinAmount} onChange={(e) => vm.update({ jobMinAmount: Number(e.target.value) })} style={inputStyle} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
