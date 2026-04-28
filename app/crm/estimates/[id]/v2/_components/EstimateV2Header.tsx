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
}: {
  styles: HeaderStyles
  routeFamily: EstimateRouteFamily
  vm: EstimateV2EditorHeaderVm
  confirmNavigation: () => boolean
}) {
  return (
    <div className="estimate-v2-header" style={styles.header}>
      <div className="estimate-v2-header-copy" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
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
        <div className="estimate-v2-header-title" style={{ fontSize: 'calc(26px + 4pt)', fontWeight: 800, letterSpacing: 0, lineHeight: 1.1 }}>
          {vm.titleText}
        </div>
        <div className="estimate-v2-header-subtitle" style={{ color: 'var(--v2-ink-3)', fontSize: 'calc(13px + 4pt)', lineHeight: 1.5 }}>
          {vm.subtitleText}
        </div>
      </div>

      <div className="estimate-v2-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="v2-btn"
          onClick={vm.toggleSettings}
          style={{ ...styles.button, fontSize: 'calc(11px + 4pt)' }}
          title="Quote settings"
        >
          Settings
        </button>
        <button
          type="button"
          className="v2-btn"
          style={{ ...styles.button, opacity: 0.5, cursor: 'not-allowed' }}
          disabled
        >
          Recalculate
        </button>
      </div>
    </div>
  )
}
