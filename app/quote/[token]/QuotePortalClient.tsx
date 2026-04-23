'use client'

import { CustomerEstimateDocumentView } from '@/lib/customer-estimates/view'
import type { EstimatePublicSnapshot } from '@/lib/customer-estimates/types'
import { QuoteAcceptanceSection } from './_components/QuoteAcceptanceSection'
import { useQuotePortalPrint } from './_hooks/useQuotePortalPrint'
import { useQuotePortalSignature } from './_hooks/useQuotePortalSignature'
import { useQuotePortalWorkflow } from './_hooks/useQuotePortalWorkflow'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export default function QuotePortalClient({
  snapshot,
  printMode = false,
}: {
  snapshot: EstimatePublicSnapshot
  printMode?: boolean
}) {
  const documentLabel = 'Quote'
  const shellTitle = 'Customer Quote'

  useQuotePortalPrint(printMode)

  const signatureState = useQuotePortalSignature({
    initialLegalName: asText(snapshot.document?.customer?.name),
  })

  const workflow = useQuotePortalWorkflow({
    documentLabel,
    initialStatus: snapshot.status,
    publicToken: snapshot.public_token || '',
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0b0b0b',
        color: '#f4f4f4',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          minHeight: '100vh',
          padding: 20,
          background:
            'radial-gradient(circle at top left, rgba(133,199,155,0.08), transparent 28%), radial-gradient(circle at bottom right, rgba(255,255,255,0.05), transparent 24%), linear-gradient(180deg, #111 0%, #090909 100%)',
        }}
      >
        <div style={{ maxWidth: 1480, margin: '0 auto', display: 'grid', gap: 18 }}>
          <div
            style={{
              background: '#171717',
              border: '1px solid #2a2a2a',
              borderRadius: 14,
              padding: '16px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              alignItems: 'center',
            }}
          >
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
                {shellTitle}
              </div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em' }}>
                {snapshot.document.meta.title}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#c4c4c4' }}>
                {snapshot.document.customer.name || 'Customer'} - {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}{' '}
                - {snapshot.document.meta.version_name}
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                border: '1px solid rgba(133,199,155,0.3)',
                background: 'rgba(133,199,155,0.12)',
                color: '#d7f3df',
                padding: '9px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Download PDF
            </button>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <CustomerEstimateDocumentView document={snapshot.document} showShell={false} />
          </div>

          <QuoteAcceptanceSection
            agreementChecked={signatureState.agreementChecked}
            busy={workflow.busy}
            canAccept={signatureState.canAccept}
            declineReason={signatureState.declineReason}
            documentLabel={documentLabel}
            legalName={signatureState.legalName}
            message={workflow.message}
            onAccept={() =>
              workflow.accept({
                legalName: signatureState.legalName,
                signatureMode: signatureState.signatureMode,
                signatureValue: signatureState.signatureValue,
                agreementChecked: signatureState.agreementChecked,
              })
            }
            onAgreementChange={signatureState.setAgreementChecked}
            onDecline={() =>
              workflow.decline({
                reason: signatureState.declineReason,
              })
            }
            onDeclineReasonChange={signatureState.setDeclineReason}
            onLegalNameChange={signatureState.setLegalName}
            onSignatureModeChange={signatureState.setSignatureMode}
            onTypedSignatureChange={signatureState.setTypedSignature}
            onDrawnSignatureChange={signatureState.setDrawnSignature}
            signatureMode={signatureState.signatureMode}
            status={workflow.status}
            typedSignature={signatureState.typedSignature}
            drawnSignature={signatureState.drawnSignature}
          />
        </div>
      </div>
    </div>
  )
}
