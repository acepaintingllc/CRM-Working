'use client'

import type { ChangeEvent } from 'react'
import { SignaturePad } from './SignaturePad'
import type { SignatureMode } from '../_hooks/useQuotePortalSignature'

type QuotePortalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'superseded'

export function QuoteAcceptanceSection({
  agreementChecked,
  busy,
  canAccept,
  declineReason,
  documentLabel,
  legalName,
  message,
  onAccept,
  onAgreementChange,
  onDecline,
  onDeclineReasonChange,
  onLegalNameChange,
  onSignatureModeChange,
  onTypedSignatureChange,
  onDrawnSignatureChange,
  signatureMode,
  status,
  typedSignature,
  drawnSignature,
}: {
  agreementChecked: boolean
  busy: boolean
  canAccept: boolean
  declineReason: string
  documentLabel: string
  legalName: string
  message: string | null
  onAccept: () => void
  onAgreementChange: (checked: boolean) => void
  onDecline: () => void
  onDeclineReasonChange: (value: string) => void
  onLegalNameChange: (value: string) => void
  onSignatureModeChange: (mode: SignatureMode) => void
  onTypedSignatureChange: (value: string) => void
  onDrawnSignatureChange: (value: string) => void
  signatureMode: SignatureMode
  status: QuotePortalStatus
  typedSignature: string
  drawnSignature: string
}) {
  const locked = status === 'accepted' || status === 'declined'

  const label = status === 'accepted' ? 'accepted' : 'declined'

  return (
    <div
      style={{
        background: '#171717',
        border: '1px solid #2a2a2a',
        borderRadius: 14,
        padding: 18,
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#909090',
              fontWeight: 700,
            }}
          >
            Acceptance
          </div>
          <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: '#f4f4f4' }}>
            Review and accept this quote
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#c4c4c4' }}>Status: {status.charAt(0).toUpperCase() + status.slice(1)}</div>
      </div>

      {message && (
        <div
          style={{
            border: '1px solid rgba(133,199,155,0.24)',
            background: 'rgba(133,199,155,0.08)',
            color: '#cdeed5',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      {locked ? (
        <div
          style={{
            border: '1px solid rgba(133,199,155,0.22)',
            background: 'rgba(133,199,155,0.06)',
            borderRadius: 12,
            padding: 14,
            color: '#d7f3df',
          }}
        >
          {`This ${documentLabel.toLowerCase()} has been ${label} and locked.`}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#c4c4c4' }}>Full legal name</span>
              <input
                value={legalName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onLegalNameChange(event.target.value)}
                style={{
                  height: 42,
                  borderRadius: 10,
                  border: '1px solid #383838',
                  background: '#101010',
                  color: '#f4f4f4',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#c4c4c4' }}>Signature mode</span>
              <select
                value={signatureMode}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  onSignatureModeChange(event.target.value as SignatureMode)
                }
                style={{
                  height: 42,
                  borderRadius: 10,
                  border: '1px solid #383838',
                  background: '#101010',
                  color: '#f4f4f4',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              >
                <option value="typed">Typed</option>
                <option value="drawn">Drawn</option>
              </select>
            </label>
          </div>

          {signatureMode === 'typed' ? (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#c4c4c4' }}>Typed signature</span>
              <input
                value={typedSignature}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onTypedSignatureChange(event.target.value)}
                placeholder="Type your full legal name"
                style={{
                  height: 42,
                  borderRadius: 10,
                  border: '1px solid #383838',
                  background: '#101010',
                  color: '#f4f4f4',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
            </label>
          ) : (
            <SignaturePad value={drawnSignature} onChange={onDrawnSignatureChange} />
          )}

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#c4c4c4' }}>
            <input
              type="checkbox"
              checked={agreementChecked}
              onChange={(event) => onAgreementChange(event.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>I agree to the scope, pricing, and terms shown above.</span>
          </label>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#c4c4c4' }}>Decline note</span>
              <textarea
                value={declineReason}
                onChange={(event) => onDeclineReasonChange(event.target.value)}
                rows={3}
                placeholder="Optional note if you are declining"
                style={{
                  borderRadius: 10,
                  border: '1px solid #383838',
                  background: '#101010',
                  color: '#f4f4f4',
                  padding: 12,
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
            </label>
            <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy}
                onClick={onDecline}
                style={{
                  border: '1px solid #4b2c2c',
                  background: '#231111',
                  color: '#fecaca',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                Decline
              </button>
              <button
                type="button"
                disabled={busy || !canAccept}
                onClick={onAccept}
                style={{
                  border: '1px solid rgba(133,199,155,0.3)',
                  background: 'rgba(133,199,155,0.14)',
                  color: '#d7f3df',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: busy || !canAccept ? 0.55 : 1,
                }}
              >
                Accept Quote
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
