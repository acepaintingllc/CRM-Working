'use client'

import type { CSSProperties } from 'react'
import type { EstimateV2EditorSettingsVm } from '../_state/estimateV2EditorTypes'

type DrawerStyles = {
  mono: CSSProperties
  label: CSSProperties
  input: CSSProperties
}

export function EstimateV2SettingsDrawer({
  styles,
  jobSettingsVm,
}: {
  styles: DrawerStyles
  jobSettingsVm: EstimateV2EditorSettingsVm
}) {
  if (!jobSettingsVm.settingsOpen) return null

  const { customerDraft, jobSettingsDraft } = jobSettingsVm

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 48, background: 'rgba(0,0,0,0.45)' }} onClick={() => jobSettingsVm.setSettingsOpen(false)} />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 340,
          zIndex: 49,
          background: 'var(--v2-bg-2)',
          borderLeft: '1px solid var(--v2-line)',
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'grid',
          gap: 20,
          alignContent: 'start',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 'calc(14px + 4pt)', letterSpacing: '-0.01em' }}>Estimate Settings</span>
          <button
            type="button"
            onClick={() => jobSettingsVm.setSettingsOpen(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--v2-ink-3)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >
            x
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...styles.mono, marginBottom: 2 }}>Customer Info</div>
          {[
            { label: 'Name', key: 'name' as const, type: 'text' },
            { label: 'Email', key: 'email' as const, type: 'email' },
            { label: 'Phone', key: 'phone' as const, type: 'tel' },
            { label: 'Address', key: 'address' as const, type: 'text' },
          ].map(({ label, key, type }) => (
            <label key={key} style={styles.label}>
              <span style={{ fontSize: 'calc(10px + 4pt)', color: 'var(--v2-ink-3)', fontWeight: 600 }}>{label}</span>
              <input
                type={type}
                value={customerDraft[key]}
                onChange={(event) => jobSettingsVm.updateCustomer({ [key]: event.target.value })}
                onBlur={jobSettingsVm.flushCustomerSave}
                style={styles.input}
              />
            </label>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--v2-line)' }} />

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={styles.mono}>Labor Day Policy</span>
            <button
              type="button"
              onClick={() => jobSettingsVm.updateJobSettings({ laborDayEnabled: !jobSettingsDraft.laborDayEnabled })}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: jobSettingsDraft.laborDayEnabled ? '#8ad39b' : '#333',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: jobSettingsDraft.laborDayEnabled ? 19 : 3,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: jobSettingsDraft.laborDayEnabled ? '#062410' : '#666',
                  transition: 'left 0.15s',
                  display: 'block',
                }}
              />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Hours / day', key: 'dayhours' as const },
              { label: 'Round (hrs)', key: 'roundingIncrementHours' as const },
            ].map(({ label, key }) => (
              <label key={key} style={styles.label}>
                <span style={{ fontSize: 'calc(10px + 4pt)', color: 'var(--v2-ink-3)', fontWeight: 600 }}>{label}</span>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={jobSettingsDraft[key]}
                  onChange={(event) => jobSettingsVm.updateJobSettings({ [key]: Number(event.target.value) })}
                  style={styles.input}
                />
              </label>
            ))}
          </div>
          <label style={styles.label}>
            <span style={{ fontSize: 'calc(10px + 4pt)', color: 'var(--v2-ink-3)', fontWeight: 600 }}>Labor rate ($/hr)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={jobSettingsDraft.laborRate}
              onChange={(event) => jobSettingsVm.updateJobSettings({ laborRate: Number(event.target.value) })}
              style={styles.input}
            />
          </label>
        </div>

        <div style={{ height: 1, background: 'var(--v2-line)' }} />

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={styles.mono}>Job Minimum</span>
            <button
              type="button"
              onClick={() => jobSettingsVm.updateJobSettings({ jobMinEnabled: !jobSettingsDraft.jobMinEnabled })}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: jobSettingsDraft.jobMinEnabled ? '#8ad39b' : '#333',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: jobSettingsDraft.jobMinEnabled ? 19 : 3,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: jobSettingsDraft.jobMinEnabled ? '#062410' : '#666',
                  transition: 'left 0.15s',
                  display: 'block',
                }}
              />
            </button>
          </div>
          {jobSettingsDraft.jobMinEnabled ? (
            <label style={styles.label}>
              <span style={{ fontSize: 'calc(10px + 4pt)', color: 'var(--v2-ink-3)', fontWeight: 600 }}>Minimum ($)</span>
              <input
                type="number"
                min={0}
                step={50}
                value={jobSettingsDraft.jobMinAmount}
                onChange={(event) => jobSettingsVm.updateJobSettings({ jobMinAmount: Number(event.target.value) })}
                style={styles.input}
              />
            </label>
          ) : null}
        </div>
      </div>
    </>
  )
}
