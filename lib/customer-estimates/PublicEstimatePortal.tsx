'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { EstimatePublicSnapshot } from './types'
import { CustomerEstimateDocumentView } from './view'
import styles from './PublicEstimatePortal.module.css'

export type PublicEstimatePortalCopy = {
  shellTitle: string
  documentLabel: string
  acceptanceTitle: string
  agreementText: string
  downloadLabel: string
  acceptedMessage?: string
  declinedMessage?: string
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
  | 'locked-superseded'
  | 'error'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function statusLabel(status: EstimatePublicSnapshot['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatPortalDate(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return ''

  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeZone: timeZone || undefined,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
  }
}

function formatPortalTimestamp(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || undefined,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }
}

function isQuoteSoftExpired(snapshot: EstimatePublicSnapshot) {
  const validDays = snapshot.document.quote_validity_days
  if (!Number.isFinite(validDays) || validDays <= 0) return false

  const sentAt = asText(snapshot.sent_at) || asText(snapshot.document.meta.sent_at)
  if (!sentAt) return false

  const sentDate = new Date(sentAt)
  if (Number.isNaN(sentDate.getTime())) return false

  const expiresAt = new Date(sentDate)
  expiresAt.setDate(expiresAt.getDate() + validDays)

  return Date.now() > expiresAt.getTime()
}

function quoteExpirationLabel(snapshot: EstimatePublicSnapshot) {
  const validDays = snapshot.document.quote_validity_days
  if (!Number.isFinite(validDays) || validDays <= 0) return ''

  const sourceDate = asText(snapshot.sent_at) || asText(snapshot.document.meta.sent_at) || asText(snapshot.document.meta.quote_date)
  if (!sourceDate) return ''

  const expiresAt = new Date(sourceDate.includes('T') ? sourceDate : `${sourceDate}T00:00:00`)
  if (Number.isNaN(expiresAt.getTime())) return ''

  expiresAt.setDate(expiresAt.getDate() + validDays)
  return formatPortalDate(expiresAt.toISOString(), snapshot.document.company.timezone)
}

function formatPortalCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '-'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function lockedMessage(copy: PublicEstimatePortalCopy, status: EstimatePublicSnapshot['status']) {
  if (status === 'accepted') {
    return copy.acceptedMessage ?? `${copy.documentLabel} accepted. We'll contact you to schedule.`
  }

  if (status === 'declined') {
    return (
      copy.declinedMessage ??
      `${copy.documentLabel} declined. We'll review your note and follow up if anything else is needed.`
    )
  }

  if (status === 'superseded') {
    return 'A newer quote is available.'
  }

  return ''
}

function usePortalPrint(printMode: boolean) {
  useEffect(() => {
    if (!printMode) return
    const timer = window.setTimeout(() => window.print(), 350)
    return () => window.clearTimeout(timer)
  }, [printMode])
}

