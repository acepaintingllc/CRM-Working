'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { parsePublicEstimateAcceptRequest } from './publicPortalContracts'
import type { EstimatePublicSnapshot } from './types'
import { CustomerEstimateDocumentView } from './view'
import styles from './PublicEstimatePortal.module.css'

export type PublicEstimatePortalCopy = {
  shellTitle: string
  documentLabel: string
  acceptanceTitle: string
  agreementText: string
  downloadLabel: string
  unavailableTitle: string
  unavailableMessage: string
}

type PublicEstimatePortalProps = {
  initialSnapshot: EstimatePublicSnapshot | null
  printMode?: boolean
  apiBasePath: string
  copy: PublicEstimatePortalCopy
}

type SignatureMode = 'typed' | 'drawn'
type SubmitAction = 'accept' | 'decline' | null
type PresentationState =
  | 'missing'
  | 'active'
  | 'busy'
  | 'locked-accepted'
  | 'locked-declined'
  | 'error'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function statusLabel(status: EstimatePublicSnapshot['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function usePortalPrint(printMode: boolean) {
  useEffect(() => {
    if (!printMode) return
    const timer = window.setTimeout(() => window.print(), 350)
    return () => window.clearTimeout(timer)
  }, [printMode])
}

function usePublicEstimatePortalForm(initialLegalName: string) {
  const [legalName, setLegalName] = useState(initialLegalName)
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('typed')
  const [typedSignature, setTypedSignature] = useState(initialLegalName)
  const [drawnSignature, setDrawnSignature] = useState('')
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  const signatureValue = signatureMode === 'typed' ? typedSignature : drawnSignature
  const acceptRequest = parsePublicEstimateAcceptRequest({
    legal_name: legalName,
    signature_type: signatureMode,
    signature_value: signatureValue,
    accepted_terms: agreementChecked,
  })
  const canAccept = acceptRequest.ok

  return {
    acceptRequest,
    agreementChecked,
    canAccept,
    declineReason,
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

function usePublicEstimatePortalWorkflow({
  apiBasePath,
  copy,
  initialSnapshot,
}: {
  apiBasePath: string
  copy: PublicEstimatePortalCopy
  initialSnapshot: EstimatePublicSnapshot | null
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [submitAction, setSubmitAction] = useState<SubmitAction>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const busy = submitAction !== null

  const submit = async (action: Exclude<SubmitAction, null>, body: Record<string, unknown>) => {
    if (!snapshot?.public_token || busy) return

    setSubmitAction(action)
    setSubmitError(null)

    try {
      const response = await fetch(`${apiBasePath}/${snapshot.public_token}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const payload = (await response.json().catch(() => null)) as
        | { data?: EstimatePublicSnapshot; error?: string }
        | null

      if (!response.ok) {
        setSubmitError(
          payload?.error ??
            `Unable to ${action} ${copy.documentLabel.toLowerCase()}`
        )
        return
      }

      if (!payload?.data) {
        setSubmitError(`Unable to update ${copy.documentLabel.toLowerCase()} status`)
        return
      }

      setSnapshot(payload.data)
    } finally {
      setSubmitAction(null)
    }
  }

  return {
    busy,
    snapshot,
    submitAction,
    submitError,
    accept: (body: Record<string, unknown>) => submit('accept', body),
    decline: (body: Record<string, unknown>) => submit('decline', body),
  }
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
      const image = new Image()
      image.onload = () => ctx.drawImage(image, 0, 0, width, height)
      image.src = value
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
    <div className={styles.signaturePad}>
      <canvas
        ref={canvasRef}
        data-testid="quote-signature-canvas"
        aria-label="Signature canvas"
        onPointerDown={(event) => {
          if (typeof event.currentTarget.setPointerCapture === 'function') {
            event.currentTarget.setPointerCapture(event.pointerId)
          }
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
        className={styles.signatureCanvas}
      />
      <div className={styles.signatureActions}>
        <button type="button" onClick={() => onChange('')} className={styles.signatureClear}>
          Clear
        </button>
        <div className={styles.signatureHint}>Draw your signature above, or use typed signature below.</div>
      </div>
    </div>
  )
}

function PublicEstimatePortalNotice({
  busy,
  copy,
  presentationState,
  submitAction,
  submitError,
}: {
  busy: boolean
  copy: PublicEstimatePortalCopy
  presentationState: PresentationState
  submitAction: SubmitAction
  submitError: string | null
}) {
  if (submitError) {
    return <div className={`${styles.notice} ${styles.noticeError}`}>{submitError}</div>
  }

  if (busy) {
    return (
      <div className={`${styles.notice} ${styles.noticeInfo}`}>
        {submitAction === 'decline'
          ? `Submitting ${copy.documentLabel.toLowerCase()} decline...`
          : `Submitting ${copy.documentLabel.toLowerCase()} acceptance...`}
      </div>
    )
  }

  if (presentationState === 'locked-accepted') {
    return (
      <div className={`${styles.notice} ${styles.noticeSuccess}`}>
        {copy.documentLabel} accepted and locked.
      </div>
    )
  }

  if (presentationState === 'locked-declined') {
    return (
      <div className={`${styles.notice} ${styles.noticeWarning}`}>
        {copy.documentLabel} marked declined.
      </div>
    )
  }

  return null
}

function PublicEstimatePortalUnavailable({
  copy,
}: {
  copy: PublicEstimatePortalCopy
}) {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div>
            <div className={styles.eyebrow}>{copy.shellTitle}</div>
            <div className={styles.acceptanceTitle}>{copy.unavailableTitle}</div>
          </div>
          <div className={`${styles.notice} ${styles.noticeError}`}>{copy.unavailableMessage}</div>
        </div>
      </div>
    </div>
  )
}

export function PublicEstimatePortal({
  initialSnapshot,
  printMode = false,
  apiBasePath,
  copy,
}: PublicEstimatePortalProps) {
  usePortalPrint(printMode)

  const workflow = usePublicEstimatePortalWorkflow({
    apiBasePath,
    copy,
    initialSnapshot,
  })

  const form = usePublicEstimatePortalForm(
    asText(workflow.snapshot?.document?.customer?.name)
  )

  const presentationState = useMemo<PresentationState>(() => {
    if (!workflow.snapshot?.document) return 'missing'
    if (workflow.submitError) return 'error'
    if (workflow.busy) return 'busy'
    if (workflow.snapshot.status === 'accepted') return 'locked-accepted'
    if (workflow.snapshot.status === 'declined') return 'locked-declined'
    return 'active'
  }, [workflow.busy, workflow.snapshot, workflow.submitError])

  if (!workflow.snapshot?.document) {
    return <PublicEstimatePortalUnavailable copy={copy} />
  }

  const locked = presentationState === 'locked-accepted' || presentationState === 'locked-declined'
  const currentSnapshot = workflow.snapshot

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.headerCard}>
          <div>
            <div className={styles.eyebrow}>{copy.shellTitle}</div>
            <div className={styles.title}>{currentSnapshot.document.meta.title}</div>
            <div className={styles.subtitle}>
              {currentSnapshot.document.customer.name || 'Customer'} - {statusLabel(currentSnapshot.status)} -{' '}
              {currentSnapshot.document.meta.version_name}
            </div>
          </div>
          <button type="button" onClick={() => window.print()} className={styles.secondaryButton}>
            {copy.downloadLabel}
          </button>
        </div>

        <div className={styles.documentWrap}>
          <CustomerEstimateDocumentView document={currentSnapshot.document} showShell={false} />
        </div>

        <div className={styles.card}>
          <div className={styles.acceptanceHeader}>
            <div>
              <div className={styles.eyebrow}>Acceptance</div>
              <div className={styles.acceptanceTitle}>{copy.acceptanceTitle}</div>
            </div>
            <div className={styles.statusMeta}>Status: {statusLabel(currentSnapshot.status)}</div>
          </div>

          <PublicEstimatePortalNotice
            busy={workflow.busy}
            copy={copy}
            presentationState={presentationState}
            submitAction={workflow.submitAction}
            submitError={workflow.submitError}
          />

          {locked ? (
            <div className={styles.lockedPanel}>
              {`This ${copy.documentLabel.toLowerCase()} has been ${
                currentSnapshot.status === 'accepted' ? 'accepted' : 'declined'
              } and locked.`}
            </div>
          ) : (
            <>
              <div className={styles.fieldsGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Full legal name</span>
                  <input
                    value={form.legalName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => form.setLegalName(event.target.value)}
                    className={styles.input}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Signature mode</span>
                  <select
                    value={form.signatureMode}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      form.setSignatureMode(event.target.value as SignatureMode)
                    }
                    className={styles.select}
                  >
                    <option value="typed">Typed</option>
                    <option value="drawn">Drawn</option>
                  </select>
                </label>
              </div>

              {form.signatureMode === 'typed' ? (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Typed signature</span>
                  <input
                    value={form.typedSignature}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => form.setTypedSignature(event.target.value)}
                    placeholder="Type your full legal name"
                    className={styles.input}
                  />
                </label>
              ) : (
                <SignaturePad value={form.drawnSignature} onChange={form.setDrawnSignature} />
              )}

              <label className={styles.agreementRow}>
                <input
                  type="checkbox"
                  checked={form.agreementChecked}
                  onChange={(event) => form.setAgreementChecked(event.target.checked)}
                  className={styles.agreementCheckbox}
                />
                <span>{copy.agreementText}</span>
              </label>

              <div className={styles.fieldsGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Decline note</span>
                  <textarea
                    value={form.declineReason}
                    onChange={(event) => form.setDeclineReason(event.target.value)}
                    rows={3}
                    placeholder="Optional note if you are declining"
                    className={styles.textarea}
                  />
                </label>
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={workflow.busy}
                    onClick={() => void workflow.decline({ reason: form.declineReason })}
                    className={styles.dangerButton}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={workflow.busy || !form.canAccept}
                    onClick={() =>
                      form.acceptRequest.ok
                        ? void workflow.accept({
                            legal_name: form.acceptRequest.value.legalName,
                            signature_type: form.acceptRequest.value.signatureType,
                            signature_value: form.acceptRequest.value.signatureValue,
                            accepted_terms: form.acceptRequest.value.acceptedTerms,
                          })
                        : undefined
                    }
                    className={styles.primaryButton}
                  >
                    Accept {copy.documentLabel}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function PublicEstimatePortalErrorState({
  copy,
  message,
}: {
  copy: PublicEstimatePortalCopy
  message: string
}) {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div>
            <div className={styles.eyebrow}>{copy.shellTitle}</div>
            <div className={styles.acceptanceTitle}>{copy.unavailableTitle}</div>
          </div>
          <div className={`${styles.notice} ${styles.noticeError}`}>{message}</div>
        </div>
      </div>
    </div>
  )
}
