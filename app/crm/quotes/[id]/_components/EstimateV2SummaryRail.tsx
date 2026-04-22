'use client'

import type { CSSProperties } from 'react'
import type { ScopeKind } from '@/lib/estimator/scopeKinds'
import type { EstimateV2EditorSummaryVm } from '../_state/estimateV2EditorTypes'
import { SummaryRail, type SharedStyles } from './EstimateV2EditorPrimitives'

type RailStyles = SharedStyles & {
  mono: CSSProperties
  panel: CSSProperties
  scopePill: CSSProperties
}

export function EstimateV2SummaryRail({
  styles,
  vm,
  onFocusSection,
}: {
  styles: RailStyles
  vm: EstimateV2EditorSummaryVm
  onFocusSection: (section: ScopeKind) => void
}) {
  return (
    <SummaryRail styles={styles}>
      <div style={styles.mono}>Room Summary</div>
      <div className="summary-stack">
        <div className="summary-card">
          <div style={styles.mono}>Room</div>
          <div style={{ fontSize: 'calc(16px + 4pt)', fontWeight: 800, marginTop: 3 }}>{vm.roomLabel}</div>
          <div style={{ fontSize: 'calc(13px + 4pt)', color: 'var(--v2-ink-2)', marginTop: 2 }}>{vm.roomName}</div>
          <div style={{ ...styles.mono, color: 'var(--v2-ink-3)', marginTop: 8 }}>{vm.roomSubtitle}</div>
        </div>

        {vm.walls.visible ? (
          <button type="button" className="summary-card summary-card-clickable" onClick={() => onFocusSection('walls')}>
            <SectionCard styles={styles} section={vm.walls} />
          </button>
        ) : null}

        {vm.ceilings.visible ? (
          <button type="button" className="summary-card summary-card-clickable" onClick={() => onFocusSection('ceilings')}>
            <SectionCard styles={styles} section={vm.ceilings} />
          </button>
        ) : null}

        {vm.trim.visible ? (
          <button type="button" className="summary-card summary-card-clickable" onClick={() => onFocusSection('trim')}>
            <SectionCard styles={styles} section={vm.trim} />
          </button>
        ) : null}

        <div className="summary-card">
          <div style={styles.mono}>Validation</div>
          <div style={{ fontSize: 'calc(13px + 4pt)', color: vm.validationColor, marginTop: 2 }}>{vm.validationText}</div>
        </div>

        <div className="summary-card">
          <div style={styles.mono}>Running Total</div>
          <div style={{ fontSize: 'calc(18px + 4pt)', fontWeight: 800, marginTop: 2 }}>{vm.totalEffectiveAreaText}</div>
        </div>

        <div className="summary-card">
          <div style={styles.mono}>Calculation State</div>
          <div style={{ fontSize: 'calc(13px + 4pt)', color: vm.calculationStateColor, marginTop: 2 }}>
            {vm.calculationStateText}
          </div>
        </div>

        <div className="summary-card">
          <div style={styles.mono}>Save State</div>
          <div style={{ fontSize: 'calc(13px + 4pt)', color: vm.saveStatusColor, marginTop: 2 }}>{vm.saveStatusText}</div>
        </div>
      </div>
    </SummaryRail>
  )
}

function SectionCard({
  styles,
  section,
}: {
  styles: RailStyles
  section: EstimateV2EditorSummaryVm['walls']
}) {
  return (
    <>
      <div style={styles.mono}>{section.title}</div>
      {section.modeLabel ? (
        <div style={{ fontSize: 'calc(14px + 4pt)', fontWeight: 700, marginTop: 3 }}>Mode: {section.modeLabel}</div>
      ) : null}
      <div className="summary-kpi">{section.primaryValue}</div>
      <div style={{ ...styles.mono, color: 'var(--v2-ink-3)', marginTop: 2 }}>{section.primaryUnit}</div>
      <div style={{ fontSize: 'calc(13px + 4pt)', color: 'var(--v2-ink-2)', marginTop: 8 }}>Paint: {section.paintLabel}</div>
      <div style={{ fontSize: 'calc(13px + 4pt)', color: 'var(--v2-ink-2)', marginTop: 2 }}>Primer: {section.primerLabel}</div>
      {section.secondaryLabel && section.secondaryValue ? (
        <div style={{ fontSize: 'calc(13px + 4pt)', color: 'var(--v2-ink-2)', marginTop: 8 }}>
          {section.secondaryLabel}: {section.secondaryValue}
        </div>
      ) : null}
      <div style={{ ...styles.mono, color: 'var(--v2-green-2)', marginTop: 8 }}>Included</div>
    </>
  )
}
