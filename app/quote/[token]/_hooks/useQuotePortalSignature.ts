'use client'

import { useState } from 'react'

export type SignatureMode = 'typed' | 'drawn'

export function useQuotePortalSignature({
  initialLegalName,
}: {
  initialLegalName: string
}) {
  const [legalName, setLegalName] = useState(initialLegalName)
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('typed')
  const [typedSignature, setTypedSignature] = useState(initialLegalName)
  const [drawnSignature, setDrawnSignature] = useState('')
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  const signatureValue = signatureMode === 'typed' ? typedSignature : drawnSignature
  const canAccept = Boolean(
    legalName.trim() && agreementChecked && signatureValue.trim()
  )

  return {
    canAccept,
    declineReason,
    agreementChecked,
    drawnSignature,
    legalName,
    signatureMode,
    signatureValue,
    typedSignature,
    setAgreementChecked,
    setDeclineReason,
    setDrawnSignature,
    setLegalName,
    setSignatureMode,
    setTypedSignature,
  }
}
