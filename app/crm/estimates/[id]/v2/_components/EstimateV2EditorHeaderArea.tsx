'use client'

import { useRouter } from 'next/navigation'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'
import { EstimateV2Header } from './EstimateV2Header'
import type {
  EstimateV2EditorHeaderVm,
  EstimateV2EditorSaveVm,
} from '../_state/estimateV2EditorTypes'
import type { CSSProperties } from 'react'

type HeaderAreaStyles = {
  header: CSSProperties
  button: CSSProperties
  buttonPrimary: CSSProperties
  mono: CSSProperties
}

export function EstimateV2EditorHeaderArea({
  styles,
  estimateId,
  routeFamily,
  headerVm,
  saveVm,
  confirmNavigation,
}: {
  styles: HeaderAreaStyles
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
        void saveVm.save().then((ok) => {
          if (ok && estimateId) router.push(routeFamily.summaryHref(estimateId))
        })
      }
    />
  )
}