function usePublicEstimatePortalForm(initialLegalName: string, initialEmail: string) {
  const [legalName, setLegalName] = useState(initialLegalName)
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('typed')
  const [typedSignature, setTypedSignature] = useState('')
  const [drawnSignature, setDrawnSignature] = useState('')
  const [drawnSignatureReady, setDrawnSignatureReady] = useState(false)
  const [customerEmail, setCustomerEmail] = useState(initialEmail)
  const [message, setMessage] = useState('')
  const [agreementChecked, setAgreementChecked] = useState(false)

  const signatureValue = signatureMode === 'typed' ? typedSignature : drawnSignature
  const hasSignature =
    signatureMode === 'typed' ? Boolean(typedSignature.trim()) : drawnSignatureReady
  const canAccept = Boolean(
    legalName.trim() &&
      customerEmail.trim() &&
      agreementChecked &&
      hasSignature
  )

  return {
    agreementChecked,
    canAccept,
    drawnSignature,
    drawnSignatureReady,
    legalName,
    signatureMode,
    signatureValue,
    typedSignature,
    customerEmail,
    message,
    setAgreementChecked,
    setCustomerEmail,
    setDrawnSignature,
    setDrawnSignatureReady,
    setLegalName,
    setMessage,
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
  onChange: (value: string, isMeaningful: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const metricsRef = useRef({
    distance: 0,
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  })

  const resetMetrics = () => {
    metricsRef.current = {
      distance: 0,
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  }

  const updateMetrics = (point: { x: number; y: number }, previous: { x: number; y: number } | null) => {
    const metrics = metricsRef.current
    metrics.minX = Math.min(metrics.minX, point.x)
    metrics.maxX = Math.max(metrics.maxX, point.x)
    metrics.minY = Math.min(metrics.minY, point.y)
    metrics.maxY = Math.max(metrics.maxY, point.y)

    if (previous) {
      metrics.distance += Math.hypot(point.x - previous.x, point.y - previous.y)
    }
  }

  const hasMeaningfulSignature = () => {
    const metrics = metricsRef.current
    const width = metrics.maxX - metrics.minX
    const height = metrics.maxY - metrics.minY
    return metrics.distance >= 12 && Math.max(width, height) >= 8
  }

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
    const previousPoint = lastPointRef.current
    updateMetrics(point, previousPoint)
    lastPointRef.current = point

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!previousPoint) return

    ctx.beginPath()
    ctx.moveTo(previousPoint.x, previousPoint.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const finishStroke = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawingRef.current = false
    lastPointRef.current = null
    onChange(canvas.toDataURL('image/png'), hasMeaningfulSignature())
  }

  return (
    <div className={styles.signaturePad}>
      <div className={styles.signatureCanvasWrap}>
        {!value ? <div className={styles.signaturePlaceholder}>Sign here with your finger or mouse</div> : null}
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
        <div className={styles.signatureLine} aria-hidden="true">
          <span>x</span>
        </div>
      </div>
      <div className={styles.signatureActions}>
        <div className={styles.signatureActionGroup}>
          <button type="button" disabled className={styles.signatureUtility}>
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              resetMetrics()
              onChange('', false)
            }}
            className={styles.signatureUtility}
          >
            Clear
          </button>
        </div>
        <div className={styles.signatureHint}>Draw your signature above</div>
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

  if (presentationState === 'locked-declined') {
    return (
      <div className={`${styles.notice} ${styles.noticeWarning}`}>
        {lockedMessage(copy, 'declined')}
      </div>
    )
  }

  if (presentationState === 'locked-superseded') {
    return (
      <div className={`${styles.notice} ${styles.noticeWarning}`}>
        {lockedMessage(copy, 'superseded')}
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
    asText(workflow.snapshot?.document?.customer?.name),
    asText(workflow.snapshot?.document?.customer?.email)
  )

  const presentationState = useMemo<PresentationState>(() => {
    if (!workflow.snapshot?.document) return 'missing'
    if (workflow.submitError) return 'error'
    if (workflow.busy) return 'busy'
    if (workflow.snapshot.status === 'accepted') return 'locked-accepted'
    if (workflow.snapshot.status === 'declined') return 'locked-declined'
    if (workflow.snapshot.status === 'superseded') return 'locked-superseded'
    return 'active'
  }, [workflow.busy, workflow.snapshot, workflow.submitError])

  if (!workflow.snapshot?.document) {
    return <PublicEstimatePortalUnavailable copy={copy} />
  }

  const locked =
    presentationState === 'locked-accepted' ||
    presentationState === 'locked-declined' ||
    presentationState === 'locked-superseded'
  const currentSnapshot = workflow.snapshot
  const signerName = asText(currentSnapshot.acceptance_json?.legal_name)
  const acceptedAt = formatPortalTimestamp(
    currentSnapshot.acceptance_json?.accepted_at || currentSnapshot.accepted_at || currentSnapshot.locked_at,
    currentSnapshot.document.company.timezone
  )
  const showSoftExpirationWarning = presentationState === 'active' && isQuoteSoftExpired(currentSnapshot)
  const expiresLabel = quoteExpirationLabel(currentSnapshot)

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.totalCard}>
          <div>
            <div className={styles.eyebrow}>Your quote total</div>
            <div className={styles.totalValue}>{formatPortalCurrency(currentSnapshot.document.total)}</div>
            <div className={styles.totalMeta}>
              {expiresLabel ? <>Valid through {expiresLabel}</> : null}
            </div>
          </div>
          <button type="button" onClick={() => window.print()} className={styles.secondaryButton}>
            {copy.downloadLabel}
          </button>
        </div>

        <div className={styles.documentWrap}>
          <CustomerEstimateDocumentView
            document={currentSnapshot.document}
            showShell={false}
            showOverflowWarnings={false}
          />
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
              <div className={styles.lockedMessage}>{lockedMessage(copy, currentSnapshot.status)}</div>
              {currentSnapshot.status === 'accepted' ? (
                <div className={styles.lockedMetaList}>
                  {signerName ? <div>Signed by {signerName}</div> : null}
                  {acceptedAt ? <div>Accepted {acceptedAt}</div> : null}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {showSoftExpirationWarning ? (
                <div className={`${styles.notice} ${styles.noticeWarning}`}>
                  This quote may be expired, contact us.
                </div>
              ) : null}

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
                  <span className={styles.fieldLabel}>Email address</span>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => form.setCustomerEmail(event.target.value)}
                    className={styles.input}
                  />
                </label>
              </div>

              <div className={styles.signatureSection}>
                <div className={styles.signatureHeader}>
                  <span className={styles.fieldLabel}>Signature</span>
                  <span>Draw your signature, or switch to typed.</span>
                </div>
                <label className={styles.signatureModeLabel}>
                  <span>Signature mode</span>
                  <select
                    value={form.signatureMode}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      form.setSignatureMode(event.target.value as SignatureMode)
                    }
                    className={styles.signatureModeSelect}
                  >
                    <option value="typed">Typed</option>
                    <option value="drawn">Drawn</option>
                  </select>
                </label>
                <div className={styles.segmentedControl}>
                  <button
                    type="button"
                    className={form.signatureMode === 'drawn' ? styles.segmentActive : styles.segment}
                    onClick={() => form.setSignatureMode('drawn')}
                  >
                    Drawn
                  </button>
                  <button
                    type="button"
                    className={form.signatureMode === 'typed' ? styles.segmentActive : styles.segment}
                    onClick={() => form.setSignatureMode('typed')}
                  >
                    Typed
                  </button>
                </div>
              </div>

              {form.signatureMode === 'typed' ? (
                <div className={styles.typedSignatureBlock}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Typed signature</span>
                    <input
                      value={form.typedSignature}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => form.setTypedSignature(event.target.value)}
                      placeholder="Type your full legal name"
                      className={styles.input}
                    />
                  </label>
                  <div className={styles.typedSignaturePreviewWrap}>
                    <div className={styles.typedSignaturePreviewLabel}>Signature preview</div>
                    <div
                      data-testid="typed-signature-preview"
                      className={
                        form.typedSignature.trim()
                          ? styles.typedSignaturePreview
                          : styles.typedSignaturePreviewPlaceholder
                      }
                    >
                      {form.typedSignature.trim() || 'Your signature preview will appear here'}
                    </div>
                  </div>
                </div>
              ) : (
                <SignaturePad
                  value={form.drawnSignature}
                  onChange={(value, isMeaningful) => {
                    form.setDrawnSignature(value)
                    form.setDrawnSignatureReady(isMeaningful)
                  }}
                />
              )}

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Message <span className={styles.optionalText}>(optional)</span></span>
                <textarea
                  value={form.message}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => form.setMessage(event.target.value)}
                  placeholder={`Add a note for ${currentSnapshot.document.company.business_name || 'us'}...`}
                  className={styles.textarea}
                />
              </label>

              <div className={styles.acceptanceFooter}>
                <label className={styles.agreementRow}>
                  <input
                    type="checkbox"
                    checked={form.agreementChecked}
                    onChange={(event) => form.setAgreementChecked(event.target.checked)}
                    className={styles.agreementCheckbox}
                  />
                  <span>{copy.agreementText}</span>
                </label>

                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={workflow.busy || !form.canAccept}
                    onClick={() =>
                      void workflow.accept({
                        legal_name: form.legalName,
                        customer_email: form.customerEmail,
                        signature_type: form.signatureMode,
                        signature_value: form.signatureValue,
                        accepted_terms: form.agreementChecked,
                        customer_message: form.message,
                      })
                    }
                    className={styles.primaryButton}
                  >
                    Accept {copy.documentLabel}
                  </button>
                  {!form.canAccept ? (
                    <div className={styles.actionHint}>Add your signature above to continue.</div>
                  ) : null}
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
