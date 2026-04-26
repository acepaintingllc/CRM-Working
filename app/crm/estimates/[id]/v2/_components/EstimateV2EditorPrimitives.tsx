import type { CSSProperties, ReactNode } from 'react'
import type { EstimateV2EditorSectionChipVm } from '../_state/estimateV2EditorTypes'
import type { EstimateV2SharedStyles } from './estimateV2EditorPageStyles'

export type SharedStyles = EstimateV2SharedStyles

export function Field({
  label,
  children,
  styles,
}: {
  label: string
  children: ReactNode
  styles: SharedStyles
}) {
  return (
    <label style={styles.label}>
      <span style={styles.mono}>{label}</span>
      {children}
    </label>
  )
}

export function ScopeSummaryChips({
  chips,
  chipStyle,
}: {
  chips: EstimateV2EditorSectionChipVm[]
  chipStyle: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          style={{
            ...chipStyle,
            color: chip.tone === 'warning' ? '#f9e2b7' : 'var(--v2-ink-2)',
          }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  )
}

export function GeometryBlock({
  children,
  styles,
}: {
  children: ReactNode
  styles: SharedStyles
}) {
  return (
    <section className="section-card section-card-compact" style={{ ...styles.panel, display: 'grid', gap: 8 }}>
      {children}
    </section>
  )
}

export function PaintSetup({
  children,
  styles,
}: {
  children: ReactNode
  styles: SharedStyles
}) {
  return (
    <section className="section-card section-card-compact" style={{ ...styles.panel, display: 'grid', gap: 8 }}>
      {children}
    </section>
  )
}

export function Advanced({
  children,
  styles,
}: {
  children: ReactNode
  styles: SharedStyles
}) {
  return (
    <section className="section-card section-card-compact" style={{ ...styles.panel, display: 'grid', gap: 8 }}>
      {children}
    </section>
  )
}

export function SummaryRail({
  children,
  styles,
}: {
  children: ReactNode
  styles: SharedStyles
}) {
  return (
    <aside
      className="room-side-col section-card section-card-compact"
      style={{ ...styles.panel, display: 'grid', gap: 8, alignSelf: 'start', position: 'sticky', top: 74 }}
    >
      {children}
    </aside>
  )
}

export function RoomHeaderSetup({
  children,
  styles,
}: {
  children: ReactNode
  styles: SharedStyles
}) {
  return (
    <section className="section-card section-card-green section-card-compact" style={{ ...styles.panel, display: 'grid', gap: 10 }}>
      {children}
    </section>
  )
}

export function RoomLevelModifiers({
  children,
  styles,
}: {
  children: ReactNode
  styles: SharedStyles
}) {
  return (
    <section className="section-card section-card-compact" style={{ ...styles.panel, display: 'grid', gap: 8 }}>
      {children}
    </section>
  )
}

export function ScopeAccordionList({ children }: { children: ReactNode }) {
  return <section style={{ display: 'grid', gap: 10 }}>{children}</section>
}

export function ScopeAccordionRow({
  title,
  summary,
  expanded,
  onToggle,
  children,
  styles,
}: {
  title: string
  summary: ReactNode
  expanded: boolean
  onToggle: () => void
  children: ReactNode
  styles: SharedStyles
}) {
  return (
    <section className="section-card section-card-compact" style={{ ...styles.panel, display: 'grid', gap: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          border: '1px solid var(--v2-line)',
          background: '#111111',
          borderRadius: 10,
          padding: '10px 12px',
          textAlign: 'left',
          color: 'var(--v2-ink)',
          display: 'grid',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 'calc(15px + 4pt)', fontWeight: 700 }}>{title}</span>
          <span style={{ ...styles.mono, color: 'var(--v2-ink-3)' }}>{expanded ? 'collapse ^' : 'expand v'}</span>
        </div>
        {expanded ? null : summary}
      </button>
      {expanded ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : null}
    </section>
  )
}

export function ItemActionRow({
  title,
  meta,
  actions,
  styles,
}: {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  styles: Pick<SharedStyles, 'mono'>
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        {typeof meta === 'string' ? <div style={styles.mono}>{meta}</div> : meta}
        <div style={{ fontSize: 'calc(16px + 4pt)', fontWeight: 700, marginTop: 4 }}>{title}</div>
      </div>
      {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

export function ReorderDeleteActions({
  styles,
  disableMoveUp,
  disableMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  styles: { button: CSSProperties }
  disableMoveUp: boolean
  disableMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  return (
    <>
      <button type="button" style={styles.button} disabled={disableMoveUp} onClick={onMoveUp}>
        Up
      </button>
      <button type="button" style={styles.button} disabled={disableMoveDown} onClick={onMoveDown}>
        Down
      </button>
      <button type="button" style={styles.button} onClick={onDelete}>
        Delete
      </button>
    </>
  )
}

export function PaintOverrideFields({
  styles,
  paintLabel,
  paintValue,
  onPaintChange,
  paintOptions,
  primerLabel,
  primerValue,
  onPrimerChange,
  primerOptions,
  colorValue,
  onColorChange,
  colorOptions,
  hidePrimer = false,
  hideColor = false,
}: {
  styles: SharedStyles & { input: CSSProperties }
  paintLabel: string
  paintValue: string
  onPaintChange: (value: string) => void
  paintOptions: Array<{ id: string; label: string }>
  primerLabel: string
  primerValue: string
  onPrimerChange: (value: string) => void
  primerOptions: Array<{ id: string; label: string }>
  colorValue: string
  onColorChange: (value: string) => void
  colorOptions: Array<{ id: string; label: string }>
  hidePrimer?: boolean
  hideColor?: boolean
}) {
  return (
    <div className="paint-setup-grid">
      <Field label="Paint Override" styles={styles}>
        <select value={paintValue} onChange={(e) => onPaintChange(e.target.value)} style={styles.input}>
          <option value="">{paintLabel}</option>
          {paintOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>
      {!hidePrimer && (
        <Field label="Primer Override" styles={styles}>
          <select value={primerValue} onChange={(e) => onPrimerChange(e.target.value)} style={styles.input}>
            <option value="">{primerLabel}</option>
            {primerOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!hideColor && (
        <Field label="Color Slot" styles={styles}>
          <select value={colorValue} onChange={(e) => onColorChange(e.target.value)} style={styles.input}>
            {colorOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  )
}

export function PrimerModeButtons({
  currentMode,
  onChange,
  styles,
}: {
  currentMode: 'NONE' | 'SPOT' | 'FULL'
  onChange: (mode: 'NONE' | 'SPOT' | 'FULL') => void
  styles: { button: CSSProperties }
}) {
  return (
    <div className="primer-mode-row">
      {(['NONE', 'SPOT', 'FULL'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          style={{
            ...styles.button,
            flex: 1,
            borderColor:
              currentMode === mode ? 'rgba(134,239,172,0.34)' : 'var(--v2-line)',
            background: currentMode === mode ? 'rgba(74,222,128,0.08)' : '#111111',
            color: currentMode === mode ? 'var(--v2-green-2)' : 'var(--v2-ink)',
            minHeight: 32,
          }}
        >
          {mode === 'NONE' ? 'None' : mode === 'SPOT' ? 'Spot' : 'Full'}
        </button>
      ))}
    </div>
  )
}

export function AdvancedPanelToggle({
  label,
  open,
  onToggle,
  styles,
}: {
  label: string
  open: boolean
  onToggle: () => void
  styles: { mono: CSSProperties }
}) {
  return (
    <button
      type="button"
      className="advanced-toggle"
      onClick={onToggle}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--v2-ink-3)',
        fontSize: 'calc(12px + 4pt)',
        fontWeight: 700,
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        width: '100%',
      }}
    >
      <span style={styles.mono}>{label}</span>
      <span style={{ fontSize: 'calc(10px + 4pt)' }}>{open ? '^' : 'v'}</span>
    </button>
  )
}

export function SharedSegmentGrid({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div
      className="walls-segment-grid"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}
    >
      {children}
    </div>
  )
}

export function WallsScopePanel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>{children}</div>
}

export function CeilingsScopePanel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>{children}</div>
}

export function TrimScopePanel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>{children}</div>
}
