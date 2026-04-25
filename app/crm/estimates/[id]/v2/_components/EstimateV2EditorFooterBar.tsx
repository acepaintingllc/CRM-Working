'use client'

import { useRouter } from 'next/navigation'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'
import type {
  EstimateV2EditorPageVm,
  EstimateV2EditorSaveVm,
  EstimateV2EditorSummaryVm,
} from '../_state/estimateV2EditorTypes'
import type { EstimateV2EditorPageStyles } from './estimateV2EditorPageStyles'

export function EstimateV2EditorFooterBar({
  styles,
  pageVm,
  saveVm,
  summaryVm,
  estimateId,
  routeFamily,
}: {
  styles: EstimateV2EditorPageStyles
  pageVm: EstimateV2EditorPageVm
  saveVm: EstimateV2EditorSaveVm
  summaryVm: EstimateV2EditorSummaryVm
  estimateId?: string
  routeFamily: EstimateRouteFamily
}) {
  const router = useRouter()
  const detailsHref = estimateId
    ? routeFamily.detailsHref?.(estimateId) ?? routeFamily.summaryHref(estimateId)
    : null

  return (
    <div style={styles.footer}>
      <div>
        <div style={styles.mono}>{summaryVm.runningTotalLabel}</div>
        <div
          style={{
            fontSize: 'calc(24px + 4pt)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginTop: 4,
          }}
        >
          {summaryVm.totalEffectiveAreaText}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'calc(13px + 4pt)', color: saveVm.saveStatusColor }}>
          {saveVm.saveStatusText}
        </div>
        <button
          type="button"
          className="v2-btn"
          onClick={() => void saveVm.save()}
          disabled={pageVm.saving || !saveVm.dirty}
          style={{
            ...styles.button,
            opacity: pageVm.saving || !saveVm.dirty ? 0.5 : 1,
            cursor: pageVm.saving || !saveVm.dirty ? 'not-allowed' : 'pointer',
          }}
        >
          Save draft
        </button>
        <button
          type="button"
          className="v2-btn-primary"
          onClick={() =>
            void saveVm.save().then((ok) => {
              if (ok && detailsHref) router.push(detailsHref)
            })
          }
          disabled={pageVm.saving}
          style={{
            ...styles.buttonPrimary,
            opacity: pageVm.saving ? 0.65 : 1,
            cursor: pageVm.saving ? 'not-allowed' : 'pointer',
          }}
        >
          {pageVm.saving ? 'Saving...' : 'Save & continue ->'}
        </button>
      </div>
    </div>
  )
}
