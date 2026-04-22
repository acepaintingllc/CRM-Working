'use client'

import { useRouter } from 'next/navigation'
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
  headerVm,
  saveVm,
  confirmNavigation,
}: {
  styles: HeaderAreaStyles
  estimateId?: string
  headerVm: EstimateV2EditorHeaderVm
  saveVm: EstimateV2EditorSaveVm
  confirmNavigation: () => boolean
}) {
  const router = useRouter()

  return (
    <EstimateV2Header
      styles={styles}
      vm={headerVm}
      confirmNavigation={confirmNavigation}
      onNext={() =>
        void saveVm.save().then((ok) => {
          if (ok && estimateId) router.push(`/crm/quotes/${estimateId}/summary`)
        })
      }
    />
  )
}
