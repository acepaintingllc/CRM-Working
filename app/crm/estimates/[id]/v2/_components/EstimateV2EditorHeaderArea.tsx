import { EstimateV2Header } from './EstimateV2Header'
import type { EstimateV2EditorHeaderVm } from '../_state/estimateV2EditorTypes'
import type { EstimateV2EditorPageStyles } from './estimateV2EditorPageStyles'

export function EstimateV2EditorHeaderArea({
  styles,
  headerVm,
  onBack,
}: {
  styles: EstimateV2EditorPageStyles
  headerVm: EstimateV2EditorHeaderVm
  onBack: () => void
}) {
  return (
    <EstimateV2Header
      styles={styles}
      vm={headerVm}
      onBack={onBack}
    />
  )
}
