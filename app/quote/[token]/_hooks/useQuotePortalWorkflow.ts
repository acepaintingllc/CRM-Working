'use client'

import { useState } from 'react'
import type { EstimatePublicSnapshot } from '@/lib/customer-estimates/types'

type QuotePortalStatus = EstimatePublicSnapshot['status']

type SnapshotDecisionPayload = {
  legalName: string
  signatureMode: 'typed' | 'drawn'
  signatureValue: string
}

type SnapshotMessage = {
  error?: string
  data?: EstimatePublicSnapshot
}

export function useQuotePortalWorkflow({
  documentLabel,
  initialStatus,
  publicToken,
}: {
  documentLabel: string
  initialStatus: QuotePortalStatus
  publicToken: string
}) {
  const [status, setStatus] = useState<QuotePortalStatus>(initialStatus)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const accept = async ({
    legalName,
    signatureMode,
    signatureValue,
    agreementChecked,
  }: SnapshotDecisionPayload & { agreementChecked: boolean }) => {
    setBusy(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/quote-public/${publicToken}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: legalName,
          signature_type: signatureMode,
          signature_value: signatureValue,
          accepted_terms: agreementChecked,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage((payload as SnapshotMessage | null)?.error ?? `Unable to accept ${documentLabel.toLowerCase()}`)
        return
      }

      setStatus((payload as SnapshotMessage | null)?.data?.status ?? 'accepted')
      setMessage(`${documentLabel} accepted and locked.`)
    } finally {
      setBusy(false)
    }
  }

  const decline = async ({ reason }: { reason: string }) => {
    setBusy(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/quote-public/${publicToken}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage((payload as SnapshotMessage | null)?.error ?? `Unable to decline ${documentLabel.toLowerCase()}`)
        return
      }

      setStatus((payload as SnapshotMessage | null)?.data?.status ?? 'declined')
      setMessage(`${documentLabel} marked declined.`)
    } finally {
      setBusy(false)
    }
  }

  return {
    decline,
    message,
    status,
    busy,
    accept,
  }
}
