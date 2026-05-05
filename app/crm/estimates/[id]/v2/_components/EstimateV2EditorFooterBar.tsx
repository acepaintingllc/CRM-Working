'use client'

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
}: {
  styles: EstimateV2EditorPageStyles
  pageVm: EstimateV2EditorPageVm
  saveVm: EstimateV2EditorSaveVm
  summaryVm: EstimateV2EditorSummaryVm
}) {
  const saveDraftDisabled = pageVm.saving || !saveVm.canManualSave
  const saveAndContinueDisabled = pageVm.saving || !saveVm.canSaveAndContinue

  return (
    <div className="estimate-v2-footer" style={styles.footer}>
      <div>
        <div style={styles.mono}>{summaryVm.runningTotalLabel}</div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            marginTop: 4,
          }}
        >
          {summaryVm.activeScopeTotals.map((total) => (
            <span key={total.key} style={{ fontSize: 'calc(14px + 4pt)', fontWeight: 800 }}>
              {total.label}: {total.value}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'calc(13px + 4pt)', color: saveVm.saveStatusColor }}>
          {saveVm.saveStatusText}
        </div>
        <button
          type="button"
          className="v2-btn"
          onClick={saveVm.saveDraft}
          disabled={saveDraftDisabled}
          title={saveDraftDisabled && saveVm.blockedReason ? saveVm.blockedReason : undefined}
          style={{
            ...styles.button,
            opacity: saveDraftDisabled ? 0.5 : 1,
            cursor: saveDraftDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          Save draft
        </button>
        <button
          type="button"
          className="v2-btn-primary"
          onClick={saveVm.saveAndContinue}
          disabled={saveAndContinueDisabled}
          title={
            saveAndContinueDisabled && saveVm.blockedReason ? saveVm.blockedReason : undefined
          }
          style={{
            ...styles.buttonPrimary,
            opacity: saveAndContinueDisabled ? 0.65 : 1,
            cursor: saveAndContinueDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {pageVm.saving ? 'Saving...' : 'Save & continue ->'}
        </button>
      </div>
    </div>
  )
}
