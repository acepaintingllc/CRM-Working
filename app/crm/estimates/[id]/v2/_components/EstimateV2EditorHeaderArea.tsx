'use client'

import type { EstimateRouteFamily } from '../../estimateRouteFamily'
import { EstimateV2Header } from './EstimateV2Header'
import type { EstimateV2EditorHeaderVm } from '../_state/estimateV2EditorTypes'
import type { EstimateV2EditorPageStyles } from './estimateV2EditorPageStyles'

export function EstimateV2EditorHeaderArea({
  styles,
  routeFamily,
  headerVm,
  confirmNavigation,
}: {
  styles: EstimateV2EditorPageStyles
  routeFamily: EstimateRouteFamily
  headerVm: EstimateV2EditorHeaderVm
  confirmNavigation: () => boolean
}) {
  return (
    <EstimateV2Header
      styles={styles}
      routeFamily={routeFamily}
      vm={headerVm}
      confirmNavigation={confirmNavigation}
    />
  )
}
