'use client'

import { useEffect, useRef, useState } from 'react'
import type { EstimatePublicSnapshot } from '@/lib/customer-estimates/types'
import { CustomerEstimateDocumentView } from '@/lib/customer-estimates/view'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.max(1, Math.floor(width * ratio))
    canvas.height = Math.max(1, Math.floor(height * ratio))
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1f2937'
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, width, height)
      img.src = value
    }
  }, [value])

  const drawPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const point = { x: clientX - rect.left, y: clientY - rect.top }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!lastPointRef.current) {
      lastPointRef.current = point
      return
    }
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
  }

  const finishStroke = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawingRef.current = false
    lastPointRef.current = null
    onChange(canvas.toDataURL('image/png'))
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drawingRef.current = true
          drawPoint(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return
          drawPoint(event.clientX, event.clientY)
        }}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
        style={{
          width: '100%',
          height: 110,
          borderRadius: 12,
          border: '1px solid #d1d5db',
          background: '#fff',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            border: '1px solid #d1d5db',
            background: '#fff',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <div style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
          Draw your signature above, or use typed signature below.
        </div>
      </div>
    </div>
  )
}

export default function EstimatePortalClient({
  snapshot,
  printMode = false,
}: {
  snapshot: EstimatePublicSnapshot
  printMode?: boolean
}) {
  const isV2Quote = snapshot.document.meta.flow_version === 'v2'
  const documentLabel = isV2Quote ? 'Quote' : 'Estimate'
  const shellTitle = isV2Quote ? 'Customer Quote' : 'Customer Estimate'
  const [accepted, setAccepted] = useState(snapshot.status === 'accepted')
  const [legalName, setLegalName] = useState(asText(snapshot.document?.customer?.name))
  const [signatureMode, setSignatureMode] = useState<'typed' | 'drawn'>('typed')
  const [typedSignature, setTypedSignature] = useState(asText(snapshot.document?.customer?.name))
  const [drawnSignature, setDrawnSignature] = useState('')
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [status, setStatus] = useState(snapshot.status)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!printMode) return
    const timer = setTimeout(() => window.print(), 350)
    return () => clearTimeout(timer)
  }, [printMode])

  const signatureValue = signatureMode === 'typed' ? typedSignature : drawnSignature
  const canAccept = legalName.trim() && agreementChecked && (signatureMode === 'typed' ? typedSignature.trim() : drawnSignature.trim())

  const accept = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/estimate-public/${snapshot.public_token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: legalName,
          signature_type: signatureMode,
          signature_value: signatureValue,
          accepted_terms: agreementChecked,
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage(payload?.error ?? `Unable to accept ${documentLabel.toLowerCase()}`)
        return
      }
      setAccepted(true)
      setStatus('accepted')
      setMessage(`${documentLabel} accepted and locked.`)
    } finally {
      setBusy(false)
    }
  }

  const decline = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/estimate-public/${snapshot.public_token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage(payload?.error ?? `Unable to decline ${documentLabel.toLowerCase()}`)
        return
      }
      setStatus('declined')
      setMessage(`${documentLabel} marked declined.`)
    } finally {
      setBusy(false)
    }
  }

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
              <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#909090', fontWeight: 700 }}>
                {shellTitle}
              </div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em' }}>
                {snapshot.document.meta.title}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#c4c4c4' }}>
                {snapshot.document.customer.name || 'Customer'} - {statusLabel(status)} - {snapshot.document.meta.version_name}
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
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#909090', fontWeight: 700 }}>
                  Acceptance
                </div>
                <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: '#f4f4f4' }}>
                  Review and accept this {isV2Quote ? 'quote' : 'estimate'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#c4c4c4' }}>
                Status: {statusLabel(status)}
              </div>
            </div>

            {message && (
              <div style={{ border: '1px solid rgba(133,199,155,0.24)', background: 'rgba(133,199,155,0.08)', color: '#cdeed5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                {message}
              </div>
            )}

            {accepted || status === 'accepted' ? (
              <div style={{ border: '1px solid rgba(133,199,155,0.22)', background: 'rgba(133,199,155,0.06)', borderRadius: 12, padding: 14, color: '#d7f3df' }}>
                This {isV2Quote ? 'quote' : 'estimate'} has been accepted and locked.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#c4c4c4' }}>Full legal name</span>
                    <input
                      value={legalName}
                      onChange={(event) => setLegalName(event.target.value)}
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
                      onChange={(event) => setSignatureMode(event.target.value as 'typed' | 'drawn')}
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
                      onChange={(event) => setTypedSignature(event.target.value)}
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
                  <SignaturePad value={drawnSignature} onChange={setDrawnSignature} />
                )}

                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#c4c4c4' }}>
                  <input
                    type="checkbox"
                    checked={agreementChecked}
                    onChange={(event) => setAgreementChecked(event.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>I agree to the scope, pricing, and terms shown above.</span>
                </label>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#c4c4c4' }}>Decline note</span>
                    <textarea
                      value={declineReason}
                      onChange={(event) => setDeclineReason(event.target.value)}
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
                      onClick={decline}
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
                      onClick={accept}
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
                      Accept Estimate
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
