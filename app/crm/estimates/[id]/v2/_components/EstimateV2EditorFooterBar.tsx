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
  estimateId,
  routeFamily,
  pageVm,
  saveVm,
  summaryVm,
}: {
  styles: EstimateV2EditorPageStyles
  estimateId?: string
  routeFamily: EstimateRouteFamily
  pageVm: EstimateV2EditorPageVm
  saveVm: EstimateV2EditorSaveVm
  summaryVm: EstimateV2EditorSummaryVm
}) {
  const router = useRouter()

  const saveAndContinue = () => {
    if (!estimateId) return
    if (!saveVm.dirty) {
      router.push(routeFamily.detailsHref(estimateId))
      return
    }
    void saveVm.save().then((ok) => {
      if (ok) router.push(routeFamily.detailsHref(estimateId))
    })
  }

  return (
    <div className="estimate-v2-footer" style={styles.footer}>
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
          onClick={saveAndContinue}
          disabled={pageVm.saving || !estimateId}
          style={{
            ...styles.buttonPrimary,
            opacity: pageVm.saving || !estimateId ? 0.65 : 1,
            cursor: pageVm.saving || !estimateId ? 'not-allowed' : 'pointer',
          }}
        >
          {pageVm.saving ? 'Saving...' : 'Save & continue ->'}
        </button>
      </div>
    </div>
  )
}
