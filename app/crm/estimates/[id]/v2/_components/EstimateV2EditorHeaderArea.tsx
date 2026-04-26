'use client'

import { useRouter } from 'next/navigation'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'
import { EstimateV2Header } from './EstimateV2Header'
import type {
  EstimateV2EditorHeaderVm,
  EstimateV2EditorSaveVm,
} from '../_state/estimateV2EditorTypes'
import type { EstimateV2EditorPageStyles } from './estimateV2EditorPageStyles'

export function EstimateV2EditorHeaderArea({
  styles,
  estimateId,
  routeFamily,
  headerVm,
  saveVm,
  confirmNavigation,
}: {
  styles: EstimateV2EditorPageStyles
  estimateId?: string
  routeFamily: EstimateRouteFamily
  headerVm: EstimateV2EditorHeaderVm
  saveVm: EstimateV2EditorSaveVm
  confirmNavigation: () => boolean
}) {
  const router = useRouter()

  return (
    <EstimateV2Header
      styles={styles}
      routeFamily={routeFamily}
      vm={headerVm}
      confirmNavigation={confirmNavigation}
      onNext={() =>
        void (async () => {
          if (!estimateId) return
          if (!saveVm.dirty) {
            router.push(routeFamily.detailsHref(estimateId))
            return
          }
          const ok = await saveVm.save()
          if (ok) router.push(routeFamily.detailsHref(estimateId))
        })()
      }
    />
  )
}
