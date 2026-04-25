'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'
import type { EstimateV2EditorHeaderVm } from '../_state/estimateV2EditorTypes'

type HeaderStyles = {
  header: CSSProperties
  button: CSSProperties
  buttonPrimary: CSSProperties
  mono: CSSProperties
}

export function EstimateV2Header({
  styles,
  routeFamily,
  vm,
  confirmNavigation,
  onNext,
}: {
  styles: HeaderStyles
  routeFamily: EstimateRouteFamily
  vm: EstimateV2EditorHeaderVm
  confirmNavigation: () => boolean
  onNext: () => void
}) {
  const detailsHref = vm.estimateId
    ? routeFamily.detailsHref?.(vm.estimateId) ?? routeFamily.summaryHref(vm.estimateId)
    : null

  return (
    <div style={styles.header}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href={routeFamily.listHref}
            onClick={(event) => {
              if (!confirmNavigation()) event.preventDefault()
            }}
            style={{
              ...styles.button,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
              fontSize: 'calc(13px + 4pt)',
            }}
          >
            {'<- Back'}
          </Link>
          <span style={styles.mono}>{vm.workflowText}</span>
          {vm.dirtyStateText ? (
            <span style={{ ...styles.mono, color: '#f9e2b7' }}>- {vm.dirtyStateText}</span>
          ) : null}
        </div>
        <div style={{ fontSize: 'calc(26px + 4pt)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {vm.titleText}
        </div>
        <div style={{ color: 'var(--v2-ink-3)', fontSize: 'calc(13px + 4pt)', lineHeight: 1.5 }}>
          {vm.subtitleText}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="v2-btn"
          onClick={vm.toggleSettings}
          style={{ ...styles.button, fontSize: 'calc(11px + 4pt)' }}
          title="Quote settings"
        >
          Settings
        </button>
        {detailsHref ? (
          <Link
            href={detailsHref}
            onClick={(event) => {
              if (!confirmNavigation()) event.preventDefault()
            }}
            style={{
              ...styles.button,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
              fontSize: 'calc(11px + 4pt)',
            }}
          >
            {'Details ->'}
          </Link>
        ) : null}
        <button
          type="button"
          className="v2-btn"
          style={{ ...styles.button, opacity: 0.5, cursor: 'not-allowed' }}
          disabled
        >
          Recalculate
        </button>
        <button type="button" className="v2-btn" style={styles.button} onClick={vm.addRoom}>
          + Add room
        </button>
        <button
          type="button"
          className="v2-btn-primary"
          onClick={onNext}
          disabled={vm.saving}
          style={{ ...styles.buttonPrimary, opacity: vm.saving ? 0.65 : 1, cursor: vm.saving ? 'not-allowed' : 'pointer' }}
        >
          {vm.saving ? 'Saving...' : 'Next: Details ->'}
        </button>
      </div>
    </div>
  )
}
